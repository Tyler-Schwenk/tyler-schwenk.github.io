"""
Kiln firings -- works out where firings start and end, and the numbers the kiln page shows.

Firings are detected from the temperature as readings arrive, so nobody has to press
anything. A firing is just a time range plus a summary (the KilnFiring table). Its curve
always comes from the raw readings, which are kept forever.
"""

import math
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import Integer, cast, func
from sqlalchemy.orm import Session

from app.models import KilnFiring, KilnReading

# a firing starts above the first and ends below the second. they're apart so a kiln
# hovering near one temperature can't flip between firing and not firing
FIRING_START_C = 65
FIRING_END_C = 50
# no readings for this long means the old firing is over, whatever the last temp was. a
# logger outage mid-firing is hours at most, and a firing's cooldown has readings throughout
FIRING_MAX_GAP_S = 12 * 60 * 60

# past this long without a reading, the logger counts as offline
LOGGER_ONLINE_WINDOW_S = 60
RATE_WINDOW_30M_S = 30 * 60
RATE_WINDOW_60M_S = 60 * 60
# how far the older reading can be from the window's start. past this, there's a gap in
# the data there and the rate would be a guess
RATE_MAX_SKEW_S = 5 * 60
SECONDS_PER_HOUR = 3600


def utc_now_naive() -> datetime:
    """
    Gets the current time in the naive UTC form the kiln tables store.

    Returns:
        datetime: Now, naive, in UTC.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _open_firing(db: Session, recorded_at: datetime) -> KilnFiring:
    """
    Starts a firing, including any hot readings just before this one.

    Looking back means readings stored before a firing was noticed still count, as long as
    they're recent enough to be part of it.

    Args:
        db: Database session.
        recorded_at: The reading that crossed FIRING_START_C. It's already stored.

    Returns:
        KilnFiring: The new firing, with its summary filled in.
    """
    lookback_start = recorded_at - timedelta(seconds=FIRING_MAX_GAP_S)
    last_end = db.query(func.max(KilnFiring.ended_at)).scalar()
    if last_end is not None:
        lookback_start = max(lookback_start, last_end)
    hot_readings = db.query(KilnReading).filter(
        KilnReading.thermocouple_c >= FIRING_START_C,
        KilnReading.recorded_at > lookback_start,
        KilnReading.recorded_at <= recorded_at,
    )
    first = hot_readings.order_by(KilnReading.recorded_at).first()
    peak = hot_readings.order_by(KilnReading.thermocouple_c.desc()).first()
    firing = KilnFiring(
        started_at=first.recorded_at,
        last_reading_at=recorded_at,
        peak_c=peak.thermocouple_c,
        peak_at=peak.recorded_at,
    )
    db.add(firing)
    return firing


def track_firings(db: Session, readings: list[tuple[datetime, Optional[float]]]) -> None:
    """
    Updates firings for newly stored readings. The caller commits.

    Args:
        db: Database session.
        readings: (recorded_at, thermocouple_c) of each new reading. Already flushed to
            the database, since starting a firing looks at them.
    """
    firing = db.query(KilnFiring).filter(KilnFiring.ended_at.is_(None)).first()
    for recorded_at, temp_c in sorted(readings, key=lambda reading: reading[0]):
        # faults mean no temperature, and don't say anything about the firing either way
        if temp_c is None:
            continue
        if firing is not None and recorded_at - firing.last_reading_at > timedelta(seconds=FIRING_MAX_GAP_S):
            firing.ended_at = firing.last_reading_at
            db.flush()
            firing = None
        if firing is None:
            if temp_c >= FIRING_START_C:
                firing = _open_firing(db, recorded_at)
                db.flush()
            continue
        firing.last_reading_at = recorded_at
        if temp_c > firing.peak_c:
            firing.peak_c = temp_c
            firing.peak_at = recorded_at
        if temp_c < FIRING_END_C:
            firing.ended_at = recorded_at
            db.flush()
            firing = None


def _rise_rate_c_per_h(db: Session, latest: KilnReading, window_s: int) -> Optional[float]:
    """
    Works out how fast the temperature's been changing over a recent window.

    Args:
        db: Database session.
        latest: The newest reading that has a temperature.
        window_s: How far back to compare against.

    Returns:
        Optional[float]: Degrees C per hour, negative when cooling. None if there's no
            reading from around the start of the window.
    """
    window_start = latest.recorded_at - timedelta(seconds=window_s)
    older = (
        db.query(KilnReading)
        .filter(KilnReading.recorded_at <= window_start, KilnReading.thermocouple_c.isnot(None))
        .order_by(KilnReading.recorded_at.desc())
        .first()
    )
    if older is None or (window_start - older.recorded_at).total_seconds() > RATE_MAX_SKEW_S:
        return None
    elapsed_s = (latest.recorded_at - older.recorded_at).total_seconds()
    return round((latest.thermocouple_c - older.thermocouple_c) * SECONDS_PER_HOUR / elapsed_s, 1)


def get_status(db: Session) -> dict:
    """
    Gets what the kiln page's live readout shows.

    Args:
        db: Database session.

    Returns:
        dict: Matches schemas.KilnStatus. Temperature and rates are None while the logger
            is offline or the probe has a fault, rather than showing old numbers as current.
    """
    latest = db.query(KilnReading).order_by(KilnReading.recorded_at.desc()).first()
    firing = db.query(KilnFiring).filter(KilnFiring.ended_at.is_(None)).first()
    if latest is None:
        return {"online": False, "firing": firing}
    online = (utc_now_naive() - latest.recorded_at).total_seconds() <= LOGGER_ONLINE_WINDOW_S
    has_live_temp = online and latest.thermocouple_c is not None
    return {
        "online": online,
        "last_reading_at": latest.recorded_at,
        "thermocouple_c": latest.thermocouple_c if has_live_temp else None,
        "fault_status": latest.fault_status,
        "rise_30m_c_per_h": _rise_rate_c_per_h(db, latest, RATE_WINDOW_30M_S) if has_live_temp else None,
        "rise_60m_c_per_h": _rise_rate_c_per_h(db, latest, RATE_WINDOW_60M_S) if has_live_temp else None,
        "firing": firing,
    }


def get_curve(db: Session, firing: KilnFiring, max_points: int) -> dict:
    """
    Gets a firing's temperature curve, averaged down to a size a page can draw.

    Args:
        db: Database session.
        firing: The firing.
        max_points: The most points to return.

    Returns:
        dict: Matches schemas.KilnFiringCurve. A point's temperature is None when every
            reading in its bucket had a fault. bucket_s is how much time a point covers,
            so a jump bigger than that between points is a gap in the data.
    """
    end = firing.ended_at or firing.last_reading_at
    duration_s = (end - firing.started_at).total_seconds()
    bucket_s = max(1, math.ceil(duration_s / max_points))
    bucket = cast(func.strftime("%s", KilnReading.recorded_at), Integer) // bucket_s
    rows = (
        db.query(func.min(KilnReading.recorded_at), func.avg(KilnReading.thermocouple_c))
        .filter(KilnReading.recorded_at >= firing.started_at, KilnReading.recorded_at <= end)
        .group_by(bucket)
        .order_by(bucket)
        .all()
    )
    # sqlite hands func.min on a datetime back as a string, hence the parse
    points = [
        {
            "recorded_at": datetime.fromisoformat(recorded_at) if isinstance(recorded_at, str) else recorded_at,
            "thermocouple_c": None if temp_c is None else round(temp_c, 2),
        }
        for recorded_at, temp_c in rows
    ]
    return {"firing": firing, "bucket_s": bucket_s, "points": points}
