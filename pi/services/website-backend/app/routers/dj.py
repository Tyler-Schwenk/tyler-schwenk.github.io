"""
DJ router -- the live dj stream and its recorded sets, for the Opium Den page.

The stream itself comes from icecast on the pi's LAN (pi/services/dj-stream). /dj/live
relays it so listeners reach it through the existing tunnel without icecast ever being
public. Recording and live state live in app/dj_stream.py, waveforms in
app/dj_waveform.py. Each set also has its chat: the live room's messages from while it was
recording, placed on its timeline so the set page can replay them. Reads are public;
renaming and deleting sets are admin only.
"""

import logging
from collections.abc import AsyncIterator
from datetime import timedelta
from pathlib import Path

import anyio
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.dj_stream import STATUS_TIMEOUT_S, stream_url, watcher
from app.dj_waveform import WaveformError, get_waveform, waveform_path
from app.file_streaming import ranged_file_response
from app.models import DjChatMessage, DjSet
from app.schemas import DjSetChatMessage, DjSetRead, DjSetUpdate, DjSetWaveform, DjStreamStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dj", tags=["DJ"])

# each listener is one ~192 kbps stream through the pi's upload and the tunnel. well past
# any realistic crowd, but it stops a script from opening hundreds
MAX_LIVE_LISTENERS = 25
SET_MEDIA_TYPE = "audio/mpeg"
# listeners hear the stream roughly 5-15 s behind the decks (see dj-stream.md), so a
# message reacts to whatever was in the recording about this long before it was sent
LISTENER_LAG_S = 8


def set_audio_path(dj_set: DjSet) -> Path:
    """
    A set's mp3, checked to be on disk.

    Args:
        dj_set: The set.

    Returns:
        Path: The mp3.

    Raises:
        HTTPException: 404 if the file's gone.
    """
    path = Path(dj_set.file_path)
    if not path.exists():
        logger.error(f"dj sets: set {dj_set.id}'s file {path} is missing from disk")
        raise HTTPException(status_code=404, detail=f"dj set {dj_set.id}'s recording is missing on the pi")
    return path


def place_on_timeline(message: DjChatMessage, dj_set: DjSet) -> DjSetChatMessage:
    """
    Works out where in a set's recording a chat message belongs.

    Args:
        message: A message sent while the set was live.
        dj_set: The finished set.

    Returns:
        DjSetChatMessage: The message with offset_s, kept between the set's start and end.
    """
    sent_after_s = (message.created_at - dj_set.started_at).total_seconds()
    offset_s = min(max(sent_after_s - LISTENER_LAG_S, 0), dj_set.duration_s)
    return DjSetChatMessage(
        id=message.id,
        nickname=message.nickname,
        content=message.content,
        created_at=message.created_at,
        offset_s=offset_s,
    )


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
    path = set_audio_path(get_finished_set(db, set_id))
    return ranged_file_response(path, SET_MEDIA_TYPE, request.headers.get("range"))


@router.get("/sets/{set_id}", response_model=DjSetRead)
async def get_set(set_id: int, db: Session = Depends(get_db)) -> DjSet:
    """
    One finished set, for its own page.

    Args:
        set_id: The set's id.
        db: Database session.

    Returns:
        DjSet: The set.

    Raises:
        HTTPException: 404 if there's no such set, or it's still recording.
    """
    return get_finished_set(db, set_id)


@router.get("/sets/{set_id}/chat", response_model=list[DjSetChatMessage])
async def get_set_chat(set_id: int, db: Session = Depends(get_db)) -> list[DjSetChatMessage]:
    """
    The live room's chat from while a set was on, each message placed on the set's
    timeline, so it can replay as the recording plays. Messages deleted by the admin are
    gone from here too.

    Args:
        set_id: The set's id.
        db: Database session.

    Returns:
        list[DjSetChatMessage]: Oldest first, with offset_s into the recording.

    Raises:
        HTTPException: 404 if there's no such finished set.
    """
    dj_set = get_finished_set(db, set_id)
    # the last few seconds of the set reach listeners after it ends, and they can still
    # react to it while the room's poll catches up on the stream being over
    window_end = dj_set.ended_at + timedelta(seconds=LISTENER_LAG_S)
    messages = (
        db.query(DjChatMessage)
        .filter(DjChatMessage.created_at >= dj_set.started_at, DjChatMessage.created_at <= window_end)
        .order_by(DjChatMessage.id)
        .all()
    )
    return [place_on_timeline(message, dj_set) for message in messages]


@router.get("/sets/{set_id}/waveform", response_model=DjSetWaveform)
async def get_set_waveform(set_id: int, db: Session = Depends(get_db)) -> DjSetWaveform:
    """
    A set's waveform: its loudness in about a thousand even slices. Worked out when the
    set finishes, or on the first request (a few seconds) for one that predates that.

    Args:
        set_id: The set's id.
        db: Database session.

    Returns:
        DjSetWaveform: The peaks, each 0 to 1.

    Raises:
        HTTPException: 404 if the set or its file is missing, 500 if ffmpeg can't read the mp3.
    """
    dj_set = get_finished_set(db, set_id)
    path = set_audio_path(dj_set)
    try:
        peaks = await get_waveform(path, dj_set.duration_s)
    except WaveformError as err:
        logger.error(f"dj sets: no waveform for set {set_id} ({err})")
        raise HTTPException(
            status_code=500,
            detail=f"couldn't work out set {set_id}'s waveform, ffmpeg can't read its mp3 -- check the backend logs",
        ) from err
    return DjSetWaveform(peaks=peaks)


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
        Removes the mp3 and its cached waveform from disk. Its chat stays, like the rest
        of the room's history.
    """
    dj_set = get_finished_set(db, set_id)
    path = Path(dj_set.file_path)
    path.unlink(missing_ok=True)
    waveform_path(path).unlink(missing_ok=True)
    db.delete(dj_set)
    db.commit()
    logger.info(f"dj sets: deleted set {set_id} ({path.name})")
