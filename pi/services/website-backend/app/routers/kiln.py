"""
Kiln router -- stores readings from the kiln logger on castpi and serves them back.

Two sides, two kinds of auth:

- logger (X-Kiln-Token, kiln-logger.service on castpi): store readings
- admin (JWT): read them

See pi/docs/services/kiln-logger.md.
"""

import hmac
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import require_admin
from app.models import KilnReading
from app.schemas import KilnBatchResult, KilnReadingBatch, KilnReadingRead

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/kiln", tags=["Kiln"])

DEFAULT_READINGS_LIMIT = 1000
MAX_READINGS_LIMIT = 20000


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
    Converts a datetime to the naive UTC form the kiln table stores.

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
    Stores a batch of readings. Safe to retry.

    The logger's Pi has no real-time clock, so readings carry their age and get their
    timestamp here. A reading that's already stored (same boot_id and seq) is skipped,
    keeping its first timestamp.

    Args:
        batch: The readings, from one boot of the logger.
        db: Database session.

    Returns:
        KilnBatchResult: How many were new and how many were already stored.
    """
    received_at = utc_naive(datetime.now(timezone.utc))
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
    statement = insert(KilnReading).values(rows).on_conflict_do_nothing(index_elements=["boot_id", "seq"])
    stored = db.execute(statement).rowcount
    db.commit()
    return KilnBatchResult(stored=stored, duplicates=len(rows) - stored)


@router.get("/latest", response_model=KilnReadingRead, dependencies=[Depends(require_admin)])
def get_latest_reading(db: Session = Depends(get_db)) -> KilnReading:
    """
    Gets the newest reading. Admin only.

    Args:
        db: Database session.

    Returns:
        KilnReadingRead: The newest reading.

    Raises:
        HTTPException: 404 if nothing's been logged yet.
    """
    reading = db.query(KilnReading).order_by(KilnReading.recorded_at.desc()).first()
    if reading is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="no kiln readings yet -- check kiln-logger.service on castpi",
        )
    return reading


@router.get("/readings", response_model=list[KilnReadingRead], dependencies=[Depends(require_admin)])
def get_readings(
    since: Optional[datetime] = Query(default=None, description="Only readings after this time"),
    limit: int = Query(default=DEFAULT_READINGS_LIMIT, ge=1, le=MAX_READINGS_LIMIT),
    db: Session = Depends(get_db),
) -> list[KilnReading]:
    """
    Gets the newest readings, oldest first. Admin only.

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
