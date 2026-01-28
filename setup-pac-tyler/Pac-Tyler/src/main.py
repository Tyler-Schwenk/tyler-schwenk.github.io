"""Entry point for updating Pac-Tyler GeoJSON data from Strava."""

import logging
import os
import webbrowser
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv

from config import (
    ACTIVITY_DATE_INCREMENT_SECONDS,
    BATCH_SIZE,
    DEFAULT_LOOKBACK_DAYS,
    PAUSE_SPLIT_THRESHOLD_KM,
    REDIRECT_URI,
)
from src.utils.file_utils import load_existing_geojson, save_geojson
from src.utils.oauth_server import run_server
from src.utils.separate_pauses import split_activities
from src.utils.strava_client import StravaClient, activities_to_geojson

LOGGING_FORMAT = "%(asctime)s - %(levelname)s - %(message)s"

def configure_logging() -> None:
    """Configure global logging settings.

    Returns:
        None
    """
    logging.basicConfig(level=logging.INFO, format=LOGGING_FORMAT)

def load_strava_credentials() -> Tuple[str, str]:
    """Load Strava client credentials from environment variables.

    Returns:
        tuple: Client ID and client secret.

    Raises:
        ValueError: If credentials are missing.
    """
    load_dotenv()
    client_id = os.getenv("CLIENT_ID")
    client_secret = os.getenv("CLIENT_SECRET")

    if not client_id or not client_secret:
        raise ValueError(
            "CLIENT_ID and CLIENT_SECRET must be set in the environment or .env file."
        )

    return client_id, client_secret

def ensure_timezone_aware(value: datetime) -> datetime:
    """Ensure a datetime value includes timezone information.

    Args:
        value (datetime): Datetime to normalize.

    Returns:
        datetime: Timezone-aware datetime.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value

def get_most_recent_activity_date(
    existing_geojson: Dict[str, Any],
    fallback_days: int = DEFAULT_LOOKBACK_DAYS,
) -> datetime:
    """Determine the most recent activity date from existing GeoJSON.

    Args:
        existing_geojson (dict): Existing GeoJSON FeatureCollection.
        fallback_days (int): Days to look back if no data exists.

    Returns:
        datetime: Most recent activity date.
    """
    features = existing_geojson.get("features", [])
    if not features:
        return datetime.now(timezone.utc) - timedelta(days=fallback_days)

    dates: List[datetime] = []
    for feature in features:
        try:
            date_value = datetime.fromisoformat(feature["properties"]["date"])
        except (KeyError, TypeError, ValueError):
            continue
        dates.append(date_value)

    if not dates:
        return datetime.now(timezone.utc) - timedelta(days=fallback_days)

    return ensure_timezone_aware(max(dates))

def authorize_strava(strava: StravaClient) -> None:
    """Authorize the Strava client through the browser OAuth flow.

    Args:
        strava (StravaClient): Strava API client wrapper.

    Returns:
        None
    """
    url = strava.get_authorization_url()
    logging.info("Open this URL to authorize the application: %s", url)
    webbrowser.open_new(url)
    authorization_code = run_server()

    if not authorization_code:
        raise RuntimeError("Authorization failed to return a code.")

    strava.authenticate(authorization_code)

def get_next_start_date(activities: List[Dict[str, Any]]) -> datetime:
    """Compute the next start date based on the latest fetched activity.

    Args:
        activities (list): Fetched activity data dictionaries.

    Returns:
        datetime: Next start date for pagination.
    """
    latest_date = max(activity["date"] for activity in activities)
    return ensure_timezone_aware(latest_date) + timedelta(
        seconds=ACTIVITY_DATE_INCREMENT_SECONDS
    )

def update_geojson(
    strava: StravaClient,
    existing_geojson: Dict[str, Any],
) -> Dict[str, Any]:
    """Fetch new activities and save an updated GeoJSON file.

    Args:
        strava (StravaClient): Authenticated Strava client.
        existing_geojson (dict): Existing GeoJSON FeatureCollection.

    Returns:
        dict: Updated GeoJSON FeatureCollection.
    """
    start_date = get_most_recent_activity_date(existing_geojson)
    logging.info("Fetching activities since %s", start_date)

    combined_geojson = {
        "type": "FeatureCollection",
        "features": list(existing_geojson.get("features", [])),
    }

    while True:
        activities = strava.fetch_detailed_activities_batch(
            start_date=start_date,
            batch_size=BATCH_SIZE,
        )
        if not activities:
            logging.info("No more new activities found.")
            break

        batch_geojson = activities_to_geojson(activities)
        combined_geojson["features"].extend(batch_geojson["features"])

        final_geojson = split_activities(
            combined_geojson,
            threshold_km=PAUSE_SPLIT_THRESHOLD_KM,
        )
        save_geojson(final_geojson)
        logging.info("Saved batch of %s activities to GeoJSON.", len(activities))

        start_date = get_next_start_date(activities)

    return combined_geojson

def main() -> Optional[Dict[str, Any]]:
    """Run the Pac-Tyler update workflow.

    Returns:
        dict: Updated GeoJSON data if successful.
    """
    configure_logging()

    try:
        client_id, client_secret = load_strava_credentials()
    except ValueError as exc:
        logging.error("%s", exc)
        return None

    strava = StravaClient(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=REDIRECT_URI,
    )

    try:
        authorize_strava(strava)
    except RuntimeError as exc:
        logging.error("%s", exc)
        return None

    existing_geojson = load_existing_geojson()
    updated_geojson = update_geojson(strava, existing_geojson)
    logging.info("Finished updating GeoJSON with all fetched activities.")
    return updated_geojson

if __name__ == "__main__":
    main()
