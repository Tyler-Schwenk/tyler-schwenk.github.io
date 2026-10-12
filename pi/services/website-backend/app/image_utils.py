"""
Shared image processing helpers for photo uploads and serving.

Used by any router that handles user-uploaded photos (galleries, recipes) so
decoding/normalization/thumbnailing logic lives in exactly one place.
"""

import io
import logging
import shutil
import uuid
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

from app.config import settings
from app.models import GalleryPhoto, RecipePhoto

# lets Pillow decode HEIC/HEIF (default format for iPhone camera photos)
register_heif_opener()

logger = logging.getLogger(__name__)

# formats most browsers render natively in <img> tags — anything else gets
# converted to JPEG on upload so it actually shows up in the page
WEB_SAFE_FORMATS = {"JPEG", "PNG", "WEBP", "GIF"}

# EXIF "Orientation" tag ID. 1 means "no rotation needed" -- anything else means
# the pixels are stored sideways/upside-down and a viewer is expected to rotate
# them using this tag. Pillow's resize/save drops the tag, so anything we
# re-encode has to bake the rotation into the pixels first.
EXIF_ORIENTATION_TAG = 0x0112
DEFAULT_ORIENTATION = 1


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


def create_thumbnail(
    image_path: Path, thumbnail_path: Path, size: Optional[tuple[int, int]] = None
) -> None:
    """
    Create a thumbnail from an image, with any EXIF rotation baked in.

    Saving a resized copy drops the EXIF orientation tag, so without the
    transpose a sideways-stored phone photo would come out sideways even though
    browsers show the original upright. Overwrites thumbnail_path if it exists.

    Args:
        image_path: Path to the source image
        thumbnail_path: Path where thumbnail should be saved
        size: Max dimensions as (width, height). Uses settings defaults if None
    """
    if size is None:
        size = (settings.THUMBNAIL_MAX_WIDTH, settings.THUMBNAIL_MAX_HEIGHT)

    thumbnail_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(image_path) as img:
        oriented = ImageOps.exif_transpose(img)
        oriented.thumbnail(size, Image.Resampling.LANCZOS)
        oriented.save(thumbnail_path, optimize=True, quality=settings.THUMBNAIL_QUALITY)


def encode_upright(img: Image.Image, target_format: str) -> tuple[bytes, int, int]:
    """
    Re-encode an image with its EXIF rotation baked into the pixels.

    The output carries no EXIF, so there's no orientation tag left for a viewer
    to apply a second time.

    Args:
        img: Open Pillow image (may still have an orientation tag).
        target_format: Pillow format name to encode as, e.g. "JPEG".

    Returns:
        Tuple of (encoded_bytes, width, height) of the upright image.
    """
    oriented = ImageOps.exif_transpose(img)
    if target_format == "JPEG":
        oriented = oriented.convert("RGB")
    save_kwargs = {"quality": settings.UPLOAD_JPEG_QUALITY} if target_format == "JPEG" else {}
    buffer = io.BytesIO()
    oriented.save(buffer, format=target_format, **save_kwargs)
    width, height = oriented.size
    return buffer.getvalue(), width, height


def decode_and_normalize_image(file_content: bytes, filename: str) -> tuple[bytes, int, int, str, str]:
    """
    Decode an uploaded image, convert it to a web-safe format if needed, and bake
    in any EXIF rotation.

    HEIC/HEIF (the default iPhone camera format) doesn't render in most desktop
    browsers, so it gets re-encoded to JPEG here. Separately, phone photos are
    often stored "sideways" with an EXIF orientation tag telling viewers how to
    rotate them -- any non-default orientation gets physically rotated into the
    pixels here so every consumer of the stored file sees it upright. Already
    web-safe, non-rotated images pass through untouched to avoid a lossy re-encode.

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
            img_format = img.format
            orientation = img.getexif().get(EXIF_ORIENTATION_TAG, DEFAULT_ORIENTATION)

            if img_format not in WEB_SAFE_FORMATS or orientation != DEFAULT_ORIENTATION:
                target_format = img_format if img_format in WEB_SAFE_FORMATS else "JPEG"
                content, width, height = encode_upright(img, target_format)
                ext = Path(filename).suffix if img_format in WEB_SAFE_FORMATS else ".jpg"
                return (
                    content, width, height,
                    ext or f".{target_format.lower()}", f"image/{target_format.lower()}",
                )

            width, height = img.size
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"rejected upload {filename!r}: could not decode as an image: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")

    ext = Path(filename).suffix or f".{img_format.lower()}"
    return file_content, width, height, ext, f"image/{img_format.lower()}"


def fix_legacy_orientation(photo: GalleryPhoto | RecipePhoto, photos_base: Path) -> bool:
    """
    Straighten a photo uploaded before rotation was baked in at upload time.

    Those originals still have sideways pixels plus an EXIF orientation tag
    (browsers honor it, so the full image looks fine) but their thumbnails were
    made from the raw pixels and show up sideways. New uploads never keep the
    tag, so a tag on a stored original reliably means "legacy, needs fixing".
    Rewrites the original upright (which drops the tag, so this is a no-op on
    every later call), regenerates the thumbnail, and updates the photo's
    width/height. Meant to be called on each photo request so old photos heal
    themselves the first time they're viewed.

    Args:
        photo: Gallery or recipe photo row. width/height are mutated in place
            when a fix happens; the caller commits.
        photos_base: Directory the photo's relative paths are under.

    Returns:
        True if the photo was fixed (caller should commit), False otherwise.
        Failures are logged and return False so the photo is still served as-is.
    """
    original = photos_base / photo.file_path
    tmp_path = original.with_name(f".{uuid.uuid4().hex}{original.suffix}")
    try:
        with Image.open(original) as img:
            if img.getexif().get(EXIF_ORIENTATION_TAG, DEFAULT_ORIENTATION) == DEFAULT_ORIENTATION:
                return False
            content, width, height = encode_upright(img, img.format)

        # write-then-rename so a concurrent request never reads a half-written file
        tmp_path.write_bytes(content)
        tmp_path.replace(original)
        if photo.thumbnail_path:
            create_thumbnail(original, photos_base / photo.thumbnail_path)
    except FileNotFoundError:
        return False
    except Exception as e:
        logger.warning(
            f"couldn't straighten legacy-rotated photo {original.name}: {e} -- "
            "serving it unchanged; re-upload the photo if its thumbnail stays sideways"
        )
        tmp_path.unlink(missing_ok=True)
        return False

    photo.width, photo.height = width, height
    logger.info(f"straightened legacy-rotated photo {original.name}")
    return True
