"""
DJ room router -- who's in the opium den's live room during a live set.

The live room shows a little character for everyone in it, standing under the set's
loudness trace with their chat name over their head. It's only open while the stream's
live. A browser picks a name and a look (one of the free characters, or a photo it
uploads) to come in, then checks in with them every few seconds (POST /dj/room) and gets
the room back; anyone who stops checking in drops out (app/dj_room.py). GET /dj/room shows
who's in without coming in, so the way in can grey out the characters that are taken.
Coming in also claims the name for the set the same way sending a chat message does, so
nobody can take it out from under you before you've said anything.

Every stay is saved as a visit (dj_room_visits, plus dj_room_visit_photos for a photo), so
a recorded set's page can show who was in the room at each point as it replays
(GET /dj/sets/{id}/people, routers/dj.py). The admin can list and remove uploaded photos.
"""

import logging
from dataclasses import asdict
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import require_admin
from app.dj_room import CheckIn, RoomFullError, RoomLookTakenError, RoomNameTakenError, hash_key, live_room
from app.dj_stream import watcher
from app.image_utils import delete_photo_files, store_photo
from app.models import DjRoomPhoto, DjRoomVisit, DjRoomVisitPhoto
from app.rate_limit import limiter
from app.routers.dj_chat import claim_nickname, utc_now
from app.schemas import (
    MAX_DJ_CHAT_OWNER_KEY_LENGTH,
    MIN_DJ_CHAT_OWNER_KEY_LENGTH,
    DjRoom,
    DjRoomCheckIn,
    DjRoomLeave,
    DjRoomPerson,
    DjRoomPhotoRead,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dj/room", tags=["DJ"])

# per visitor IP. a check-in every 15 s is 4 a minute, so this leaves room for a few
# people on one network and name changes, not for hammering the pi
ROOM_CHECK_IN_RATE_LIMIT = "30/minute"
# per visitor IP. enough to try a few pictures, not to fill the ssd
ROOM_PHOTO_RATE_LIMIT = "6/minute;30/hour"
# a phone photo is a few MB. the room only ever shows its thumbnail
MAX_ROOM_PHOTO_BYTES = 15 * 1024 * 1024
BYTES_PER_MB = 1024 * 1024
ROOM_PHOTOS_SUBDIR = "room-photos"
# the site asks for a photo by its id, and ids are never reused, so a url never changes
ROOM_PHOTO_CACHE_CONTROL = "public, max-age=31536000, immutable"
# the admin list shows this many of the latest uploads
MAX_LISTED_ROOM_PHOTOS = 200
OFF_AIR_DETAIL = "the room's closed while the stream's off air -- it opens when the next set starts"


def room_photos_dir() -> Path:
    """
    Where room photos are kept.

    Returns:
        Path: DJ_SETS_DIR/room-photos.
    """
    return Path(settings.DJ_SETS_DIR) / ROOM_PHOTOS_SUBDIR


def require_live() -> None:
    """
    Turns requests away while the stream's off air, since the room's closed then.

    Raises:
        HTTPException: 409 off air.
    """
    if not watcher.live:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=OFF_AIR_DETAIL)


def current_room() -> DjRoom:
    """
    The room as the page shows it.

    Returns:
        DjRoom: Everyone in it, in arrival order.
    """
    return DjRoom(
        people=[
            DjRoomPerson(nickname=person.nickname, avatar=person.avatar, photo_id=person.photo_id)
            for person in live_room.people()
        ]
    )


def check_own_photo(db: Session, photo_id: int, owner_key: str) -> None:
    """
    Makes sure a photo someone's coming in as exists and is theirs.

    Args:
        db: Database session.
        photo_id: The photo.
        owner_key: The browser's secret key.

    Raises:
        HTTPException: 403 if it's gone (the admin removed it) or someone else's.
    """
    photo = db.get(DjRoomPhoto, photo_id)
    if photo is None or photo.owner_key_hash != hash_key(owner_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="that picture's not available any more -- pick a character or upload another",
        )


