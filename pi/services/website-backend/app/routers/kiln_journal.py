"""
Kiln journal router -- Jude's notes and photos on firings, and the login he writes them with.

A note is either general (about the whole firing) or pinned to a moment in it, and a photo
is usually of what came out. Each one is public or private, and that can be flipped later.

Who can do what:

- anyone: public notes and photos, rate limited per IP
- kiln editor (JWT with the "kiln" scope, from POST /kiln/auth/login) or admin: everything,
  including private notes and photos

Logins are made with scripts/create_kiln_editor.py. See website/docs/KILN.md.
"""

import logging
from dataclasses import asdict
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import KILN_EDITOR_SCOPE, is_kiln_editor, kiln_editor_subject, require_kiln_editor
from app.image_utils import delete_photo_files, store_photo
from app.kiln_firings import utc_naive
from app.models import KilnEditor, KilnFiring, KilnNote, KilnPhoto
from app.rate_limit import LOGIN_RATE_LIMIT, limiter
from app.routers.auth import create_access_token, verify_password
from app.routers.kiln import PUBLIC_READ_RATE_LIMIT
from app.schemas import KilnNoteCreate, KilnNoteRead, KilnNoteUpdate, KilnPhotoRead, KilnPhotoUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/kiln", tags=["Kiln journal"])

# a phone photo is a few MB. this leaves room for big ones without letting one fill the disk
MAX_KILN_PHOTO_BYTES = 40 * 1024 * 1024
PRIVATE_CACHE_CONTROL = "private, no-store"


def _get_firing(db: Session, firing_id: int) -> KilnFiring:
    """
    Looks up a firing, for endpoints that hang things off one.

    Args:
        db: Database session.
        firing_id: The firing's id.

    Returns:
        KilnFiring: The firing.

    Raises:
        HTTPException: 404 if there's no firing with that id.
    """
    firing = db.get(KilnFiring, firing_id)
    if firing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"no kiln firing with id {firing_id}")
    return firing


def _get_or_404(db: Session, model: type[KilnNote] | type[KilnPhoto], item_id: int, what: str) -> KilnNote | KilnPhoto:
    """
    Looks up a note or photo by id.

    Args:
        db: Database session.
        model: KilnNote or KilnPhoto.
        item_id: Its id.
        what: What to call it in the error, like "note".

    Returns:
        KilnNote | KilnPhoto: The row.

    Raises:
        HTTPException: 404 if it doesn't exist.
    """
    item = db.get(model, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"no kiln {what} with id {item_id}")
    return item


@router.post("/auth/login")
@limiter.limit(LOGIN_RATE_LIMIT)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> dict:
    """
    Logs the kiln editor in. The token only works for kiln notes and photos.

    Args:
        request: Incoming request, used by the rate limiter.
        form_data: OAuth2 password form, with username and password.
        db: Database session.

    Returns:
        dict: access_token and token_type, like POST /auth/login.

    Raises:
        HTTPException: 401 if the username or password is wrong.
    """
    editor = db.query(KilnEditor).filter(KilnEditor.username == form_data.username.strip().lower()).first()
    # deliberately vague, so it doesn't say which usernames exist
    if editor is None or not verify_password(form_data.password, editor.hashed_password):
        logger.warning("kiln journal: failed login")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="wrong username or password -- check both, or ask Tyler to reset it",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(kiln_editor_subject(editor.username), scope=KILN_EDITOR_SCOPE)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/firings/{firing_id}/notes", response_model=list[KilnNoteRead])
@limiter.limit(PUBLIC_READ_RATE_LIMIT)
def list_notes(
    request: Request,
    firing_id: int,
    editor: bool = Depends(is_kiln_editor),
    db: Session = Depends(get_db),
) -> list[KilnNote]:
    """
    Lists a firing's notes: general ones first, then pinned ones by time.

    Args:
        request: Incoming request, used by the rate limiter.
        firing_id: The firing's id.
        editor: Whether the kiln editor is asking. Everyone else only gets public notes.
        db: Database session.

    Returns:
        list[KilnNoteRead]: The notes.

    Raises:
        HTTPException: 404 if there's no firing with that id.
    """
    _get_firing(db, firing_id)
    query = db.query(KilnNote).filter(KilnNote.firing_id == firing_id)
    if not editor:
        query = query.filter(KilnNote.is_public.is_(True))
    return query.order_by(KilnNote.noted_at.asc().nullsfirst(), KilnNote.created_at).all()


