"""Strava API client helpers and GeoJSON conversion utilities."""

import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from stravalib.client import Client
from stravalib.exc import RateLimitExceeded

from config import (
    BATCH_SIZE,
    JSON_INDENT,
    MAX_LATITUDE,
    MAX_LONGITUDE,
    MIN_LATITUDE,
    MIN_LONGITUDE,
    RATE_LIMIT_SLEEP_SECONDS,
    STRAVA_SCOPES,
    STRAVA_STREAM_RESOLUTION,
    STRAVA_STREAM_TYPES,
    TOKEN_REFRESH_BUFFER_SECONDS,
)
from utils.geojson_cleaner import normalize_activity_type, normalize_date


def is_valid_coordinate(coord: List[float]) -> bool:
    """Check if a coordinate falls within valid lat/lon bounds.

    Args:
        coord (list): [lat, lon] pair.

    Returns:
        bool: True if valid, False otherwise.
    """
    lat, lon = coord
    if MIN_LATITUDE <= lat <= MAX_LATITUDE and MIN_LONGITUDE <= lon <= MAX_LONGITUDE:
        return True
    logging.warning("Invalid coordinate found: %s", coord)
    return False


def activities_to_geojson(activities: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Convert a list of activity dicts to a GeoJSON FeatureCollection.

    Args:
        activities (list): Activity dicts with coordinates and metadata.

    Returns:
        dict: GeoJSON FeatureCollection.
    """
    geojson: Dict[str, Any] = {
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

        properties: Dict[str, Any] = {
            "name": activity["name"],
            "date": normalize_date(activity["date"]),
            "distance": activity["distance"],
            "type": normalize_activity_type(activity["type"]),
        }
        if activity.get("id") is not None:
            properties["activity_id"] = activity["id"]

        geojson["features"].append({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": valid_coords,
            },
            "properties": properties,
        })

    return geojson


class StravaClient:
    """Wrapper around stravalib's Client with token file support."""

    def __init__(self, client_id: str, client_secret: str, redirect_uri: str) -> None:
        """Initialize the StravaClient.

        Args:
            client_id (str): Strava API client ID.
            client_secret (str): Strava API client secret.
            redirect_uri (str): OAuth redirect URI.

        Returns:
            None
        """
        self.client = Client()
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri

    def get_authorization_url(self) -> str:
        """Generate the Strava OAuth authorization URL.

        Returns:
            str: URL to redirect the user to for authorization.
        """
        return self.client.authorization_url(
            client_id=self.client_id,
            redirect_uri=self.redirect_uri,
            scope=STRAVA_SCOPES,
        )

    def authenticate(self, code: str, token_path: Optional[Path] = None) -> None:
        """Exchange an authorization code for tokens and optionally save them.

        Args:
            code (str): Authorization code from the OAuth callback.
            token_path (Path, optional): If provided, saves the token here.

        Returns:
            None
        """
        token_response = self.client.exchange_code_for_token(
            client_id=self.client_id,
            client_secret=self.client_secret,
            code=code,
        )
        self.client.access_token = token_response["access_token"]
        logging.info("Authenticated via browser OAuth.")

        if token_path is not None:
            self.save_token(dict(token_response), token_path)

    def save_token(self, token_data: Dict[str, Any], token_path: Path) -> None:
        """Write token data to a JSON file on disk.

        Args:
            token_data (dict): Token dict with access_token, refresh_token, expires_at.
            token_path (Path): Destination file path.

        Returns:
            None

        Side Effects:
            Creates the parent directory if it doesnt exist, writes the file.
        """
        token_path.parent.mkdir(parents=True, exist_ok=True)
        with token_path.open("w", encoding="utf-8") as file_handle:
            json.dump(token_data, file_handle, indent=JSON_INDENT)
        logging.info("Token saved to %s", token_path)

    def authenticate_from_token_file(self, token_path: Path) -> bool:
        """Load a saved token and set it on the client, refreshing if expired.

        Args:
            token_path (Path): Path to the saved token JSON file.

        Returns:
            bool: True if authentication succeeded, False if no token file found.
        """
        try:
            with token_path.open("r", encoding="utf-8") as file_handle:
                token_data = json.load(file_handle)
        except FileNotFoundError:
            logging.info("No token file found at %s.", token_path)
            return False

        expires_at = token_data.get("expires_at", 0)
        if time.time() >= expires_at - TOKEN_REFRESH_BUFFER_SECONDS:
            logging.info("Token expired or expiring soon, refreshing...")
            token_data = dict(self.client.refresh_access_token(
                client_id=self.client_id,
                client_secret=self.client_secret,
                refresh_token=token_data["refresh_token"],
            ))
            self.save_token(token_data, token_path)

        self.client.access_token = token_data["access_token"]
        self.client.refresh_token = token_data.get("refresh_token")
        self.client.token_expires = token_data.get("expires_at")
        logging.info("Authenticated via saved token.")
        return True

    def iter_detailed_activities(self, start_date: datetime) -> Iterable[Dict[str, Any]]:
        """Yield detailed activity dicts for all activities after start_date.

        Args:
            start_date (datetime): Only yield activities after this date.

        Yields:
            dict: Activity dict with id, name, type, date, distance, coordinates.
        """
        start_timestamp = start_date.timestamp()

        try:
            summary_activities = self.client.get_activities(after=start_date)
        except RateLimitExceeded as exc:
            logging.warning(
                "Rate limit hit before fetching. Waiting %s seconds. Details: %s",
                RATE_LIMIT_SLEEP_SECONDS,
                exc,
            )
            time.sleep(RATE_LIMIT_SLEEP_SECONDS)
            return

        for summary_activity in summary_activities:
            activity_date = summary_activity.start_date or summary_activity.start_date_local
            if not activity_date or activity_date.timestamp() <= start_timestamp:
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
                    "Rate limit hit mid-fetch. Waiting %s seconds. Details: %s",
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
