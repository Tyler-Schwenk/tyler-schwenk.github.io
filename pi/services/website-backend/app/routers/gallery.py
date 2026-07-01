"""
Gallery router for photo management.

Provides endpoints for creating galleries and uploading/managing photos.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pathlib import Path
import logging
import shutil
import uuid
from PIL import Image
from pillow_heif import register_heif_opener
import io

from app.database import get_db
from app.dependencies import require_admin
from app.models import Gallery, GalleryPhoto
from app.schemas import (
    GalleryCreate, GalleryUpdate, GalleryRead, GalleryWithPhotos,
    GalleryPhotoRead, GalleryPhotoUpdate
)
from app.config import settings

# lets Pillow decode HEIC/HEIF (default format for iPhone camera photos)
register_heif_opener()

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/galleries", tags=["Galleries"])

# formats most browsers render natively in <img> tags — anything else gets
# converted to JPEG on upload so it actually shows up in the gallery
WEB_SAFE_FORMATS = {"JPEG", "PNG", "WEBP", "GIF"}


# Helper functions
def save_upload_file(upload_file: UploadFile, destination: Path) -> None:
    """
    Save uploaded file to destination path.
    
    Args:
        upload_file: The uploaded file object
        destination: Path where file should be saved
    """
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)


def create_thumbnail(image_path: Path, thumbnail_path: Path, size: tuple = None) -> None:
    """
    Create a thumbnail from an image.
    
    Args:
        image_path: Path to the source image
        thumbnail_path: Path where thumbnail should be saved
        size: Max dimensions as (width, height). Uses settings defaults if None
    """
    if size is None:
        size = (settings.THUMBNAIL_MAX_WIDTH, settings.THUMBNAIL_MAX_HEIGHT)
    
    thumbnail_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(image_path) as img:
        img.thumbnail(size, Image.Resampling.LANCZOS)
        img.save(thumbnail_path, optimize=True, quality=settings.THUMBNAIL_QUALITY)


def decode_and_normalize_image(file_content: bytes, filename: str) -> tuple[bytes, int, int, str, str]:
    """
    Decode an uploaded image and convert it to a web-safe format if needed.

    HEIC/HEIF (the default iPhone camera format) doesn't render in most desktop
    browsers, so it gets re-encoded to JPEG here. Already web-safe formats
    (JPEG/PNG/WEBP/GIF) pass through untouched to avoid a lossy re-encode.

    Args:
        file_content: Raw uploaded file bytes.
        filename: Original filename, used as a fallback extension for formats
            Pillow doesn't have a clean name for.

    Returns:
        Tuple of (content_bytes, width, height, file_extension, mime_type).

    Raises:
        HTTPException: 400 if the bytes aren't a decodable image.
    """
    try:
        with Image.open(io.BytesIO(file_content)) as img:
            width, height = img.size
            img_format = img.format

            if img_format not in WEB_SAFE_FORMATS:
                buffer = io.BytesIO()
                img.convert("RGB").save(buffer, format="JPEG", quality=90)
                return buffer.getvalue(), width, height, ".jpg", "image/jpeg"
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"rejected upload {filename!r}: could not decode as an image: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")

    ext = Path(filename).suffix or f".{img_format.lower()}"
    return file_content, width, height, ext, f"image/{img_format.lower()}"


# Gallery endpoints
@router.get("", response_model=List[GalleryRead])
async def list_galleries(
    skip: int = 0,
    limit: int = 100,
    public_only: bool = True,
    db: Session = Depends(get_db)
):
    """
    List all galleries.
    
    Args:
        skip: Number of galleries to skip (pagination)
        limit: Maximum number of galleries to return
        public_only: If True, only return public galleries
        db: Database session
        
    Returns:
        List of galleries with photo counts
    """
    query = db.query(Gallery)
    if public_only:
        query = query.filter(Gallery.is_public == True)
    
    galleries = query.order_by(Gallery.display_order.desc(), Gallery.id.desc()).offset(skip).limit(limit).all()
    
    # Add photo count to each gallery
    result = []
    for gallery in galleries:
        gallery_dict = GalleryRead.model_validate(gallery).model_dump()
        photo_count = db.query(func.count(GalleryPhoto.id)).filter(
            GalleryPhoto.gallery_id == gallery.id
        ).scalar()
        gallery_dict["photo_count"] = photo_count
        result.append(GalleryRead(**gallery_dict))
    
    return result


@router.get("/{gallery_id}", response_model=GalleryWithPhotos)
async def get_gallery(gallery_id: int, db: Session = Depends(get_db)):
    """
    Get a specific gallery with all its photos.
    
    Args:
        gallery_id: Gallery ID
        db: Database session
        
    Returns:
        Gallery with all photos
    """
    gallery = db.query(Gallery).filter(Gallery.id == gallery_id).first()
    if not gallery:
        raise HTTPException(status_code=404, detail="Gallery not found")
    
    return gallery


@router.get("/slug/{slug}", response_model=GalleryWithPhotos)
async def get_gallery_by_slug(slug: str, db: Session = Depends(get_db)):
    """
    Get a gallery by its URL slug.
    
    Args:
        slug: Gallery slug
        db: Database session
        
    Returns:
        Gallery with all photos
    """
    gallery = db.query(Gallery).filter(Gallery.slug == slug).first()
    if not gallery:
        raise HTTPException(status_code=404, detail="Gallery not found")
    
    return gallery


@router.post("", response_model=GalleryRead, status_code=status.HTTP_201_CREATED)
async def create_gallery(
    gallery: GalleryCreate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Create a new gallery.
    
    Args:
        gallery: Gallery data
        db: Database session
        
    Returns:
        Created gallery
    """
    # Check if slug already exists
    existing = db.query(Gallery).filter(Gallery.slug == gallery.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Gallery with this slug already exists")

    # new galleries go to the front by getting the highest display_order
    max_order = db.query(func.max(Gallery.display_order)).scalar() or 0
    db_gallery = Gallery(**gallery.model_dump(), display_order=max_order + 10)
    db.add(db_gallery)
    db.commit()
    db.refresh(db_gallery)
    
    return db_gallery


@router.patch("/{gallery_id}", response_model=GalleryRead)
async def update_gallery(
    gallery_id: int,
    gallery_update: GalleryUpdate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Update a gallery.
    
    Args:
        gallery_id: Gallery ID
        gallery_update: Fields to update
        db: Database session
        
    Returns:
        Updated gallery
    """
    db_gallery = db.query(Gallery).filter(Gallery.id == gallery_id).first()
    if not db_gallery:
        raise HTTPException(status_code=404, detail="Gallery not found")
    
    # Check slug uniqueness if being updated
    if gallery_update.slug and gallery_update.slug != db_gallery.slug:
        existing = db.query(Gallery).filter(Gallery.slug == gallery_update.slug).first()
        if existing:
            raise HTTPException(status_code=400, detail="Gallery with this slug already exists")
    
    update_data = gallery_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_gallery, field, value)
    
    db.commit()
    db.refresh(db_gallery)
    
    return db_gallery


@router.delete("/{gallery_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gallery(
    gallery_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Delete a gallery and all its photos.
    
    Args:
        gallery_id: Gallery ID
        db: Database session
    """
    db_gallery = db.query(Gallery).filter(Gallery.id == gallery_id).first()
    if not db_gallery:
        raise HTTPException(status_code=404, detail="Gallery not found")
    
    # Delete photo files from disk
    for photo in db_gallery.photos:
        photo_path = Path(settings.PHOTOS_DIR) / photo.file_path
        if photo_path.exists():
            photo_path.unlink()
        if photo.thumbnail_path:
            thumb_path = Path(settings.PHOTOS_DIR) / photo.thumbnail_path
            if thumb_path.exists():
                thumb_path.unlink()
    
    db.delete(db_gallery)
    db.commit()


# Photo endpoints
@router.post("/{gallery_id}/photos", response_model=GalleryPhotoRead, status_code=status.HTTP_201_CREATED)
async def upload_photo(
    gallery_id: int,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    display_order: int = Form(0),
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Upload a photo to a gallery.
    
    Args:
        gallery_id: Gallery ID
        file: Image file to upload
        title: Photo title
        description: Photo description
        display_order: Display order in gallery
        db: Database session
        
    Returns:
        Created photo metadata
    """
    # Verify gallery exists
    gallery = db.query(Gallery).filter(Gallery.id == gallery_id).first()
    if not gallery:
        raise HTTPException(status_code=404, detail="Gallery not found")

    # Read file content once. Content-type headers are unreliable (some clients send
    # application/octet-stream for HEIC) so validity is checked by actually decoding
    # the image below rather than trusting the header.
    file_content = await file.read()

    file_content, width, height, file_ext, mime_type = decode_and_normalize_image(
        file_content, file.filename
    )
    file_size = len(file_content)

    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    
    # Create paths
    photos_base = Path(settings.PHOTOS_DIR)
    gallery_dir = photos_base / f"gallery_{gallery_id}"
    file_path = gallery_dir / unique_filename
    thumbnail_path = gallery_dir / "thumbnails" / unique_filename
    
    # Save original file
    gallery_dir.mkdir(parents=True, exist_ok=True)
    with file_path.open("wb") as f:
        f.write(file_content)
    
    # Create thumbnail
    try:
        create_thumbnail(file_path, thumbnail_path)
    except Exception as e:
        # gallery grid falls back to the full image when thumbnail_path is None
        logger.warning(f"thumbnail generation failed for {file_path.name}: {e}")
        thumbnail_path = None

    # Create database record
    db_photo = GalleryPhoto(
        gallery_id=gallery_id,
        filename=file.filename,
        file_path=str(file_path.relative_to(photos_base)),
        thumbnail_path=str(thumbnail_path.relative_to(photos_base)) if thumbnail_path else None,
        title=title,
        description=description,
        width=width,
        height=height,
        file_size=file_size,
        mime_type=mime_type,
        display_order=display_order
    )
    
    db.add(db_photo)
    db.commit()
    db.refresh(db_photo)
    
    return db_photo


@router.get("/{gallery_id}/photos", response_model=List[GalleryPhotoRead])
async def list_gallery_photos(gallery_id: int, db: Session = Depends(get_db)):
    """
    List all photos in a gallery.
    
    Args:
        gallery_id: Gallery ID
        db: Database session
        
    Returns:
        List of photos ordered by display_order
    """
    gallery = db.query(Gallery).filter(Gallery.id == gallery_id).first()
    if not gallery:
        raise HTTPException(status_code=404, detail="Gallery not found")
    
    photos = db.query(GalleryPhoto).filter(
        GalleryPhoto.gallery_id == gallery_id
    ).order_by(GalleryPhoto.display_order, GalleryPhoto.created_at).all()
    
    return photos


@router.get("/photos/{photo_id}", response_model=GalleryPhotoRead)
async def get_photo(photo_id: int, db: Session = Depends(get_db)):
    """
    Get photo metadata.
    
    Args:
        photo_id: Photo ID
        db: Database session
        
    Returns:
        Photo metadata
    """
    photo = db.query(GalleryPhoto).filter(GalleryPhoto.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    return photo


@router.get("/photos/{photo_id}/file")
async def get_photo_file(photo_id: int, thumbnail: bool = False, db: Session = Depends(get_db)):
    """
    Get photo file (original or thumbnail).
    
    Args:
        photo_id: Photo ID
        thumbnail: If True, return thumbnail instead of original
        db: Database session
        
    Returns:
        Image file
    """
    photo = db.query(GalleryPhoto).filter(GalleryPhoto.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    photos_base = Path(settings.PHOTOS_DIR)
    
    if thumbnail and photo.thumbnail_path:
        file_path = photos_base / photo.thumbnail_path
    else:
        file_path = photos_base / photo.file_path
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Photo file not found")
    
    return FileResponse(file_path, media_type=photo.mime_type)


@router.patch("/photos/{photo_id}", response_model=GalleryPhotoRead)
async def update_photo(
    photo_id: int,
    photo_update: GalleryPhotoUpdate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Update photo metadata.
    
    Args:
        photo_id: Photo ID
        photo_update: Fields to update
        db: Database session
        
    Returns:
        Updated photo
    """
    db_photo = db.query(GalleryPhoto).filter(GalleryPhoto.id == photo_id).first()
    if not db_photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    update_data = photo_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_photo, field, value)
    
    db.commit()
    db.refresh(db_photo)
    
    return db_photo


@router.delete("/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_photo(
    photo_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Delete a photo.
    
    Args:
        photo_id: Photo ID
        db: Database session
    """
    db_photo = db.query(GalleryPhoto).filter(GalleryPhoto.id == photo_id).first()
    if not db_photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Delete files from disk
    photos_base = Path(settings.PHOTOS_DIR)
    file_path = photos_base / db_photo.file_path
    if file_path.exists():
        file_path.unlink()
    
    if db_photo.thumbnail_path:
        thumb_path = photos_base / db_photo.thumbnail_path
        if thumb_path.exists():
            thumb_path.unlink()
    
    db.delete(db_photo)
    db.commit()
