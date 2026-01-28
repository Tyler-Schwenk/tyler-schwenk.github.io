"""Utilities for exporting Pac-Tyler activity datasets."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import DATE_TIME_OUTPUT_TIMESPEC, DERIVED_ACTIVITY_JSON, METERS_PER_MILE
from src.utils.file_utils import save_json_data

def normalize_activity_id(value: Any) -> Optional[str]:
    """Normalize an activity identifier for export.

    Args:
        value (Any): Activity ID value.

    Returns:
        Optional[str]: Normalized activity ID string when available.
    """
    if value is None:
        return None

    return str(value)

def build_activity_dataset(geojson: Dict[str, Any]) -> Dict[str, Any]:
    """Build a normalized activity dataset from GeoJSON input.

    Args:
        geojson (dict): GeoJSON FeatureCollection of activities.

    Returns:
        dict: Derived dataset suitable for frontend analytics.
    """
    activities: List[Dict[str, Any]] = []
    for feature in geojson.get("features", []):
        properties = feature.get("properties", {})
        date_value = properties.get("date")
        distance_meters = properties.get("distance")

        if not isinstance(date_value, str):
            continue
        if not isinstance(distance_meters, (int, float)):
            continue

        activity_id = normalize_activity_id(properties.get("activity_id"))
        name = properties.get("name")
        activity_type = properties.get("type")

        activity_entry = {
            "activity_id": activity_id,
            "name": name,
            "date": date_value,
            "distance_m": distance_meters,
            "distance_mi": distance_meters / METERS_PER_MILE,
            "type": activity_type,
        }
        activities.append(activity_entry)

    activities.sort(key=lambda item: item["date"])

    generated_at = datetime.now(timezone.utc).isoformat(timespec=DATE_TIME_OUTPUT_TIMESPEC)

    return {
        "generated_at": generated_at,
        "activity_count": len(activities),
        "activities": activities,
    }

def save_activity_dataset(
    geojson: Dict[str, Any],
    output_path: Path = DERIVED_ACTIVITY_JSON,
) -> Dict[str, Any]:
    """Save the derived activity dataset to disk.

    Args:
        geojson (dict): GeoJSON FeatureCollection of activities.
        output_path (Path): Destination file path for the dataset.

    Returns:
        dict: Derived dataset content.
    """
    dataset = build_activity_dataset(geojson)
    save_json_data(dataset, output_path)
    return dataset
