"""File utilities for reading and writing GeoJSON data."""

from pathlib import Path
import json
import logging
from typing import Any, Dict

from config import GEOJSON_FILE, JSON_INDENT

def ensure_parent_dir(file_path: Path) -> None:
    """Ensure the parent directory exists for a given file path.

    Args:
        file_path (Path): Path to the file.

    Returns:
        None
    """
    file_path.parent.mkdir(parents=True, exist_ok=True)

def save_geojson(geojson: Dict[str, Any], filename: Path = GEOJSON_FILE) -> None:
    """Save GeoJSON data to disk.

    Args:
        geojson (dict): GeoJSON content to save.
        filename (Path): Destination file path.

    Returns:
        None
    """
    ensure_parent_dir(filename)
    with filename.open("w", encoding="utf-8") as file_handle:
        json.dump(geojson, file_handle, indent=JSON_INDENT)
    logging.info("Saved GeoJSON to %s", filename)

def load_existing_geojson(filename: Path = GEOJSON_FILE) -> Dict[str, Any]:
    """Load an existing GeoJSON file if it exists.

    Args:
        filename (Path): GeoJSON file path to load.

    Returns:
        dict: Parsed GeoJSON data or an empty FeatureCollection if missing.
    """
    try:
        with filename.open("r", encoding="utf-8") as file_handle:
            geojson = json.load(file_handle)
            logging.info(
                "Loaded existing GeoJSON file with %s features.",
                len(geojson.get("features", [])),
            )
            return geojson
    except FileNotFoundError:
        logging.info("No existing GeoJSON file found at %s.", filename)
        return {"type": "FeatureCollection", "features": []}
