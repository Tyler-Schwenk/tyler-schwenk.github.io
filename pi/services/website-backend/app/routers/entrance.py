"""
Entrance song router -- plays the song on the big speakers from the admin page.

See app/entrance.py and pi/docs/services/entrance-song.md.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import require_admin
from app.entrance import EntranceUnavailableError, SpeakersBusyError, player
from app.schemas import EntranceStatus

router = APIRouter(prefix="/entrance", tags=["Entrance Song"], dependencies=[Depends(require_admin)])


def _unavailable(error: EntranceUnavailableError) -> HTTPException:
    """
    Turns a playback failure into its http error.

    Args:
        error: What went wrong, with what to do about it.

    Returns:
        HTTPException: A 503 carrying the message.
    """
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error))


@router.get("/status", response_model=EntranceStatus)
async def get_status() -> dict:
    """
    Where the song is right now. Admin only.

    Returns:
        dict: Whether it's playing, how far in, and when the drop and the end are.

    Raises:
        HTTPException: 503 if the speaker agent can't be reached.
    """
    try:
        return await player.status()
    except EntranceUnavailableError as exc:
        raise _unavailable(exc) from exc


@router.post("/start", response_model=EntranceStatus)
async def start() -> dict:
    """
    Starts the song. Admin only. If it's already playing it carries on undisturbed.

    Returns:
        dict: The song's status once it's playing.

    Raises:
        HTTPException: 409 if another service has the speakers, 503 if it can't play at all.
    """
    try:
        await player.start()
        return await player.status()
    except SpeakersBusyError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except EntranceUnavailableError as exc:
        raise _unavailable(exc) from exc


@router.post("/stop", response_model=EntranceStatus)
async def stop() -> dict:
    """
    Cuts the song off. Admin only. Fine to call when nothing's playing.

    Returns:
        dict: The song's status, stopped.

    Raises:
        HTTPException: 503 if the speaker agent can't be reached.
    """
    try:
        await player.stop()
        return await player.status()
    except EntranceUnavailableError as exc:
        raise _unavailable(exc) from exc
