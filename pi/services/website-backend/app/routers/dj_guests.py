"""
Guest DJs router -- the login guest djs use, their own profile, and their photo.

A guest dj streams to their own icecast mount (pi/docs/services/dj-stream.md, "Guest
DJs"), and the stream watcher tags those sets with them. From the site's /guest-dj page
they log in here, then edit their name, bio and photo, and (through routers/dj.py and
routers/dj_alerts.py) their own sets and live alerts. Logins are made with
scripts/create_dj_guest.py.

Who can do what:

- anyone: a guest's photo (it shows on their sets)
- the guest dj (JWT with the "dj" scope, from POST /dj/guests/login): their own profile and photo
"""

import logging
from dataclasses import asdict
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import DJ_GUEST_SCOPE, dj_guest_subject, require_dj_guest
from app.image_utils import delete_photo_files, store_photo
from app.models import DjGuest, DjGuestPhoto
from app.rate_limit import limiter
from app.routers.auth import create_access_token, verify_password
from app.schemas import DjGuestMe, DjGuestUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dj/guests", tags=["DJ"])

# slows down password guessing without getting in the way of someone mistyping
LOGIN_RATE_LIMIT = "5/minute"
# a phone photo is a few MB. room for big ones without letting one fill the ssd
MAX_GUEST_PHOTO_BYTES = 40 * 1024 * 1024
BYTES_PER_MB = 1024 * 1024
# guest photos sit next to the recordings, on the same ssd and mount
GUEST_PHOTOS_SUBDIR = "guest-photos"
# the site asks for a photo by its id (?v=), and a new upload gets a new id, so a given
# url never changes and can be cached for good
GUEST_PHOTO_CACHE_CONTROL = "public, max-age=31536000, immutable"


def guest_photos_dir() -> Path:
    """
    Where guest djs' photos are kept, a folder per guest.

    Returns:
        Path: DJ_SETS_DIR/guest-photos.
    """
    return Path(settings.DJ_SETS_DIR) / GUEST_PHOTOS_SUBDIR


def delete_guest_photo_files(photo: DjGuestPhoto | None) -> None:
    """
    Removes a guest's photo files from disk. The caller deletes (or replaces) the row.

    Args:
        photo: The photo, or None when they haven't got one (then this does nothing).
    """
    if photo is not None:
        delete_photo_files(guest_photos_dir(), photo.file_path, photo.thumbnail_path)


@router.post("/login")
@limiter.limit(LOGIN_RATE_LIMIT)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> dict:
    """
    Logs a guest dj in. The token only works for their own profile, sets and live alerts.

    Args:
        request: Incoming request, used by the rate limiter.
        form_data: OAuth2 password form, with username and password.
        db: Database session.

    Returns:
        dict: access_token and token_type, like POST /auth/login.

    Raises:
        HTTPException: 401 if the username or password is wrong, 403 if the login's turned off.
    """
    guest = db.query(DjGuest).filter(DjGuest.username == form_data.username.strip().lower()).first()
    # deliberately vague, so it doesn't say which usernames exist
    if guest is None or not verify_password(form_data.password, guest.hashed_password):
        logger.warning("dj guests: failed login")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="wrong username or password -- check both, or ask Tyler to reset it",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not guest.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="this dj login's been turned off -- ask Tyler if that's a mistake",
        )
    logger.info(f"dj guests: {guest.username} logged in")
    token = create_access_token(dj_guest_subject(guest.id), scope=DJ_GUEST_SCOPE)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=DjGuestMe)
def get_me(guest: DjGuest = Depends(require_dj_guest)) -> DjGuest:
    """
    The logged-in guest dj's profile, with their mount for butt.

    Args:
        guest: The guest, from their token.

    Returns:
        DjGuest: Their profile.
    """
    return guest


