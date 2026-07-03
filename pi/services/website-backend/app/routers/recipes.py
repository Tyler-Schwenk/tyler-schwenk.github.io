"""
Recipes router for The Kitchen recipe box.

Anyone can submit a recipe from the public form (name/description/tags/photos,
all optional) -- no login required, just rate-limited per IP like Public
Square and RSVP. Editing and deleting a recipe requires admin auth (JWT),
same as gallery photo management.
"""

import logging
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import require_admin
from app.image_utils import create_thumbnail, decode_and_normalize_image
from app.models import Recipe, RecipePhoto, Tag
from app.rate_limit import limiter
from app.schemas import (
    MAX_PHOTOS_PER_RECIPE,
    MAX_RECIPE_LINK_LENGTH,
    MAX_TAG_NAME_LENGTH,
    MAX_TAGS_PER_RECIPE,
    RecipeRead,
    RecipeUpdate,
    TagWithCount,
    normalize_recipe_link,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recipes", tags=["Recipes"])

# public, unauthenticated writes -- capped per IP the same way Public Square
# posts and event RSVPs are. Recipes carry photos so the cap is a bit looser.
RECIPE_CREATE_RATE_LIMIT = "10/hour"
RECIPE_PHOTO_ADD_RATE_LIMIT = "30/hour"


def _split_tag_names(raw: Optional[str]) -> List[str]:
    """
    Parse a comma-separated tag string into clean, deduped names.

    Args:
        raw: Comma-separated tag names as submitted by the form, or None.

    Returns:
        Trimmed, de-duplicated (case-insensitive) tag names, longest-first
        order preserved as typed. Empty/whitespace-only entries are dropped.
    """
    if not raw:
        return []
    seen_lower = set()
    names = []
    for part in raw.split(","):
        name = part.strip()
        if not name or name.lower() in seen_lower:
            continue
        seen_lower.add(name.lower())
        names.append(name[:MAX_TAG_NAME_LENGTH])
    return names[:MAX_TAGS_PER_RECIPE]


def _get_or_create_tags(db: Session, tag_names: List[str]) -> List[Tag]:
    """
    Resolve tag names to Tag rows, creating any that don't exist yet.

    Matching is case-insensitive so "Breakfast" and "breakfast" reuse the
    same tag instead of creating a near-duplicate.

    Args:
        db: Database session.
        tag_names: Clean tag names (see _split_tag_names).

    Returns:
        Tag rows, one per input name, in the same order.
    """
    tags = []
    for name in tag_names:
        tag = db.query(Tag).filter(Tag.name.ilike(name)).first()
        if not tag:
            tag = Tag(name=name)
            db.add(tag)
            db.flush()
        tags.append(tag)
    return tags


def _apply_recipe_filters(query, search: Optional[str], tags: Optional[str]):
    """
    Apply search/tag filters shared by list and random endpoints.

    Args:
        query: Base SQLAlchemy query over Recipe.
        search: Substring to match against name or description (case-insensitive).
        tags: Comma-separated tag names the recipe must have all of.

    Returns:
        The filtered query.
    """
    if search:
        like = f"%{search}%"
        query = query.filter((Recipe.name.ilike(like)) | (Recipe.description.ilike(like)))

    tag_names = _split_tag_names(tags)
    for name in tag_names:
        # one EXISTS-style join per required tag so the recipe must match all of them
        query = query.filter(Recipe.tags.any(Tag.name.ilike(name)))

    return query


def _save_recipe_photo(recipe_id: int, file_content: bytes, filename: str) -> RecipePhoto:
    """
    Normalize, save, and thumbnail one uploaded photo for a recipe.

    Args:
        recipe_id: Recipe the photo belongs to.
        file_content: Raw uploaded file bytes.
        filename: Original filename from the upload.

    Returns:
        An unsaved RecipePhoto instance (caller adds/commits it).
    """
    file_content, width, height, file_ext, mime_type = decode_and_normalize_image(file_content, filename)
    file_size = len(file_content)

    unique_filename = f"{uuid.uuid4()}{file_ext}"
    photos_base = Path(settings.RECIPE_PHOTOS_DIR)
    recipe_dir = photos_base / f"recipe_{recipe_id}"
    file_path = recipe_dir / unique_filename
    thumbnail_path = recipe_dir / "thumbnails" / unique_filename

    recipe_dir.mkdir(parents=True, exist_ok=True)
    with file_path.open("wb") as f:
        f.write(file_content)

    try:
        create_thumbnail(file_path, thumbnail_path)
    except Exception as e:
        # recipe grid falls back to the full image when thumbnail_path is None
        logger.warning(f"thumbnail generation failed for {file_path.name}: {e}")
        thumbnail_path = None

    return RecipePhoto(
        recipe_id=recipe_id,
        filename=filename,
        file_path=str(file_path.relative_to(photos_base)),
        thumbnail_path=str(thumbnail_path.relative_to(photos_base)) if thumbnail_path else None,
        width=width,
        height=height,
        file_size=file_size,
        mime_type=mime_type,
    )


@router.get("", response_model=List[RecipeRead])
async def list_recipes(
    search: Optional[str] = None,
    tags: Optional[str] = None,
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    """
    List recipes, newest first, optionally filtered by search text and/or tags.

    Args:
        search: Substring to match against recipe name or description.
        tags: Comma-separated tag names -- recipes must have all of them.
        skip: Number of recipes to skip (pagination).
        limit: Maximum number of recipes to return.
        db: Database session.

    Returns:
        Matching recipes with their tags and photos.
    """
    query = _apply_recipe_filters(db.query(Recipe), search, tags)
    return query.order_by(Recipe.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/random", response_model=RecipeRead)
async def random_recipe(
    search: Optional[str] = None,
    tags: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Pick one random recipe, optionally within the same search/tag filters.

    Args:
        search: Substring to match against recipe name or description.
        tags: Comma-separated tag names -- recipes must have all of them.
        db: Database session.

    Returns:
        A single randomly-chosen recipe.

    Raises:
        HTTPException: 404 if no recipe matches the filters.
    """
    query = _apply_recipe_filters(db.query(Recipe), search, tags)
    recipe = query.order_by(func.random()).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="No recipes match those filters")
    return recipe


@router.get("/tags", response_model=List[TagWithCount])
async def list_tags(db: Session = Depends(get_db)):
    """
    List every tag currently in use, alphabetically, with recipe counts.

    Powers the "existing tags" picker on the add-recipe form and the filter
    chips on the browse view.

    Args:
        db: Database session.

    Returns:
        All tags with how many recipes use each one.
    """
    rows = (
        db.query(Tag, func.count(Recipe.id).label("recipe_count"))
        .outerjoin(Tag.recipes)
        .group_by(Tag.id)
        .order_by(Tag.name)
        .all()
    )
    return [TagWithCount(id=tag.id, name=tag.name, recipe_count=count) for tag, count in rows]


@router.get("/{recipe_id}", response_model=RecipeRead)
async def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    """
    Get a single recipe with its tags and photos.

    Args:
        recipe_id: Recipe ID.
        db: Database session.

    Returns:
        The recipe.

    Raises:
        HTTPException: 404 if not found.
    """
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@router.post("", response_model=RecipeRead, status_code=status.HTTP_201_CREATED)
@limiter.limit(RECIPE_CREATE_RATE_LIMIT)
async def create_recipe(
    request: Request,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    link: Optional[str] = Form(None, max_length=MAX_RECIPE_LINK_LENGTH),
    tags: Optional[str] = Form(None, description="Comma-separated tag names"),
    files: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    """
    Submit a new recipe. No auth -- rate limited per IP instead.

    All fields are optional so the form can be filled out quickly from a
    phone. Photos (if any) are decoded/normalized/thumbnailed the same way
    gallery uploads are.

    Args:
        request: Incoming request (required by the rate limiter for the client IP).
        name: Recipe name.
        description: Recipe description/instructions.
        link: Optional URL to an external source for the recipe; a bare domain
            (no scheme) gets `https://` prepended, see normalize_recipe_link.
        tags: Comma-separated tag names; unknown ones are created on the fly.
        files: Photo uploads, if any.
        db: Database session.

    Returns:
        The created recipe with its tags and photos.

    Raises:
        HTTPException: 400 if more than MAX_PHOTOS_PER_RECIPE photos are attached,
            or if one of the files isn't a decodable image.
    """
    if len(files) > MAX_PHOTOS_PER_RECIPE:
        raise HTTPException(
            status_code=400,
            detail=f"too many photos -- attach at most {MAX_PHOTOS_PER_RECIPE}",
        )

    recipe = Recipe(name=name or None, description=description or None, link=normalize_recipe_link(link))
    recipe.tags = _get_or_create_tags(db, _split_tag_names(tags))
    db.add(recipe)
    db.flush()

    for order, upload in enumerate(files):
        if not upload.filename:
            continue
        file_content = await upload.read()
        photo = _save_recipe_photo(recipe.id, file_content, upload.filename)
        photo.display_order = order
        db.add(photo)

    db.commit()
    db.refresh(recipe)
    return recipe


@router.patch("/{recipe_id}", response_model=RecipeRead)
async def update_recipe(
    recipe_id: int,
    recipe_update: RecipeUpdate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Edit a recipe's name, description, and/or tags. Admin-only.

    Args:
        recipe_id: Recipe ID.
        recipe_update: Fields to update; `tags`, if given, fully replaces the tag list.
        db: Database session.

    Returns:
        The updated recipe.

    Raises:
        HTTPException: 404 if not found.
    """
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    update_data = recipe_update.model_dump(exclude_unset=True, exclude={"tags"})
    for field, value in update_data.items():
        setattr(recipe, field, value)

    if recipe_update.tags is not None:
        recipe.tags = _get_or_create_tags(db, _split_tag_names(",".join(recipe_update.tags)))

    db.commit()
    db.refresh(recipe)
    return recipe


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Delete a recipe and its photos. Admin-only.

    Args:
        recipe_id: Recipe ID.
        db: Database session.

    Raises:
        HTTPException: 404 if not found.
    """
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    photos_base = Path(settings.RECIPE_PHOTOS_DIR)
    for photo in recipe.photos:
        _delete_photo_files(photos_base, photo)

    db.delete(recipe)
    db.commit()


@router.post("/{recipe_id}/photos", response_model=RecipeRead)
@limiter.limit(RECIPE_PHOTO_ADD_RATE_LIMIT)
async def add_recipe_photos(
    request: Request,
    recipe_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Add more photos to an existing recipe. Admin-only.

    Args:
        request: Incoming request (required by the rate limiter for the client IP).
        recipe_id: Recipe ID.
        files: Photo uploads to add.
        db: Database session.

    Returns:
        The recipe with its updated photo list.

    Raises:
        HTTPException: 404 if not found, 400 if the total photo count would
            exceed MAX_PHOTOS_PER_RECIPE.
    """
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    if len(recipe.photos) + len(files) > MAX_PHOTOS_PER_RECIPE:
        raise HTTPException(
            status_code=400,
            detail=f"too many photos -- a recipe can have at most {MAX_PHOTOS_PER_RECIPE}",
        )

    next_order = max((p.display_order for p in recipe.photos), default=-1) + 1
    for offset, upload in enumerate(files):
        if not upload.filename:
            continue
        file_content = await upload.read()
        photo = _save_recipe_photo(recipe.id, file_content, upload.filename)
        photo.display_order = next_order + offset
        db.add(photo)

    db.commit()
    db.refresh(recipe)
    return recipe


@router.delete("/{recipe_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe_photo(
    recipe_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Remove a single photo from a recipe. Admin-only.

    Args:
        recipe_id: Recipe ID the photo should belong to.
        photo_id: Photo ID.
        db: Database session.

    Raises:
        HTTPException: 404 if the photo doesn't exist under that recipe.
    """
    photo = (
        db.query(RecipePhoto)
        .filter(RecipePhoto.id == photo_id, RecipePhoto.recipe_id == recipe_id)
        .first()
    )
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    _delete_photo_files(Path(settings.RECIPE_PHOTOS_DIR), photo)
    db.delete(photo)
    db.commit()


@router.post("/{recipe_id}/photos/{photo_id}/thumbnail", response_model=RecipeRead)
async def set_recipe_thumbnail(
    recipe_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Promote a photo to be the recipe's cover/thumbnail image. Admin-only.

    There's no separate "is_thumbnail" flag to keep in sync -- the cover is
    just whichever photo sorts first by display_order (see RecipeCard on the
    frontend and the `photos` relationship's order_by). This endpoint makes
    that happen by giving the chosen photo a lower display_order than every
    other photo on the recipe. Calling it again on the current cover is a
    no-op.

    Args:
        recipe_id: Recipe ID the photo should belong to.
        photo_id: Photo ID to promote.
        db: Database session.

    Returns:
        The recipe with its photos re-ordered.

    Raises:
        HTTPException: 404 if the photo doesn't exist under that recipe.
    """
    photo = (
        db.query(RecipePhoto)
        .filter(RecipePhoto.id == photo_id, RecipePhoto.recipe_id == recipe_id)
        .first()
    )
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    min_order = db.query(func.min(RecipePhoto.display_order)).filter(
        RecipePhoto.recipe_id == recipe_id
    ).scalar() or 0
    if photo.display_order > min_order:
        photo.display_order = min_order - 1
        db.commit()

    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    return recipe


def _delete_photo_files(photos_base: Path, photo: RecipePhoto) -> None:
    """
    Remove a recipe photo's original and thumbnail files from disk, if present.

    Args:
        photos_base: Root recipe photos directory (settings.RECIPE_PHOTOS_DIR).
        photo: The photo row whose files should be removed.
    """
    file_path = photos_base / photo.file_path
    if file_path.exists():
        file_path.unlink()
    if photo.thumbnail_path:
        thumb_path = photos_base / photo.thumbnail_path
        if thumb_path.exists():
            thumb_path.unlink()


@router.get("/photos/{photo_id}/file")
async def get_recipe_photo_file(photo_id: int, thumbnail: bool = False, db: Session = Depends(get_db)):
    """
    Serve a recipe photo file (original or thumbnail).

    Args:
        photo_id: Photo ID.
        thumbnail: If True, return the thumbnail instead of the original.
        db: Database session.

    Returns:
        The image file.

    Raises:
        HTTPException: 404 if the photo record or its file is missing.
    """
    photo = db.query(RecipePhoto).filter(RecipePhoto.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    photos_base = Path(settings.RECIPE_PHOTOS_DIR)
    file_path = photos_base / (photo.thumbnail_path if thumbnail and photo.thumbnail_path else photo.file_path)

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Photo file not found")

    return FileResponse(file_path, media_type=photo.mime_type)
