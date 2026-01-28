"""Strava API client helpers and GeoJSON conversion utilities."""

import logging
import time
from typing import Any, Dict, List

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

        feature = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": valid_coords,
            },
            "properties": {
                "name": activity["name"],
                "date": str(activity["date"]),
                "distance": activity["distance"],
                "type": activity["type"],
            },
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

            for summary_activity in summary_activities:
                if summary_activity.start_date_local <= start_date:
                    return activities

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