@router.patch("/me", response_model=DjGuestMe)
def update_me(
    update: DjGuestUpdate,
    guest: DjGuest = Depends(require_dj_guest),
    db: Session = Depends(get_db),
) -> DjGuest:
    """
    Edits the logged-in guest dj's name and bio. Only the fields sent change; a null
    name is ignored (it can't be cleared), a blank or null bio clears it.

    Args:
        update: The new name and/or bio.
        guest: The guest, from their token.
        db: Database session.

    Returns:
        DjGuest: The updated profile.
    """
    if "name" in update.model_fields_set and update.name is not None:
        guest.name = update.name
    if "bio" in update.model_fields_set:
        guest.bio = update.bio or None
    db.commit()
    db.refresh(guest)
    return guest


@router.put("/me/photo", response_model=DjGuestMe)
def upload_my_photo(
    file: UploadFile = File(...),
    guest: DjGuest = Depends(require_dj_guest),
    db: Session = Depends(get_db),
) -> DjGuest:
    """
    Sets the logged-in guest dj's photo, replacing any they had. HEIC and sideways phone
    photos get converted like gallery uploads.

    Args:
        file: The image.
        guest: The guest, from their token.
        db: Database session.

    Returns:
        DjGuest: Their profile, with the new photo's id.

    Raises:
        HTTPException: 413 if the file's too big, 400 if it isn't an image.

    Side effects:
        Saves the image and a thumbnail under DJ_SETS_DIR/guest-photos, and deletes the old ones.
    """
    content = file.file.read(MAX_GUEST_PHOTO_BYTES + 1)
    if len(content) > MAX_GUEST_PHOTO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"{file.filename} is over {MAX_GUEST_PHOTO_BYTES // BYTES_PER_MB} MB -- shrink it or pick a smaller one",
        )
    stored = store_photo(guest_photos_dir(), f"guest_{guest.id}", content, file.filename or "photo")
    fields = asdict(stored)
    # the photo row has no column for it
    fields.pop("file_size")

    if guest.photo is not None:
        delete_guest_photo_files(guest.photo)
        guest.photo = None
        # the old row has to be gone before the new one goes in, guest_id is unique
        db.flush()
    guest.photo = DjGuestPhoto(**fields)
    db.commit()
    db.refresh(guest)
    logger.info(f"dj guests: {guest.username} has a new photo ({guest.photo_id})")
    return guest


@router.delete("/me/photo", response_model=DjGuestMe)
def delete_my_photo(guest: DjGuest = Depends(require_dj_guest), db: Session = Depends(get_db)) -> DjGuest:
    """
    Takes the logged-in guest dj's photo off. Does nothing if they haven't got one.

    Args:
        guest: The guest, from their token.
        db: Database session.

    Returns:
        DjGuest: Their profile, without a photo.

    Side effects:
        Deletes the image and its thumbnail from disk.
    """
    if guest.photo is not None:
        delete_guest_photo_files(guest.photo)
        guest.photo = None
        db.commit()
        db.refresh(guest)
        logger.info(f"dj guests: {guest.username} removed their photo")
    return guest


@router.get("/{guest_id}/photo")
def get_guest_photo(guest_id: int, thumbnail: bool = False, db: Session = Depends(get_db)) -> FileResponse:
    """
    A guest dj's photo, or its thumbnail. The site adds ?v=<photo id> so each upload gets
    its own url, which is why it can be cached for good.

    Args:
        guest_id: The guest's id.
        thumbnail: Serve the thumbnail (about 400 px) instead, if there is one.
        db: Database session.

    Returns:
        FileResponse: The image.

    Raises:
        HTTPException: 404 if there's no such guest, they have no photo, or the file's missing.
    """
    guest = db.get(DjGuest, guest_id)
    if guest is None or guest.photo is None:
        raise HTTPException(status_code=404, detail=f"guest dj {guest_id} has no photo")
    photo = guest.photo
    relative_path = photo.thumbnail_path if thumbnail and photo.thumbnail_path else photo.file_path
    path = guest_photos_dir() / relative_path
    if not path.exists():
        logger.error(f"dj guests: guest {guest_id}'s photo is missing at {path}")
        raise HTTPException(
            status_code=404,
            detail=f"guest dj {guest_id}'s photo is missing on the pi -- upload it again from /guest-dj",
        )
    return FileResponse(path, media_type=photo.mime_type, headers={"Cache-Control": GUEST_PHOTO_CACHE_CONTROL})
