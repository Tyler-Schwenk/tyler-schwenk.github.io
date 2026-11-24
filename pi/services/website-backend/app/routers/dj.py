"""
DJ router -- the live dj stream and its recorded sets, for the Opium Den's live section.

The stream itself comes from icecast on the pi's LAN (pi/services/dj-stream). /dj/live
relays it so listeners reach it through the existing tunnel without icecast ever being
public. Recording and live state live in app/dj_stream.py, waveforms in
app/dj_waveform.py, and the live set's loudness (/dj/live/trace) in app/dj_live_meter.py.
Each set also has its chat: the live room's messages from while it was
recording, placed on its timeline so the set page can replay them, and can have a cover
image, uploaded while it's still recording or any time after. Reads are public; renaming,
deleting and setting cover images are admin only.
"""

import logging
from collections.abc import AsyncIterator
from dataclasses import asdict
from datetime import timedelta
from pathlib import Path

import anyio
import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.dj_stream import STATUS_TIMEOUT_S, delete_set_image_files, set_images_dir, stream_url, watcher
from app.dj_waveform import WaveformError, get_waveform, waveform_path
from app.file_streaming import ranged_file_response
from app.image_utils import store_photo
from app.models import DjChatMessage, DjSet, DjSetImage
from app.schemas import (
    DjLiveTrace,
    DjSetChatMessage,
    DjSetImageRead,
    DjSetRead,
    DjSetUpdate,
    DjSetWaveform,
    DjStreamStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dj", tags=["DJ"])

# each listener is one ~192 kbps stream through the pi's upload and the tunnel. well past
# any realistic crowd, but it stops a script from opening hundreds
MAX_LIVE_LISTENERS = 25
SET_MEDIA_TYPE = "audio/mpeg"
# listeners hear the stream roughly 5-15 s behind the decks (see dj-stream.md), so a
# message reacts to whatever was in the recording about this long before it was sent
LISTENER_LAG_S = 8
# a phone photo is a few MB. room for big ones without letting one fill the ssd
MAX_SET_IMAGE_BYTES = 40 * 1024 * 1024
BYTES_PER_MB = 1024 * 1024
# the site asks for an image by its id (?v=), and a new upload gets a new id, so a given
# url never changes and browsers and cloudflare can hang on to it
SET_IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable"


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


def get_any_set(db: Session, set_id: int) -> DjSet:
    """
    Looks up a set, finished or still recording.

    Args:
        db: Database session.
        set_id: The set's id.

    Returns:
        DjSet: The set.

    Raises:
        HTTPException: 404 if there's no such set.
    """
    dj_set = db.get(DjSet, set_id)
    if dj_set is None:
        raise HTTPException(status_code=404, detail=f"no dj set with id {set_id}")
    return dj_set


@router.get("/status", response_model=DjStreamStatus)
async def get_stream_status(db: Session = Depends(get_db)) -> DjStreamStatus:
    """
    Whether the stream's on air right now. Updated every few seconds, so it's cheap to poll.

    Args:
        db: Database session, for the recording set's cover image.

    Returns:
        DjStreamStatus: live, since when, how many are listening through /dj/live, and the
            set being recorded with its cover image's id.
    """
    stream_status = watcher.status()
    if stream_status.set_id is not None:
        recording = db.get(DjSet, stream_status.set_id)
        stream_status.image_id = recording.image_id if recording else None
    return stream_status


@router.get("/live/trace", response_model=DjLiveTrace)
async def get_live_trace() -> DjLiveTrace:
    """
    The live set's loudness so far, a bar per stretch of it, for the live monitor's trace.
    Measured as it streams (app/dj_live_meter.py), so it's cheap to poll. Off air, or in
    the first second or two of a set, there are no bars yet.

    Returns:
        DjLiveTrace: whether it's live, how long each bar covers, and the bars.
    """
    if not watcher.live:
        return DjLiveTrace(live=False, interval_s=0, peaks=[])
    interval_s, peaks = watcher.meter.trace()
    return DjLiveTrace(live=True, interval_s=interval_s, peaks=peaks)


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
        Removes the mp3, its cached waveform and its cover image from disk. Its chat stays,
        like the rest of the room's history.
    """
    dj_set = get_finished_set(db, set_id)
    path = Path(dj_set.file_path)
    path.unlink(missing_ok=True)
    waveform_path(path).unlink(missing_ok=True)
    delete_set_image_files(dj_set.image)
    db.delete(dj_set)
    db.commit()
    logger.info(f"dj sets: deleted set {set_id} ({path.name})")


@router.put(
    "/sets/{set_id}/image",
    response_model=DjSetImageRead,
    dependencies=[Depends(require_admin)],
)
def upload_set_image(set_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)) -> DjSetImage:
    """
    Sets a set's cover image (admin only), replacing any it had. Works while the set's
    still recording too. HEIC and sideways phone photos get converted like gallery uploads.

    Args:
        set_id: The set's id.
        file: The image.
        db: Database session.

    Returns:
        DjSetImage: The new image. Its id is new, which is what busts the site's caches.

    Raises:
        HTTPException: 401 without a valid admin token, 404 if there's no such set, 413 if
            the file's too big, 400 if it isn't an image.

    Side effects:
        Saves the image and a thumbnail under DJ_SETS_DIR/images, and deletes the old ones.
    """
    dj_set = get_any_set(db, set_id)
    content = file.file.read(MAX_SET_IMAGE_BYTES + 1)
    if len(content) > MAX_SET_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"{file.filename} is over {MAX_SET_IMAGE_BYTES // BYTES_PER_MB} MB -- shrink it or pick a smaller one",
        )
    stored = store_photo(set_images_dir(), f"set_{set_id}", content, file.filename or "cover")
    fields = asdict(stored)
    # the image row has no column for it
    fields.pop("file_size")

    if dj_set.image is not None:
        delete_set_image_files(dj_set.image)
        dj_set.image = None
        # the old row has to be gone before the new one goes in, set_id is unique
        db.flush()
    image = DjSetImage(**fields)
    dj_set.image = image
    db.commit()
    db.refresh(image)
    logger.info(f"dj sets: set {set_id} has a new cover image ({image.id})")
    return image


@router.delete("/sets/{set_id}/image", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def delete_set_image(set_id: int, db: Session = Depends(get_db)) -> None:
    """
    Takes a set's cover image off (admin only). Does nothing if it hasn't got one.

    Args:
        set_id: The set's id.
        db: Database session.

    Raises:
        HTTPException: 401 without a valid admin token, 404 if there's no such set.

    Side effects:
        Deletes the image and its thumbnail from disk.
    """
    dj_set = get_any_set(db, set_id)
    if dj_set.image is None:
        return
    delete_set_image_files(dj_set.image)
    dj_set.image = None
    db.commit()
    logger.info(f"dj sets: removed set {set_id}'s cover image")


@router.get("/sets/{set_id}/image")
def get_set_image(set_id: int, thumbnail: bool = False, db: Session = Depends(get_db)) -> FileResponse:
    """
    A set's cover image, or its thumbnail. The site adds ?v=<image id> so each upload gets
    its own url, which is why it can be cached for good.

    Args:
        set_id: The set's id.
        thumbnail: Serve the thumbnail (about 400 px) instead, if there is one.
        db: Database session.

    Returns:
        FileResponse: The image.

    Raises:
        HTTPException: 404 if there's no such set, it has no image, or the file's missing.
    """
    image = get_any_set(db, set_id).image
    if image is None:
        raise HTTPException(status_code=404, detail=f"dj set {set_id} has no cover image")
    relative_path = image.thumbnail_path if thumbnail and image.thumbnail_path else image.file_path
    path = set_images_dir() / relative_path
    if not path.exists():
        logger.error(f"dj sets: set {set_id}'s cover image is missing at {path}")
        raise HTTPException(
            status_code=404,
            detail=f"dj set {set_id}'s cover image is missing on the pi -- upload it again from the admin page",
        )
    return FileResponse(path, media_type=image.mime_type, headers={"Cache-Control": SET_IMAGE_CACHE_CONTROL})
