"""
DJ router -- the live dj stream and its recorded sets, for the Opium Den page.

The stream itself comes from icecast on the pi's LAN (pi/services/dj-stream). /dj/live
relays it so listeners reach it through the existing tunnel without icecast ever being
public. Recording and live state live in app/dj_stream.py. Reads are public; renaming
and deleting sets are admin only.
"""

import logging
from collections.abc import AsyncIterator
from pathlib import Path

import anyio
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.dj_stream import STATUS_TIMEOUT_S, stream_url, watcher
from app.file_streaming import ranged_file_response
from app.models import DjSet
from app.schemas import DjSetRead, DjSetUpdate, DjStreamStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dj", tags=["DJ"])

# each listener is one ~192 kbps stream through the pi's upload and the tunnel. well past
# any realistic crowd, but it stops a script from opening hundreds
MAX_LIVE_LISTENERS = 25
SET_MEDIA_TYPE = "audio/mpeg"


def get_finished_set(db: Session, set_id: int) -> DjSet:
    """
    Looks up a set that's done recording.

    Args:
        db: Database session.
        set_id: The set's id.

    Returns:
        DjSet: The set.

    Raises:
        HTTPException: 404 if there's no such set, or it's still recording.
    """
    dj_set = db.get(DjSet, set_id)
    if dj_set is None or dj_set.ended_at is None:
        raise HTTPException(status_code=404, detail=f"no finished dj set with id {set_id}")
    return dj_set


@router.get("/status", response_model=DjStreamStatus)
async def get_stream_status() -> DjStreamStatus:
    """
    Whether the stream's on air right now. Updated every few seconds, so it's cheap to poll.

    Returns:
        DjStreamStatus: live, since when, and how many are listening through /dj/live.
    """
    return watcher.status()


@router.get("/live")
async def listen_live() -> StreamingResponse:
    """
    The live stream, relayed from icecast, for an <audio> element.

    Returns:
        StreamingResponse: An endless audio/mpeg stream until the set ends or the listener leaves.

    Raises:
        HTTPException: 503 when nothing's live, the listener cap is hit, or icecast won't serve it.
    """
    if not watcher.live:
        raise HTTPException(status_code=503, detail="the dj stream isn't live right now -- check /dj/status")
    if watcher.listeners >= MAX_LIVE_LISTENERS:
        raise HTTPException(
            status_code=503,
            detail=f"the stream's full ({MAX_LIVE_LISTENERS} listeners) -- try again in a bit",
        )

    # no read timeout: a live stream can go quiet between tracks without being over
    client = httpx.AsyncClient(timeout=httpx.Timeout(STATUS_TIMEOUT_S, read=None))
    try:
        upstream = await client.send(client.build_request("GET", stream_url()), stream=True)
    except httpx.HTTPError as err:
        await client.aclose()
        logger.warning(f"dj live: couldn't open the icecast stream at {stream_url()} ({err})")
        raise HTTPException(status_code=503, detail="couldn't reach the stream on the pi -- try again in a bit") from err

    if upstream.status_code != status.HTTP_200_OK:
        await upstream.aclose()
        await client.aclose()
        logger.warning(f"dj live: icecast answered {upstream.status_code} for {stream_url()}")
        raise HTTPException(status_code=503, detail="the stream just ended or hasn't started yet -- try again in a bit")

    async def relay() -> AsyncIterator[bytes]:
        """passes icecast's bytes along and keeps the listener count right, however it ends."""
        watcher.listeners += 1
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        finally:
            watcher.listeners -= 1
            # the listener leaving cancels this, and the cleanup awaits need to run anyway
            with anyio.CancelScope(shield=True):
                await upstream.aclose()
                await client.aclose()

    return StreamingResponse(
        relay(),
        media_type=SET_MEDIA_TYPE,
        headers={"Cache-Control": "no-store"},
    )


@router.get("/sets", response_model=list[DjSetRead])
async def list_sets(db: Session = Depends(get_db)) -> list[DjSet]:
    """
    Every finished set, newest first. One still recording isn't listed until it's done.

    Args:
        db: Database session.

    Returns:
        List[DjSet]: The sets.
    """
    return (
        db.query(DjSet)
        .filter(DjSet.ended_at.is_not(None))
        .order_by(DjSet.started_at.desc())
        .all()
    )


@router.get("/sets/{set_id}/audio")
async def get_set_audio(set_id: int, request: Request, db: Session = Depends(get_db)) -> Response:
    """
    A set's mp3, with range support so the player can seek.

    Args:
        set_id: The set's id.
        request: Incoming request (for its Range header).
        db: Database session.

    Returns:
        Response: The whole file, or the range asked for.

    Raises:
        HTTPException: 404 if the set or its file is missing, 416 for a bad range.
    """
    dj_set = get_finished_set(db, set_id)
    path = Path(dj_set.file_path)
    if not path.exists():
        logger.error(f"dj sets: set {set_id}'s file {path} is missing from disk")
        raise HTTPException(status_code=404, detail=f"dj set {set_id}'s recording is missing on the pi")
    return ranged_file_response(path, SET_MEDIA_TYPE, request.headers.get("range"))


@router.patch("/sets/{set_id}", response_model=DjSetRead, dependencies=[Depends(require_admin)])
async def update_set(set_id: int, update: DjSetUpdate, db: Session = Depends(get_db)) -> DjSet:
    """
    Edits a set's title and description (admin only). Only the fields sent change.

    Args:
        set_id: The set's id.
        update: The new title and/or description; blank or null clears one.
        db: Database session.

    Returns:
        DjSet: The updated set.

    Raises:
        HTTPException: 401 without a valid admin token, 404 if there's no such finished set.
    """
    dj_set = get_finished_set(db, set_id)
    for field in update.model_fields_set:
        value = (getattr(update, field) or "").strip()
        setattr(dj_set, field, value or None)
    db.commit()
    db.refresh(dj_set)
    return dj_set


@router.delete("/sets/{set_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def delete_set(set_id: int, db: Session = Depends(get_db)) -> None:
    """
    Deletes a set and its recording (admin only).

    Args:
        set_id: The set's id.
        db: Database session.

    Raises:
        HTTPException: 401 without a valid admin token, 404 if there's no such finished set.

    Side effects:
        Removes the mp3 from disk.
    """
    dj_set = get_finished_set(db, set_id)
    path = Path(dj_set.file_path)
    path.unlink(missing_ok=True)
    db.delete(dj_set)
    db.commit()
    logger.info(f"dj sets: deleted set {set_id} ({path.name})")