@router.post(
    "/firings/{firing_id}/notes",
    response_model=KilnNoteRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_kiln_editor)],
)
def create_note(firing_id: int, note: KilnNoteCreate, db: Session = Depends(get_db)) -> KilnNote:
    """
    Adds a note to a firing. Kiln editor only.

    Args:
        firing_id: The firing's id.
        note: The text, the moment it's pinned to (if any), and whether it's public.
        db: Database session.

    Returns:
        KilnNoteRead: The new note.

    Raises:
        HTTPException: 404 if there's no firing with that id.
    """
    _get_firing(db, firing_id)
    row = KilnNote(
        firing_id=firing_id,
        body=note.body,
        noted_at=None if note.noted_at is None else utc_naive(note.noted_at),
        is_public=note.is_public,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    logger.info(f"kiln journal: added note {row.id} to firing {firing_id}")
    return row


@router.patch("/notes/{note_id}", response_model=KilnNoteRead, dependencies=[Depends(require_kiln_editor)])
def update_note(note_id: int, changes: KilnNoteUpdate, db: Session = Depends(get_db)) -> KilnNote:
    """
    Changes a note's text, time, or who can see it. Kiln editor only.

    Args:
        note_id: The note's id.
        changes: Only the fields sent change. noted_at null makes it a general note.
        db: Database session.

    Returns:
        KilnNoteRead: The note as it is now.

    Raises:
        HTTPException: 404 if there's no note with that id.
    """
    note = _get_or_404(db, KilnNote, note_id, "note")
    fields = changes.model_dump(exclude_unset=True)
    if "noted_at" in fields and fields["noted_at"] is not None:
        fields["noted_at"] = utc_naive(fields["noted_at"])
    for field, value in fields.items():
        setattr(note, field, value)
    db.commit()
    db.refresh(note)
    return note


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_kiln_editor)])
def delete_note(note_id: int, db: Session = Depends(get_db)) -> None:
    """
    Deletes a note. Kiln editor only.

    Args:
        note_id: The note's id.
        db: Database session.

    Raises:
        HTTPException: 404 if there's no note with that id.
    """
    note = _get_or_404(db, KilnNote, note_id, "note")
    db.delete(note)
    db.commit()
    logger.info(f"kiln journal: deleted note {note_id}")


@router.get("/firings/{firing_id}/photos", response_model=list[KilnPhotoRead])
@limiter.limit(PUBLIC_READ_RATE_LIMIT)
def list_photos(
    request: Request,
    firing_id: int,
    editor: bool = Depends(is_kiln_editor),
    db: Session = Depends(get_db),
) -> list[KilnPhoto]:
    """
    Lists a firing's photos, oldest upload first.

    Args:
        request: Incoming request, used by the rate limiter.
        firing_id: The firing's id.
        editor: Whether the kiln editor is asking. Everyone else only gets public photos.
        db: Database session.

    Returns:
        list[KilnPhotoRead]: The photos.

    Raises:
        HTTPException: 404 if there's no firing with that id.
    """
    _get_firing(db, firing_id)
    query = db.query(KilnPhoto).filter(KilnPhoto.firing_id == firing_id)
    if not editor:
        query = query.filter(KilnPhoto.is_public.is_(True))
    return query.order_by(KilnPhoto.created_at, KilnPhoto.id).all()


