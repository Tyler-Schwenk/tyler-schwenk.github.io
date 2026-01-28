"""Utilities for normalizing and reducing GeoJSON activity data."""

from __future__ import annotations

import math
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from config import (
    DATE_TIME_OUTPUT_TIMESPEC,
    MAX_COORDINATES_PER_FEATURE,
    MAX_LATITUDE,
    MAX_LONGITUDE,
    MIN_COORDINATE_DISTANCE_METERS,
    MIN_COORDINATES_PER_FEATURE,
    MIN_LATITUDE,
    MIN_LONGITUDE,
)

TYPE_ROOT_PATTERN = re.compile(r"root='([^']+)'", re.IGNORECASE)
EARTH_RADIUS_METERS = 6371000

def normalize_activity_type(value: Any) -> Optional[str]:
    """Normalize an activity type value to a clean string.

    Args:
        value (Any): Raw activity type value.

    Returns:
        Optional[str]: Normalized activity type string.
    """
    if value is None:
        return None

    value_str = str(value).strip()
    if not value_str:
        return None

    match = TYPE_ROOT_PATTERN.search(value_str)
    if match:
        return match.group(1).strip()

    return value_str

def normalize_date(value: Any) -> Optional[str]:
    """Normalize an activity date string to ISO 8601 format.

    Args:
        value (Any): Raw date value.

    Returns:
        Optional[str]: Normalized ISO 8601 date string.
    """
    if value is None:
        return None

    value_str = str(value).strip()
    if not value_str:
        return None

    try:
        parsed = datetime.fromisoformat(value_str)
    except ValueError:
        return value_str

    return parsed.isoformat(timespec=DATE_TIME_OUTPUT_TIMESPEC)

def haversine_meters(start: List[float], end: List[float]) -> float:
    """Compute the distance between two lon/lat points in meters.

    Args:
        start (list): Start coordinate in [lon, lat].
        end (list): End coordinate in [lon, lat].

    Returns:
        float: Distance in meters.
    """
    start_lon, start_lat = start
    end_lon, end_lat = end

    delta_lat = math.radians(end_lat - start_lat)
    delta_lon = math.radians(end_lon - start_lon)

    start_lat_rad = math.radians(start_lat)
    end_lat_rad = math.radians(end_lat)

    sin_lat = math.sin(delta_lat / 2)
    sin_lon = math.sin(delta_lon / 2)
    a_value = sin_lat * sin_lat + math.cos(start_lat_rad) * math.cos(end_lat_rad) * sin_lon * sin_lon
    c_value = 2 * math.atan2(math.sqrt(a_value), math.sqrt(1 - a_value))
    return EARTH_RADIUS_METERS * c_value

def reduce_coordinates(
    coordinates: List[List[float]],
    min_distance_meters: int = MIN_COORDINATE_DISTANCE_METERS,
    max_points: int = MAX_COORDINATES_PER_FEATURE,
) -> List[List[float]]:
    """Reduce coordinates by removing points closer than a threshold.

    Args:
        coordinates (list): Coordinate list in [lon, lat] pairs.
        min_distance_meters (int): Minimum distance between retained points.
        max_points (int): Optional hard cap on points; 0 disables the cap.

    Returns:
        list: Reduced coordinate list.
    """
    if min_distance_meters <= 0 and max_points <= 0:
        return coordinates

    if len(coordinates) < MIN_COORDINATES_PER_FEATURE:
        return coordinates

    reduced = [coordinates[0]]
    for point in coordinates[1:-1]:
        if haversine_meters(reduced[-1], point) < min_distance_meters:
            continue
        reduced.append(point)

    if reduced[-1] != coordinates[-1]:
        reduced.append(coordinates[-1])

    if max_points <= 0 or len(reduced) <= max_points:
        return reduced

    stride = math.ceil((len(reduced) - 1) / (max_points - 1))
    capped = reduced[0::stride]
    if capped[-1] != reduced[-1]:
        capped.append(reduced[-1])

    return capped[:max_points]

def clean_feature(feature: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Clean an individual GeoJSON feature.

    Args:
        feature (dict): GeoJSON feature.

    Returns:
        Optional[dict]: Cleaned feature or None if invalid.
    """
    geometry = feature.get("geometry", {})
    coordinates = geometry.get("coordinates", [])
    if not isinstance(coordinates, list):
        return None
    cleaned_coordinates = filter_valid_coordinates(coordinates)
    cleaned_coordinates = reduce_coordinates(cleaned_coordinates)
    if len(cleaned_coordinates) < MIN_COORDINATES_PER_FEATURE:
        return None
    properties = dict(feature.get("properties", {}))

    normalized_type = normalize_activity_type(properties.get("type"))
    if normalized_type:
        properties["type"] = normalized_type

    normalized_date = normalize_date(properties.get("date"))
    if normalized_date:
        properties["date"] = normalized_date

    return {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": cleaned_coordinates,
        },
        "properties": properties,
    }

def filter_valid_coordinates(coordinates: List[List[float]]) -> List[List[float]]:
    """Remove coordinates that are outside valid latitude/longitude bounds.

    Args:
        coordinates (list): Coordinate list in [lon, lat] pairs.

    Returns:
        list: Filtered coordinate list.
    """
    valid_coordinates: List[List[float]] = []
    for point in coordinates:
        if not isinstance(point, list) or len(point) != 2:
            continue
        lon, lat = point
        if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
            continue
        if MIN_LATITUDE <= lat <= MAX_LATITUDE and MIN_LONGITUDE <= lon <= MAX_LONGITUDE:
            valid_coordinates.append([lon, lat])
    return valid_coordinates

def clean_geojson(geojson: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize and reduce GeoJSON activity data.

    Args:
        geojson (dict): GeoJSON FeatureCollection.

    Returns:
        dict: Cleaned GeoJSON FeatureCollection.
    """
    cleaned_features: List[Dict[str, Any]] = []
    for feature in geojson.get("features", []):
        cleaned_feature = clean_feature(feature)
        if cleaned_feature is None:
            continue
        cleaned_features.append(cleaned_feature)

    return {
        "type": "FeatureCollection",
        "features": cleaned_features,
    }