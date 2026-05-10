"""Utilities to split activity tracks at large pauses."""

from typing import Any, Dict, List

from geopy.distance import geodesic

from config import PAUSE_SPLIT_THRESHOLD_KM


def split_activities(
    activities: Dict[str, Any],
    threshold_km: float = PAUSE_SPLIT_THRESHOLD_KM,
) -> Dict[str, Any]:
    """Split activity tracks when a large gap is detected between GPS points.

    strava sometimes leaves a straight line between where you paused and
    unpaused, which would draw a fake path across the map. this removes those.

    Args:
        activities (dict): GeoJSON FeatureCollection of activity tracks.
        threshold_km (float): Gap distance in km that triggers a split.

    Returns:
        dict: GeoJSON FeatureCollection with split segments as separate features.
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
            new_activities.append({
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": segment,
                },
                "properties": properties,
            })

    return {
        "type": "FeatureCollection",
        "features": new_activities,
    }