def record_visit(db: Session, check_in: CheckIn) -> None:
    """
    Saves a check-in to the person's visit: a new row (and its photo, if they're one)
    when they've just come in or changed their name or look, otherwise their visit's
    last_seen_at moves up to now. Commits.

    Args:
        db: Database session.
        check_in: What the check-in did.

    Side effects:
        Inserts or updates dj_room_visits (and dj_room_visit_photos) rows, and sets the
        person's visit_id on a new one.
    """
    now = utc_now()
    person = check_in.person
    visit = None if check_in.new_visit or person.visit_id is None else db.get(DjRoomVisit, person.visit_id)
    if visit is not None:
        visit.last_seen_at = now
        db.commit()
        return
    visit = DjRoomVisit(nickname=person.nickname, avatar=person.avatar, joined_at=now, last_seen_at=now)
    db.add(visit)
    db.flush()
    if person.photo_id is not None:
        db.add(DjRoomVisitPhoto(visit_id=visit.id, photo_id=person.photo_id))
    db.commit()
    person.visit_id = visit.id


@router.get("", response_model=DjRoom)
async def get_room() -> DjRoom:
    """
    Who's in the room right now, without coming in: for the way in, to show which
    characters are taken. Empty off air.

    Returns:
        DjRoom: Everyone in it, in arrival order.
    """
    return current_room()


@router.post("", response_model=DjRoom)
@limiter.limit(ROOM_CHECK_IN_RATE_LIMIT)
async def check_in(request: Request, check_in: DjRoomCheckIn, db: Session = Depends(get_db)) -> DjRoom:
    """
    Puts this browser in the room under its name and look (or keeps it there), saves it
    to their visit, and returns the room.

    Args:
        request: Incoming request (the rate limiter keys on its IP).
        check_in: The chat name, the look asked for, and the browser's owner key.
        db: Database session, for claiming the name, checking the photo and saving the visit.

    Returns:
        DjRoom: Everyone in the room, this browser included.

    Raises:
        HTTPException: 409 off air; 403 when someone else has the name (in the room, or
            this set's chat) or the character, or the photo's gone or not theirs; 503
            when the room's full; 429 past the rate limit.
    """
    require_live()
    if check_in.photo_id is not None:
        check_own_photo(db, check_in.photo_id, check_in.owner_key)
    claim_nickname(db, check_in.nickname, check_in.owner_key)
    db.commit()
    try:
        result = live_room.check_in(check_in.nickname, check_in.owner_key, check_in.avatar, check_in.photo_id)
    except RoomNameTakenError as err:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"someone in the room is already called {check_in.nickname} -- pick another name",
        ) from err
    except RoomLookTakenError as err:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="someone in the room just took that character -- pick another one",
        ) from err
    except RoomFullError as err:
        logger.warning("dj room: full, turned someone away")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="the room's full right now -- you can still listen from the live section",
        ) from err
    record_visit(db, result)
    return current_room()


