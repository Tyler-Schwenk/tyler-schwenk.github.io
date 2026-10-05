"""
Display control router -- remote control of the display kiosk from the admin page.

Two sides, two kinds of auth (see app/display_control.py for how the relay works):

- admin (JWT): queue a press, long-poll what the kiosk is showing
- kiosk (X-Kiosk-Token, the surfcam agent on displaytop): long-poll for
  queued presses, push its key log
"""

import hmac
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from app.config import settings
from app.dependencies import require_admin
from app.display_control import relay
from app.schemas import (
    DisplayCommand,
    DisplayCommandBatch,
    DisplayControlLog,
    DisplayControlState,
    DisplayKeysQueued,
    DisplayKeysRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/display-control", tags=["Display Control"])


def require_kiosk(x_kiosk_token: str = Header(default="")) -> None:
    """
    Checks the shared secret the surfcam agent sends.

    Args:
        x_kiosk_token: The X-Kiosk-Token header.

    Raises:
        HTTPException: 503 if KIOSK_TOKEN isn't configured, 401 if the token is wrong.
    """
    if not settings.KIOSK_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="kiosk remote control is off -- set KIOSK_TOKEN in the backend's .env and restart it",
        )
    if not hmac.compare_digest(x_kiosk_token.encode(), settings.KIOSK_TOKEN.encode()):
        logger.warning("display control: kiosk request with a wrong X-Kiosk-Token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="wrong kiosk token -- it must match KIOSK_TOKEN in the backend's .env",
        )


@router.post("/keys", response_model=DisplayKeysQueued, dependencies=[Depends(require_admin)])
async def queue_keys(request: DisplayKeysRequest) -> DisplayKeysQueued:
    """
    Queue a remote press for the kiosk. Admin only.

    The keys are applied in order as one change, so e.g. `["escape", "1"]`
    goes back to the standard display and holds the photo without the screens
    showing anything in between.

    Args:
        request: The keys to press.

    Returns:
        DisplayKeysQueued: The queued command's id.
    """
    command_id = await relay.queue_keys(list(request.keys))
    logger.info(f"display control: queued {request.keys} as command {command_id}")
    return DisplayKeysQueued(id=command_id)


@router.get("/state", response_model=DisplayControlState, dependencies=[Depends(require_admin)])
async def get_state(after: int = Query(-1, description="Revision already seen; -1 answers at once")) -> dict:
    """
    What the kiosk is showing, long-polled. Admin only.

    Waits up to 25 s for the revision to differ from `after`, then answers
    either way, so the page can just call it again in a loop. Revisions start
    at 0, so -1 always answers at once.

    Args:
        after: The revision the caller already has.

    Returns:
        dict: The kiosk's latest key log and whether it's online (DisplayControlState).
    """
    return await relay.wait_for_state(after)


@router.get("/kiosk/commands", response_model=DisplayCommandBatch, dependencies=[Depends(require_kiosk)])
async def get_commands(after: int = Query(-1, description="Last command id handled; -1 on startup")) -> DisplayCommandBatch:
    """
    Queued presses for the kiosk, long-polled by the surfcam agent.

    Args:
        after: The cursor from the previous answer, or -1 when the agent starts.

    Returns:
        DisplayCommandBatch: The commands to run and the cursor to send next.
    """
    cursor, commands = await relay.wait_for_commands(after)
    return DisplayCommandBatch(
        cursor=cursor,
        commands=[DisplayCommand(id=c.id, keys=c.keys) for c in commands],
    )


@router.put("/kiosk/log", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_kiosk)])
async def put_log(log: DisplayControlLog) -> None:
    """
    Store the kiosk's key log, pushed by the surfcam agent whenever it changes.

    Args:
        log: The agent's whole log since its last reset.
    """
    await relay.set_kiosk_log(log.model_dump())
