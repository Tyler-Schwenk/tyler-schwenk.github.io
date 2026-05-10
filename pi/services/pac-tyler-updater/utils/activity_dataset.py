"""Utilities for building and exporting Pac-Tyler activity datasets."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import DATE_TIME_OUTPUT_TIMESPEC, DERIVED_ACTIVITY_JSON, METERS_PER_MILE
from utils.file_utils import save_json_data


def normalize_activity_id(value: Any) -> Optional[str]:
    """Normalize an activity identifier for export.

    Args:
        value (Any): Raw activity ID value.

    Returns:
        Optional[str]: Normalized string ID, or None.
    """
    if value is None:
        return None
    return str(value)


def build_activity_dataset(geojson: Dict[str, Any]) -> Dict[str, Any]:
    """Build a normalized activity dataset from GeoJSON input.

    strips out coordinate data and produces a flat list of activity
    records suitable for the frontend analytics chart.

    Args:
        geojson (dict): GeoJSON FeatureCollection of activities.

    Returns:
        dict: Derived dataset with generated_at, activity_count, and activities list.
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

        activities.append({
            "activity_id": normalize_activity_id(properties.get("activity_id")),
            "name": properties.get("name"),
            "date": date_value,
            "distance_m": distance_meters,
            "distance_mi": distance_meters / METERS_PER_MILE,
            "type": properties.get("type"),
        })

    activities.sort(key=lambda item: item["date"])

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec=DATE_TIME_OUTPUT_TIMESPEC),
        "activity_count": len(activities),
        "activities": activities,
    }


def save_activity_dataset(
    geojson: Dict[str, Any],
    output_path: Path = DERIVED_ACTIVITY_JSON,
) -> Dict[str, Any]:
    """Build and save the derived activity dataset to disk.

    Args:
        geojson (dict): GeoJSON FeatureCollection of activities.
        output_path (Path): Destination file path.

    Returns:
        dict: The dataset that was written.
    """
    dataset = build_activity_dataset(geojson)
    save_json_data(dataset, output_path)
    return dataset