@router.post("/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave(leave: DjRoomLeave, db: Session = Depends(get_db)) -> None:
    """
    Takes this browser out of the room right away, for when the page closes, instead of
    waiting for its check-ins to time out. Their visit ends now.

    Args:
        leave: The browser's owner key.
        db: Database session, for ending the visit.
    """
    person = live_room.leave(leave.owner_key)
    if person is None or person.visit_id is None:
        return
    visit = db.get(DjRoomVisit, person.visit_id)
    if visit is not None:
        visit.last_seen_at = utc_now()
        db.commit()


@router.post("/photos", response_model=DjRoomPhotoRead, status_code=status.HTTP_201_CREATED)
@limiter.limit(ROOM_PHOTO_RATE_LIMIT)
def upload_photo(
    request: Request,
    file: UploadFile = File(...),
    owner_key: str = Form(..., min_length=MIN_DJ_CHAT_OWNER_KEY_LENGTH, max_length=MAX_DJ_CHAT_OWNER_KEY_LENGTH),
    db: Session = Depends(get_db),
) -> DjRoomPhoto:
    """
    Uploads a picture to stand in the room as, instead of a character. Only while live.
    HEIC and sideways phone photos get converted like gallery uploads. Coming in as it is
    a separate check-in with its id.

    Args:
        request: Incoming request (the rate limiter keys on its IP).
        file: The image.
        owner_key: The uploading browser's secret key, which owns the photo.
        db: Database session.

    Returns:
        DjRoomPhoto: The stored photo, with its id.

    Raises:
        HTTPException: 409 off air, 413 if it's too big, 400 if it isn't an image, 429
            past the rate limit.

    Side effects:
        Saves the image and a thumbnail under DJ_SETS_DIR/room-photos.
    """
    require_live()
    content = file.file.read(MAX_ROOM_PHOTO_BYTES + 1)
    if len(content) > MAX_ROOM_PHOTO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"that picture's over {MAX_ROOM_PHOTO_BYTES // BYTES_PER_MB} MB -- pick a smaller one",
        )
    stored = store_photo(room_photos_dir(), "photos", content, file.filename or "photo")
    fields = asdict(stored)
    # the photo row has no column for it
    fields.pop("file_size")
    photo = DjRoomPhoto(**fields, owner_key_hash=hash_key(owner_key), created_at=utc_now())
    db.add(photo)
    db.commit()
    db.refresh(photo)
    logger.info(f"dj room: new photo {photo.id}")
    return photo


@router.get("/photos/{photo_id}")
def get_photo(photo_id: int, db: Session = Depends(get_db)) -> FileResponse:
    """
    A room photo's thumbnail (or the full image if there's no thumbnail), cached for good.

    Args:
        photo_id: The photo.
        db: Database session.

    Returns:
        FileResponse: The image.

    Raises:
        HTTPException: 404 if there's no such photo (or it's been removed), or its file's missing.
    """
    photo = db.get(DjRoomPhoto, photo_id)
    if photo is None:
        raise HTTPException(status_code=404, detail=f"no room photo with id {photo_id}")
    path = room_photos_dir() / (photo.thumbnail_path or photo.file_path)
    if not path.exists():
        logger.error(f"dj room: photo {photo_id} is missing at {path}")
        raise HTTPException(status_code=404, detail=f"room photo {photo_id}'s file is missing on the pi")
    return FileResponse(path, media_type=photo.mime_type, headers={"Cache-Control": ROOM_PHOTO_CACHE_CONTROL})


@router.get("/photos", response_model=list[DjRoomPhotoRead], dependencies=[Depends(require_admin)])
def list_photos(db: Session = Depends(get_db)) -> list[DjRoomPhoto]:
    """
    The latest uploaded room photos, newest first (admin only), for removing any that
    shouldn't be up.

    Args:
        db: Database session.

    Returns:
        list[DjRoomPhoto]: Up to MAX_LISTED_ROOM_PHOTOS of them.
    """
    return db.query(DjRoomPhoto).order_by(DjRoomPhoto.id.desc()).limit(MAX_LISTED_ROOM_PHOTOS).all()


@router.delete("/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def delete_photo(photo_id: int, db: Session = Depends(get_db)) -> None:
    """
    Removes a room photo (admin only): off whoever's standing in as it now, out of every
    replay (those stays show a character instead), and off the disk.

    Args:
        photo_id: The photo.
        db: Database session.

    Raises:
        HTTPException: 401 without a valid admin token, 404 if there's no such photo.
    """
    photo = db.get(DjRoomPhoto, photo_id)
    if photo is None:
        raise HTTPException(status_code=404, detail=f"no room photo with id {photo_id}")
    db.query(DjRoomVisitPhoto).filter(DjRoomVisitPhoto.photo_id == photo_id).delete()
    delete_photo_files(room_photos_dir(), photo.file_path, photo.thumbnail_path)
    db.delete(photo)
    db.commit()
    live_room.drop_photo(photo_id)
    logger.info(f"dj room: removed photo {photo_id}")
