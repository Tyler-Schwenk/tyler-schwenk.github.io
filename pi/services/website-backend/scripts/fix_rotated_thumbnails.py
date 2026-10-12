#!/usr/bin/env python3
"""Rebuild thumbnails for photos whose originals carry an EXIF rotation tag.

Photos uploaded before orientation was baked in at upload time still have the
raw sideways pixels plus an EXIF orientation tag. Browsers rotate the original
correctly, but the thumbnails were made without honoring the tag, so they show
up sideways in grids. This regenerates those thumbnails (create_thumbnail now
applies the rotation) and fixes the stored width/height, which were recorded
pre-rotation and so are swapped for 90-degree photos.

Only photos whose original has a non-default orientation are touched, so it's
safe to re-run. Covers both gallery photos and recipe photos.

Run inside the Docker container:
    docker exec website-backend-api python scripts/fix_rotated_thumbnails.py
    docker exec website-backend-api python scripts/fix_rotated_thumbnails.py --dry-run
"""

import argparse
import logging
import sys
from pathlib import Path

from PIL import Image, ImageOps

# the script lives in scripts/, the app package is one level up
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.image_utils import EXIF_ORIENTATION_TAG, create_thumbnail  # noqa: E402
from app.models import GalleryPhoto, RecipePhoto  # noqa: E402

DEFAULT_ORIENTATION = 1

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("fix_rotated_thumbnails")


def oriented_size(image_path: Path) -> tuple[int, int] | None:
    """
    Check an image's EXIF orientation and return its upright size if it's rotated.

    Args:
        image_path: Path to the original image file.

    Returns:
        (width, height) after applying the rotation, or None if the image has no
        rotation tag (nothing to fix).
    """
    with Image.open(image_path) as img:
        if img.getexif().get(EXIF_ORIENTATION_TAG, DEFAULT_ORIENTATION) == DEFAULT_ORIENTATION:
            return None
        return ImageOps.exif_transpose(img).size


def fix_photo(photo: GalleryPhoto | RecipePhoto, photos_base: Path, dry_run: bool) -> bool:
    """
    Regenerate one photo's thumbnail and correct its dimensions if it's rotated.

    Args:
        photo: Gallery or recipe photo row. Mutated in place (width/height).
        photos_base: Directory the photo's relative paths are under.
        dry_run: If True, only report what would change.

    Returns:
        True if the photo needed fixing, False if it was already fine or skipped.
    """
    original = photos_base / photo.file_path
    if not original.exists():
        logger.warning(f"skipping photo {photo.id}: original missing at {original}, re-upload it to fix")
        return False

    try:
        size = oriented_size(original)
    except Exception as e:
        logger.warning(f"skipping photo {photo.id}: couldn't read {original.name} ({e})")
        return False
    if size is None:
        return False

    logger.info(f"{'would fix' if dry_run else 'fixing'} photo {photo.id} ({photo.filename})")
    if dry_run:
        return True

    if photo.thumbnail_path:
        create_thumbnail(original, photos_base / photo.thumbnail_path)
    photo.width, photo.height = size
    return True


def main() -> int:
    """
    Fix every rotated gallery and recipe photo.

    Returns:
        Process exit code (0 on success).
    """
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="list affected photos without changing anything")
    args = parser.parse_args()

    targets = [
        (GalleryPhoto, Path(settings.PHOTOS_DIR)),
        (RecipePhoto, Path(settings.RECIPE_PHOTOS_DIR)),
    ]

    db = SessionLocal()
    try:
        fixed = 0
        for model, photos_base in targets:
            for photo in db.query(model).all():
                if fix_photo(photo, photos_base, args.dry_run):
                    fixed += 1
        if not args.dry_run:
            db.commit()
    except Exception:
        db.rollback()
        logger.exception("failed partway through, nothing in the DB was changed (thumbnails already rewritten are fine to keep)")
        return 1
    finally:
        db.close()

    logger.info(f"{fixed} photo(s) {'need' if args.dry_run else 'were'} fixed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
