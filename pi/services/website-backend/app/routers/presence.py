"""
Presence router -- who's home, for the admin page.

Two sides, two kinds of auth (see app/presence.py):

- agent (X-Presence-Token, the presence agent on fart-pi): push the latest snapshot
- admin (JWT): read who's home
"""

import hmac
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.config import settings
from app.dependencies import require_admin
from app.presence import store
from app.schemas import PresenceSnapshot, PresenceState

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/presence", tags=["Presence"])


def require_presence_agent(x_presence_token: str = Header(default="")) -> None:
    """
    Checks the shared secret the presence agent sends.

    Args:
        x_presence_token: The X-Presence-Token header.

    Raises:
        HTTPException: 503 if PRESENCE_TOKEN isn't configured, 401 if the token is wrong.
    """
    if not settings.PRESENCE_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="presence is off -- set PRESENCE_TOKEN in the backend's .env and restart it",
        )
    if not hmac.compare_digest(x_presence_token.encode(), settings.PRESENCE_TOKEN.encode()):
        logger.warning("presence: agent request with a wrong X-Presence-Token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="wrong presence token -- it must match PRESENCE_TOKEN in the backend's .env",
        )


@router.get("", response_model=PresenceState, dependencies=[Depends(require_admin)])
async def get_presence() -> dict:
    """
    Who's home right now. Admin only.

    Returns:
        dict: Each person, when their phone last answered, and whether that counts as
            home, plus whether the agent's checking in (PresenceState).
    """
    return store.state()


@router.put("/agent", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_presence_agent)])
async def put_snapshot(snapshot: PresenceSnapshot) -> None:
    """
    Store the agent's latest snapshot, pushed after every scan.

    Args:
        snapshot: When the agent last saw each person.
    """
    store.set_snapshot([person.model_dump() for person in snapshot.people])
