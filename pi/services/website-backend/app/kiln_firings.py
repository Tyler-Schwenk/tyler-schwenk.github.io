"""
Kiln firings -- works out where firings start and end, and the numbers the kiln page shows.

Firings are detected from the temperature as readings arrive, so nobody has to press
anything. A firing is just a time range plus a summary (the KilnFiring table). Its curve
always comes from the raw readings, which are kept forever.

A firing takes about a day to heat and up to a day to cool, the probe usually gets pulled
around 400 F, and the next firing is at least a few days later. So time is the strongest
signal: hot readings within FIRING_WINDOW_S of each other are always the same firing.
"""

import math
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import Integer, cast, func
from sqlalchemy.orm import Session

from app.kiln_weather import get_outdoor_forecast_c
from app.models import KilnFiring, KilnReading


def fahrenheit_to_celsius(temp_f: float) -> float:
    """
    Converts to the Celsius the kiln tables store.

    Args:
        temp_f: Temperature in Fahrenheit.

    Returns:
        float: The temperature in Celsius.
    """
    return (temp_f - 32) / 1.8


# a firing starts above the first. a probe still in the kiln at the end drops below the
# second. they're apart so a kiln hovering near one temperature can't flip back and forth
FIRING_START_C = fahrenheit_to_celsius(150)
FIRING_END_C = fahrenheit_to_celsius(120)
# hot readings this close together are one firing, even if it's been marked finished. a
# longer gap than this means a new firing, since a firing never goes a day without data
FIRING_WINDOW_S = 24 * 60 * 60
# this long without a temperature means the probe's been pulled, so the firing finishes at
# its last real reading. if it was only a long outage, the next hot reading picks it back up
FIRING_IDLE_S = 6 * 60 * 60

# past this long without a reading, the logger counts as offline
LOGGER_ONLINE_WINDOW_S = 60
RATE_WINDOW_30M_S = 30 * 60
RATE_WINDOW_60M_S = 60 * 60
# how far a reading can be before the window's start and still count as its start
RATE_MAX_SKEW_S = 5 * 60
# with no reading at the window's start, like when the probe was out then, the rate comes from
# whatever's inside the window, if that covers at least this much of it
RATE_MIN_WINDOW_FRACTION = 1 / 3
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
    lookback_start = recorded_at - timedelta(seconds=FIRING_WINDOW_S)
    last_reading = db.query(func.max(KilnFiring.last_reading_at)).scalar()
    if last_reading is not None:
        lookback_start = max(lookback_start, last_reading)
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


def _apply_reading(firing: KilnFiring, recorded_at: datetime, temp_c: float) -> None:
    """
    Adds a reading to a firing that's in progress, finishing it if the kiln's cold.

    Args:
        firing: The firing.
        recorded_at: When the reading was taken.
        temp_c: The temperature.
    """
    firing.last_reading_at = recorded_at
    if temp_c > firing.peak_c:
        firing.peak_c = temp_c
        firing.peak_at = recorded_at
    if temp_c < FIRING_END_C:
        firing.ended_at = recorded_at


def track_firings(db: Session, readings: list[tuple[datetime, Optional[float]]]) -> None:
    """
    Updates firings for newly stored readings. The caller commits.

    Args:
        db: Database session.
        readings: (recorded_at, thermocouple_c) of each new reading. Already flushed to
            the database, since starting a firing looks at them.
    """
    firing = db.query(KilnFiring).order_by(KilnFiring.started_at.desc()).first()
    for recorded_at, temp_c in sorted(readings, key=lambda reading: reading[0]):
        # faults mean no temperature, and don't say anything about the firing either way
        if temp_c is None:
            continue
        in_window = firing is not None and recorded_at - firing.last_reading_at <= timedelta(seconds=FIRING_WINDOW_S)
        if firing is not None and firing.ended_at is None and not in_window:
            firing.ended_at = firing.last_reading_at
        if temp_c >= FIRING_START_C and in_window and firing.ended_at is not None:
            firing.ended_at = None
        if in_window and firing.ended_at is None:
            _apply_reading(firing, recorded_at, temp_c)
        elif temp_c >= FIRING_START_C and not in_window:
            db.flush()
            firing = _open_firing(db, recorded_at)
            db.flush()


def close_idle_firings(db: Session) -> None:
    """
    Finishes a firing that hasn't had a temperature in a while, and commits.

    Pulling the probe leaves no cold reading to end the firing on, and the logger may not
    be sending anything at all, so this runs when the firing is next looked at too.

    Args:
        db: Database session.
    """
    idle_since = utc_now_naive() - timedelta(seconds=FIRING_IDLE_S)
    firing = db.query(KilnFiring).filter(KilnFiring.ended_at.is_(None), KilnFiring.last_reading_at < idle_since).first()
    if firing is not None:
        firing.ended_at = firing.last_reading_at
        db.commit()


def _rise_rate_c_per_h(db: Session, latest: KilnReading, window_s: int) -> Optional[float]:
    """
    Works out how fast the temperature's been changing over a recent window.

    Args:
        db: Database session.
        latest: The newest reading that has a temperature.
        window_s: How far back to compare against.

    Returns:
        Optional[float]: Degrees C per hour, negative when cooling. None if there's too
            little data in the window to go on.
    """
    window_start = latest.recorded_at - timedelta(seconds=window_s)
    has_temp = db.query(KilnReading).filter(KilnReading.thermocouple_c.isnot(None))
    older = (
        has_temp.filter(KilnReading.recorded_at <= window_start)
        .order_by(KilnReading.recorded_at.desc())
        .first()
    )
    if older is None or (window_start - older.recorded_at).total_seconds() > RATE_MAX_SKEW_S:
        older = (
            has_temp.filter(KilnReading.recorded_at > window_start)
            .order_by(KilnReading.recorded_at)
            .first()
        )
    elapsed_s = (latest.recorded_at - older.recorded_at).total_seconds()
    if elapsed_s < window_s * RATE_MIN_WINDOW_FRACTION:
        return None
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
    close_idle_firings(db)
    latest = db.query(KilnReading).order_by(KilnReading.recorded_at.desc()).first()
    firing = db.query(KilnFiring).filter(KilnFiring.ended_at.is_(None)).first()
    outdoor_forecast_c = get_outdoor_forecast_c() if firing is not None else None
    if latest is None:
        return {"online": False, "firing": firing, "outdoor_forecast_c": outdoor_forecast_c}
    online = (utc_now_naive() - latest.recorded_at).total_seconds() <= LOGGER_ONLINE_WINDOW_S
    has_live_temp = online and latest.thermocouple_c is not None
    return {
        "online": online,
        "last_reading_at": latest.recorded_at,
        "thermocouple_c": latest.thermocouple_c if has_live_temp else None,
        "fault_status": latest.fault_status,
        "rise_30m_c_per_h": _rise_rate_c_per_h(db, latest, RATE_WINDOW_30M_S) if has_live_temp else None,
        "rise_60m_c_per_h": _rise_rate_c_per_h(db, latest, RATE_WINDOW_60M_S) if has_live_temp else None,
        "outdoor_forecast_c": outdoor_forecast_c,
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
