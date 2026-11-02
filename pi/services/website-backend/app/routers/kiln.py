"""
Kiln router -- stores readings from the kiln logger on castpi and serves the kiln page.

Who can do what:

- logger (X-Kiln-Token, kiln-logger.service on castpi): store readings
- anyone: live status and firings, rate limited per IP (the kiln page is public)
- admin (JWT): raw readings

See pi/docs/services/kiln-logger.md.
"""

import hmac
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import require_admin
from app.kiln_firings import close_idle_firings, get_curve, get_status, track_firings, utc_now_naive
from app.models import KilnFiring, KilnReading
from app.rate_limit import limiter
from app.schemas import (
    KilnBatchResult,
    KilnFiringCurve,
    KilnFiringRead,
    KilnReadingBatch,
    KilnReadingRead,
    KilnStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/kiln", tags=["Kiln"])

DEFAULT_READINGS_LIMIT = 1000
MAX_READINGS_LIMIT = 20000
DEFAULT_CURVE_POINTS = 1500
MIN_CURVE_POINTS = 10
MAX_CURVE_POINTS = 3000
DEFAULT_FIRINGS_LIMIT = 24
MAX_FIRINGS_LIMIT = 200
# allows a page polling every endpoint every few seconds, plus its past firings' thumbnails
PUBLIC_READ_RATE_LIMIT = "240/minute"


def require_kiln_token(x_kiln_token: str = Header(default="")) -> None:
    """
    Checks the shared secret the kiln logger sends.

    Args:
        x_kiln_token: The X-Kiln-Token header.

    Raises:
        HTTPException: 503 if KILN_TOKEN isn't configured, 401 if the token is wrong.
    """
    if not settings.KILN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="kiln logging is off -- set KILN_TOKEN in the backend's .env and restart it",
        )
    if not hmac.compare_digest(x_kiln_token.encode(), settings.KILN_TOKEN.encode()):
        logger.warning("kiln: request with a wrong X-Kiln-Token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="wrong kiln token -- it must match KILN_TOKEN in the backend's .env",
        )


def utc_naive(moment: datetime) -> datetime:
    """
    Converts a datetime to the naive UTC form the kiln tables store.

    Args:
        moment: Any datetime. Naive ones are taken to already be UTC.

    Returns:
        datetime: The same moment, naive, in UTC.
    """
    if moment.tzinfo is None:
        return moment
    return moment.astimezone(timezone.utc).replace(tzinfo=None)


@router.post("/readings", response_model=KilnBatchResult, dependencies=[Depends(require_kiln_token)])
def store_readings(batch: KilnReadingBatch, db: Session = Depends(get_db)) -> KilnBatchResult:
    """
    Stores a batch of readings and updates firings. Safe to retry.

    The logger's Pi has no real-time clock, so readings carry their age and get their
    timestamp here. A reading that's already stored (same boot_id and seq) is skipped,
    keeping its first timestamp.

    Args:
        batch: The readings, from one boot of the logger.
        db: Database session.

    Returns:
        KilnBatchResult: How many were new and how many were already stored.
    """
    received_at = utc_now_naive()
    rows = [
        {
            "boot_id": batch.boot_id,
            "seq": reading.seq,
            "recorded_at": received_at - timedelta(seconds=reading.age_s),
            "thermocouple_c": reading.thermocouple_c,
            "cold_junction_c": reading.cold_junction_c,
            "fault_status": reading.fault_status,
        }
        for reading in batch.readings
    ]
    statement = (
        insert(KilnReading)
        .values(rows)
        .on_conflict_do_nothing(index_elements=["boot_id", "seq"])
        .returning(KilnReading.recorded_at, KilnReading.thermocouple_c)
    )
    stored = [tuple(row) for row in db.execute(statement).all()]
    db.flush()
    track_firings(db, stored)
    db.commit()
    return KilnBatchResult(stored=len(stored), duplicates=len(rows) - len(stored))


@router.get("/status", response_model=KilnStatus)
@limiter.limit(PUBLIC_READ_RATE_LIMIT)
def read_status(request: Request, db: Session = Depends(get_db)) -> dict:
    """
    Gets the live readout: current temperature, rates of rise, and any firing in progress.

    Args:
        request: Incoming request, used by the rate limiter.
        db: Database session.

    Returns:
        KilnStatus: The live readout.
    """
    return get_status(db)


@router.get("/firings", response_model=list[KilnFiringRead])
@limiter.limit(PUBLIC_READ_RATE_LIMIT)
def list_firings(
    request: Request,
    limit: int = Query(default=DEFAULT_FIRINGS_LIMIT, ge=1, le=MAX_FIRINGS_LIMIT),
    db: Session = Depends(get_db),
) -> list[KilnFiring]:
    """
    Lists firings, newest first, including one in progress.

    Args:
        request: Incoming request, used by the rate limiter.
        limit: The most firings to return.
        db: Database session.

    Returns:
        list[KilnFiringRead]: Firing summaries.
    """
    close_idle_firings(db)
    return db.query(KilnFiring).order_by(KilnFiring.started_at.desc()).limit(limit).all()


@router.get("/firings/{firing_id}/curve", response_model=KilnFiringCurve)
@limiter.limit(PUBLIC_READ_RATE_LIMIT)
def read_firing_curve(
    request: Request,
    firing_id: int,
    max_points: int = Query(default=DEFAULT_CURVE_POINTS, ge=MIN_CURVE_POINTS, le=MAX_CURVE_POINTS),
    db: Session = Depends(get_db),
) -> dict:
    """
    Gets one firing's summary and temperature curve.

    Args:
        request: Incoming request, used by the rate limiter.
        firing_id: The firing's id.
        max_points: The most points to return. Readings get averaged down to fit.
        db: Database session.

    Returns:
        KilnFiringCurve: The firing and its curve, oldest first.

    Raises:
        HTTPException: 404 if there's no firing with that id.
    """
    firing = db.get(KilnFiring, firing_id)
    if firing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"no kiln firing with id {firing_id}")
    return get_curve(db, firing, max_points)


@router.get("/readings", response_model=list[KilnReadingRead], dependencies=[Depends(require_admin)])
def get_readings(
    since: Optional[datetime] = Query(default=None, description="Only readings after this time"),
    limit: int = Query(default=DEFAULT_READINGS_LIMIT, ge=1, le=MAX_READINGS_LIMIT),
    db: Session = Depends(get_db),
) -> list[KilnReading]:
    """
    Gets the newest raw readings, oldest first. Admin only.

    Args:
        since: Only return readings after this time.
        limit: The most readings to return.
        db: Database session.

    Returns:
        list[KilnReadingRead]: The readings, oldest first.
    """
    query = db.query(KilnReading)
    if since is not None:
        query = query.filter(KilnReading.recorded_at > utc_naive(since))
    newest_first = query.order_by(KilnReading.recorded_at.desc()).limit(limit).all()
    return list(reversed(newest_first))
