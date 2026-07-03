"""
Shared image processing helpers for photo uploads.

Used by any router that accepts user-uploaded photos (galleries, recipes) so
decoding/normalization/thumbnailing logic lives in exactly one place.
"""

import io
import logging
import shutil
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

from app.config import settings

# lets Pillow decode HEIC/HEIF (default format for iPhone camera photos)
register_heif_opener()

logger = logging.getLogger(__name__)

# formats most browsers render natively in <img> tags — anything else gets
# converted to JPEG on upload so it actually shows up in the page
WEB_SAFE_FORMATS = {"JPEG", "PNG", "WEBP", "GIF"}

# EXIF "Orientation" tag ID. 1 means "no rotation needed" -- anything else means
# the pixels are stored sideways/upside-down and a viewer is expected to rotate
# them using this tag. Our thumbnail generator doesn't do that, so we bake the
# rotation into the pixels ourselves at upload time instead of relying on it.
EXIF_ORIENTATION_TAG = 0x0112


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
    Decode an uploaded image, convert it to a web-safe format if needed, and bake
    in any EXIF rotation.

    HEIC/HEIF (the default iPhone camera format) doesn't render in most desktop
    browsers, so it gets re-encoded to JPEG here. Separately, phone photos are
    often stored "sideways" with an EXIF orientation tag telling viewers how to
    rotate them -- since our thumbnail generator ignores that tag, any non-default
    orientation gets physically rotated into the pixels here instead. Already
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
            orientation = img.getexif().get(EXIF_ORIENTATION_TAG, 1)

            if img_format not in WEB_SAFE_FORMATS or orientation != 1:
                oriented = ImageOps.exif_transpose(img)
                width, height = oriented.size
                target_format = img_format if img_format in WEB_SAFE_FORMATS else "JPEG"
                if target_format == "JPEG":
                    oriented = oriented.convert("RGB")

                buffer = io.BytesIO()
                save_kwargs = {"quality": 90} if target_format == "JPEG" else {}
                oriented.save(buffer, format=target_format, **save_kwargs)

                ext = Path(filename).suffix if img_format in WEB_SAFE_FORMATS else ".jpg"
                return (
                    buffer.getvalue(), width, height,
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
