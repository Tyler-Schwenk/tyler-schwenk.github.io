"""
Fly kills router -- the house fly kill counter on /flies.

No login: anyone can add a kill for anyone or take one back, so both writes are
rate limited per IP. Each kill is a row (see FlyKill), so counts are row counts and
taking one back deletes that person's newest kill.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FlyKill
from app.rate_limit import limiter
from app.schemas import FLY_KILLERS, FlyKiller, FlyKillerCount, FlyKillTally

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fly-kills", tags=["Fly Kills"])

# loose enough for a fly-swatting spree, tight enough that a script can't bury the pile
FLY_KILL_WRITE_RATE_LIMIT = "60/minute;1000/day"


def build_tally(db: Session) -> FlyKillTally:
    """
    Counts everyone's kills.

    Args:
        db: Database session.

    Returns:
        FlyKillTally: each person in FLY_KILLERS order (zero if they've got none yet)
            and the total.
    """
    rows = db.query(FlyKill.killer, func.count(FlyKill.id)).group_by(FlyKill.killer).all()
    counts = dict(rows)
    killers = [FlyKillerCount(killer=name, kills=counts.get(name, 0)) for name in FLY_KILLERS]
    return FlyKillTally(killers=killers, total=sum(entry.kills for entry in killers))


@router.get("", response_model=FlyKillTally)
async def get_fly_kills(db: Session = Depends(get_db)) -> FlyKillTally:
    """
    Everyone's fly kills.

    Args:
        db: Database session.

    Returns:
        FlyKillTally: the counts and the total.
    """
    return build_tally(db)


@router.post("/{killer}", response_model=FlyKillTally, status_code=status.HTTP_201_CREATED)
@limiter.limit(FLY_KILL_WRITE_RATE_LIMIT)
async def add_fly_kill(request: Request, killer: FlyKiller, db: Session = Depends(get_db)) -> FlyKillTally:
    """
    Logs a kill for someone.

    Args:
        request: Incoming request (the rate limiter needs it for the client IP).
        killer: Who got the fly.
        db: Database session.

    Returns:
        FlyKillTally: the counts after adding it.

    Raises:
        HTTPException: 422 if killer isn't in the house, 429 past the rate limit.
    """
    db.add(FlyKill(killer=killer))
    db.commit()
    return build_tally(db)


@router.delete("/{killer}", response_model=FlyKillTally)
@limiter.limit(FLY_KILL_WRITE_RATE_LIMIT)
async def remove_fly_kill(request: Request, killer: FlyKiller, db: Session = Depends(get_db)) -> FlyKillTally:
    """
    Takes back someone's newest kill, for misclicks.

    Args:
        request: Incoming request (the rate limiter needs it for the client IP).
        killer: Whose kill to take back.
        db: Database session.

    Returns:
        FlyKillTally: the counts after removing it.

    Raises:
        HTTPException: 409 if they have no kills to take back, 422 if killer isn't in
            the house, 429 past the rate limit.
    """
    newest = (
        db.query(FlyKill)
        .filter(FlyKill.killer == killer)
        .order_by(FlyKill.id.desc())
        .first()
    )
    if newest is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{killer} has no fly kills to take back -- the count's already zero",
        )
    # read before the commit expires the deleted row
    killed_at = newest.killed_at
    db.delete(newest)
    db.commit()
    logger.info(f"fly kills: took back {killer}'s kill from {killed_at}")
    return build_tally(db)
