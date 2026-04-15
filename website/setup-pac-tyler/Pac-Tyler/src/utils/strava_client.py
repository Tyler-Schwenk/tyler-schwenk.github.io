"""Strava API client helpers and GeoJSON conversion utilities."""

import logging
import time
from datetime import datetime
from typing import Any, Dict, Iterable, List

from stravalib.client import Client
from stravalib.exc import RateLimitExceeded

from config import (
    BATCH_SIZE,
    MAX_LATITUDE,
    MAX_LONGITUDE,
    MIN_LATITUDE,
    MIN_LONGITUDE,
    RATE_LIMIT_SLEEP_SECONDS,
    STRAVA_SCOPES,
    STRAVA_STREAM_RESOLUTION,
    STRAVA_STREAM_TYPES,
)
from src.utils.geojson_cleaner import normalize_activity_type, normalize_date

def is_valid_coordinate(coord: List[float]) -> bool:
    """Validate if a coordinate is within latitude and longitude bounds.

    Args:
        coord (list): List containing latitude and longitude.

    Returns:
        bool: True if coordinate is valid, False otherwise.
    """
    lat, lon = coord
    if MIN_LATITUDE <= lat <= MAX_LATITUDE and MIN_LONGITUDE <= lon <= MAX_LONGITUDE:
        return True

    logging.warning("Invalid coordinate found: %s", coord)
    return False

def activities_to_geojson(activities: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Convert a list of activity dictionaries to GeoJSON.

    Args:
        activities (list): List of activities with their coordinates.

    Returns:
        dict: GeoJSON formatted data.
    """
    geojson = {
        "type": "FeatureCollection",
        "features": [],
    }
    for activity in activities:
        if not activity.get("coordinates"):
            continue

        valid_coords = [
            [lon, lat]
            for lat, lon in activity["coordinates"]
            if is_valid_coordinate([lat, lon])
        ]
        if not valid_coords:
            continue

        properties = {
            "name": activity["name"],
            "date": normalize_date(activity["date"]),
            "distance": activity["distance"],
            "type": normalize_activity_type(activity["type"]),
        }
        if activity.get("id") is not None:
            properties["activity_id"] = activity["id"]

        feature = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": valid_coords,
            },
            "properties": properties,
        }
        geojson["features"].append(feature)
    return geojson

class StravaClient:
    """Wrapper around Strava's API client with helper methods."""

    def __init__(self, client_id: str, client_secret: str, redirect_uri: str) -> None:
        """Initialize the StravaClient with the given credentials and URI.

        Args:
            client_id (str): Client ID for Strava API.
            client_secret (str): Client Secret for Strava API.
            redirect_uri (str): Redirect URI for OAuth.

        Returns:
            None
        """
        self.client = Client()
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        logging.debug("StravaClient initialized with client_id=%s", client_id)

    def get_authorization_url(self) -> str:
        """Generate the authorization URL for Strava OAuth.

        Returns:
            str: The authorization URL.
        """
        url = self.client.authorization_url(
            client_id=self.client_id,
            redirect_uri=self.redirect_uri,
            scope=STRAVA_SCOPES,
        )
        logging.debug("Authorization URL with scope %s", STRAVA_SCOPES)
        return url

    def authenticate(self, code: str) -> None:
        """Authenticate the Strava client using an authorization code.

        Args:
            code (str): The authorization code received from Strava.

        Returns:
            None
        """
        logging.debug("Exchanging authorization code for token")
        token_response = self.client.exchange_code_for_token(
            client_id=self.client_id,
            client_secret=self.client_secret,
            code=code,
        )
        self.client.access_token = token_response["access_token"]
        logging.debug("Access token received")

    def fetch_detailed_activities_batch(
        self,
        start_date,
        batch_size: int = BATCH_SIZE,
    ) -> List[Dict[str, Any]]:
        """Fetch a batch of detailed activities from Strava.

        Args:
            start_date (datetime): Date to start fetching activities from.
            batch_size (int): Number of activities to fetch in each batch.

        Returns:
            list: List of detailed activity data dictionaries.
        """
        activities: List[Dict[str, Any]] = []

        try:
            logging.info("Fetching up to %s activities starting from %s", batch_size, start_date)
            summary_activities = list(
                self.client.get_activities(after=start_date, limit=batch_size)
            )

            start_timestamp = start_date.timestamp()

            for summary_activity in summary_activities:
                activity_date = summary_activity.start_date or summary_activity.start_date_local
                activity_timestamp = activity_date.timestamp()
                if activity_timestamp <= start_timestamp:
                    continue

                full_activity = self.client.get_activity(summary_activity.id)
                streams = self.client.get_activity_streams(
                    full_activity.id,
                    types=STRAVA_STREAM_TYPES,
                    resolution=STRAVA_STREAM_RESOLUTION,
                )
                coordinates = streams.get("latlng").data if "latlng" in streams else []
                logging.debug(
                    "Fetched %s coordinates for activity %s",
                    len(coordinates),
                    full_activity.name,
                )

                activities.append(
                    {
                        "id": full_activity.id,
                        "name": full_activity.name,
                        "type": str(full_activity.type),
                        "date": full_activity.start_date_local,
                        "distance": float(full_activity.distance),
                        "coordinates": coordinates,
                    }
                )

        except RateLimitExceeded as exc:
            logging.warning(
                "Short term API rate limit exceeded. Waiting %s seconds. Details: %s",
                RATE_LIMIT_SLEEP_SECONDS,
                exc,
            )
            time.sleep(RATE_LIMIT_SLEEP_SECONDS)

        return activities

    def iter_detailed_activities(self, start_date: datetime) -> Iterable[Dict[str, Any]]:
        """Iterate detailed activities after the given start date.

        Args:
            start_date (datetime): Date to start fetching activities from.

        Yields:
            dict: Detailed activity data dictionary.
        """
        start_timestamp = start_date.timestamp()

        try:
            summary_activities = self.client.get_activities(after=start_date)
        except RateLimitExceeded as exc:
            logging.warning(
                "Short term API rate limit exceeded. Waiting %s seconds. Details: %s",
                RATE_LIMIT_SLEEP_SECONDS,
                exc,
            )
            time.sleep(RATE_LIMIT_SLEEP_SECONDS)
            return

        for summary_activity in summary_activities:
            activity_date = summary_activity.start_date or summary_activity.start_date_local
            if not activity_date:
                continue

            activity_timestamp = activity_date.timestamp()
            if activity_timestamp <= start_timestamp:
                continue

            try:
                full_activity = self.client.get_activity(summary_activity.id)
                streams = self.client.get_activity_streams(
                    full_activity.id,
                    types=STRAVA_STREAM_TYPES,
                    resolution=STRAVA_STREAM_RESOLUTION,
                )
            except RateLimitExceeded as exc:
                logging.warning(
                    "Short term API rate limit exceeded. Waiting %s seconds. Details: %s",
                    RATE_LIMIT_SLEEP_SECONDS,
                    exc,
                )
                time.sleep(RATE_LIMIT_SLEEP_SECONDS)
                continue

            coordinates = streams.get("latlng").data if "latlng" in streams else []
            logging.debug(
                "Fetched %s coordinates for activity %s",
                len(coordinates),
                full_activity.name,
            )

            yield {
                "id": full_activity.id,
                "name": full_activity.name,
                "type": str(full_activity.type),
                "date": full_activity.start_date_local,
                "distance": float(full_activity.distance),
                "coordinates": coordinates,
            }