@router.post(
    "/firings/{firing_id}/photos",
    response_model=KilnPhotoRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_kiln_editor)],
)
def upload_photo(
    firing_id: int,
    file: UploadFile = File(...),
    is_public: bool = Form(False),
    db: Session = Depends(get_db),
) -> KilnPhoto:
    """
    Adds one photo to a firing. Kiln editor only. The page sends several one at a time,
    so one bad file doesn't sink the rest.

    HEIC and sideways phone photos get converted the same way gallery uploads do.

    Args:
        firing_id: The firing's id.
        file: The image.
        is_public: Whether people who aren't logged in can see it.
        db: Database session.

    Returns:
        KilnPhotoRead: The new photo.

    Raises:
        HTTPException: 404 if there's no firing with that id, 413 if the file's too big,
            400 if it isn't an image.
    """
    _get_firing(db, firing_id)
    content = file.file.read(MAX_KILN_PHOTO_BYTES + 1)
    if len(content) > MAX_KILN_PHOTO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"{file.filename} is over {MAX_KILN_PHOTO_BYTES // (1024 * 1024)} MB -- shrink it or pick a smaller one",
        )
    filename = file.filename or "photo"
    stored = store_photo(Path(settings.KILN_PHOTOS_DIR), f"firing_{firing_id}", content, filename)
    photo = KilnPhoto(firing_id=firing_id, filename=filename, is_public=is_public, **asdict(stored))
    db.add(photo)
    db.commit()
    db.refresh(photo)
    logger.info(f"kiln journal: added photo {photo.id} to firing {firing_id}")
    return photo


@router.patch("/photos/{photo_id}", response_model=KilnPhotoRead, dependencies=[Depends(require_kiln_editor)])
def update_photo(photo_id: int, changes: KilnPhotoUpdate, db: Session = Depends(get_db)) -> KilnPhoto:
    """
    Makes a photo public or private. Kiln editor only.

    Args:
        photo_id: The photo's id.
        changes: Whether it's public.
        db: Database session.

    Returns:
        KilnPhotoRead: The photo as it is now.

    Raises:
        HTTPException: 404 if there's no photo with that id.
    """
    photo = _get_or_404(db, KilnPhoto, photo_id, "photo")
    photo.is_public = changes.is_public
    db.commit()
    db.refresh(photo)
    return photo


@router.delete("/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_kiln_editor)])
def delete_photo(photo_id: int, db: Session = Depends(get_db)) -> None:
    """
    Deletes a photo and its files. Kiln editor only.

    Args:
        photo_id: The photo's id.
        db: Database session.

    Raises:
        HTTPException: 404 if there's no photo with that id.
    """
    photo = _get_or_404(db, KilnPhoto, photo_id, "photo")
    delete_photo_files(Path(settings.KILN_PHOTOS_DIR), photo.file_path, photo.thumbnail_path)
    db.delete(photo)
    db.commit()
    logger.info(f"kiln journal: deleted photo {photo_id}")


@router.get("/photos/{photo_id}/file")
@limiter.limit(PUBLIC_READ_RATE_LIMIT)
def get_photo_file(
    request: Request,
    photo_id: int,
    thumbnail: bool = False,
    editor: bool = Depends(is_kiln_editor),
    db: Session = Depends(get_db),
) -> FileResponse:
    """
    Serves a photo's image or thumbnail. Private ones need the kiln editor's token.

    Args:
        request: Incoming request, used by the rate limiter.
        photo_id: The photo's id.
        thumbnail: Serve the thumbnail instead, if it has one.
        editor: Whether the kiln editor is asking.
        db: Database session.

    Returns:
        FileResponse: The image.

    Raises:
        HTTPException: 404 if there's no such photo, it's private and this isn't the
            editor (so private photos don't show they exist), or its file is missing.
    """
    photo = db.get(KilnPhoto, photo_id)
    if photo is None or not (photo.is_public or editor):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"no kiln photo with id {photo_id}")
    relative_path = photo.thumbnail_path if thumbnail and photo.thumbnail_path else photo.file_path
    file_path = Path(settings.KILN_PHOTOS_DIR) / relative_path
    if not file_path.exists():
        logger.error(f"kiln journal: photo {photo_id}'s file is missing at {file_path}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"kiln photo {photo_id}'s file is missing -- check the kiln-photos mount on fart-pi",
        )
    # a private photo should never sit in a shared cache (cloudflare's) for others to get
    headers = {} if photo.is_public else {"Cache-Control": PRIVATE_CACHE_CONTROL}
    return FileResponse(file_path, media_type=photo.mime_type, headers=headers)
