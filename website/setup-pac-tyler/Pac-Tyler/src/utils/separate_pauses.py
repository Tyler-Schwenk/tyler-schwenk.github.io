"""Utilities to split activities at large pauses."""

from typing import Any, Dict, List
from geopy.distance import geodesic

from config import PAUSE_SPLIT_THRESHOLD_KM

def split_activities(
    activities: Dict[str, Any],
    threshold_km: float = PAUSE_SPLIT_THRESHOLD_KM,
) -> Dict[str, List[Dict[str, Any]]]:
    """Split activities when large gaps are detected between points.

    Args:
        activities (dict): GeoJSON FeatureCollection of activity tracks.
        threshold_km (float): Distance threshold in kilometers to split tracks.

    Returns:
        dict: GeoJSON FeatureCollection with split segments.
    """
    new_activities: List[Dict[str, Any]] = []

    for activity in activities.get("features", []):
        coordinates = activity["geometry"]["coordinates"]
        properties = activity["properties"]

        if len(coordinates) < 2:
            continue

        new_segments: List[List[List[float]]] = []
        current_segment = [coordinates[0]]

        for index in range(1, len(coordinates)):
            prev_point = coordinates[index - 1]
            current_point = coordinates[index]
            distance_km = geodesic(
                (prev_point[1], prev_point[0]),
                (current_point[1], current_point[0]),
            ).km

            if distance_km > threshold_km:
                new_segments.append(current_segment)
                current_segment = [current_point]
                continue

            current_segment.append(current_point)

        new_segments.append(current_segment)

        for segment in new_segments:
            new_activity = {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": segment,
                },
                "properties": properties,
            }
            new_activities.append(new_activity)

    return {
        "type": "FeatureCollection",
        "features": new_activities,
    }


