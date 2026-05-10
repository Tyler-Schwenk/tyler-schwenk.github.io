"""Headless entry point for the Pac-Tyler daily data updater.

run this on a schedule (systemd timer, cron, etc.). it uses a saved strava
refresh token so no browser is needed. run auth_setup.py once first to
bootstrap the token file.
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from dotenv import load_dotenv

from config import (
    ACTIVITY_DATE_INCREMENT_SECONDS,
    BATCH_SIZE,
    DEFAULT_LOOKBACK_DAYS,
    DOTENV_FILE,
    GEOJSON_FILE,
    LOOKBACK_DAYS_ENV_VAR,
    PAUSE_SPLIT_THRESHOLD_KM,
    RECENT_ACTIVITY_LOOKBACK_DAYS,
    REDIRECT_URI,
    SILENCE_TOKEN_WARNINGS_ENV_VAR,
    TOKEN_FILE,
)
from utils.file_utils import load_existing_geojson, save_geojson
from utils.activity_dataset import save_activity_dataset
from utils.geojson_cleaner import clean_geojson
from utils.separate_pauses import split_activities
from utils.strava_client import StravaClient, activities_to_geojson

LOGGING_FORMAT = "%(asctime)s - %(levelname)s - %(message)s"


def configure_logging() -> None:
    """Configure global logging settings.

    Returns:
        None
    """
    logging.basicConfig(level=logging.INFO, format=LOGGING_FORMAT)
    logging.getLogger("stravalib").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)


def load_strava_credentials() -> tuple[str, str]:
    """Load Strava client credentials from environment variables.

    Returns:
        tuple: Client ID and client secret.

    Raises:
        ValueError: If credentials are missing.
    """
    if DOTENV_FILE.exists():
        load_dotenv(dotenv_path=DOTENV_FILE, override=False)

    client_id = os.getenv("CLIENT_ID")
    client_secret = os.getenv("CLIENT_SECRET")

    if not client_id or not client_secret:
        raise ValueError(
            "CLIENT_ID and CLIENT_SECRET must be set in the environment or .env file. "
            "Check that your .env exists next to main.py."
        )

    return client_id, client_secret


def set_strava_env_credentials(client_id: str, client_secret: str) -> None:
    """Set Strava environment variables for downstream library usage.

    Args:
        client_id (str): Strava client ID.
        client_secret (str): Strava client secret.

    Returns:
        None

    Side Effects:
        Updates process environment variables.
    """
    os.environ.setdefault("STRAVA_CLIENT_ID", client_id)
    os.environ.setdefault("STRAVA_CLIENT_SECRET", client_secret)
    os.environ.setdefault(SILENCE_TOKEN_WARNINGS_ENV_VAR, "true")


def get_lookback_days_from_env(default_days: int) -> int:
    """Get the lookback window in days from environment variables.

    Args:
        default_days (int): Fallback if env var is absent or invalid.

    Returns:
        int: Lookback window in days.
    """
    raw_value = os.getenv(LOOKBACK_DAYS_ENV_VAR)
    if raw_value is None:
        return default_days

    try:
        value = int(raw_value)
    except ValueError:
        logging.warning("Invalid %s value: %s", LOOKBACK_DAYS_ENV_VAR, raw_value)
        return default_days

    if value < 0:
        logging.warning("%s cannot be negative: %s", LOOKBACK_DAYS_ENV_VAR, raw_value)
        return default_days

    return value


def ensure_timezone_aware(value: datetime) -> datetime:
    """Ensure a datetime has timezone info attached.

    Args:
        value (datetime): Datetime to normalize.

    Returns:
        datetime: Timezone-aware datetime (UTC if none was set).
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
        fallback_days (int): Days to look back if there's no data yet.

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


def get_start_date(
    existing_geojson: Dict[str, Any],
    lookback_days: int = RECENT_ACTIVITY_LOOKBACK_DAYS,
) -> datetime:
    """Compute the start date for fetching new activities.

    applies a lookback window so we dont miss activities that were uploaded
    slightly after their actual date.

    Args:
        existing_geojson (dict): Existing GeoJSON FeatureCollection.
        lookback_days (int): Days to look back from the most recent activity.

    Returns:
        datetime: Start date for the Strava fetch.
    """
    most_recent_date = get_most_recent_activity_date(existing_geojson)
    most_recent_date = ensure_timezone_aware(most_recent_date)
    has_features = bool(existing_geojson.get("features"))

    if has_features and lookback_days > 0:
        most_recent_date -= timedelta(days=lookback_days)

    return most_recent_date + timedelta(seconds=ACTIVITY_DATE_INCREMENT_SECONDS)


def build_activity_key(properties: Dict[str, Any]) -> str:
    """Build a stable identifier for a GeoJSON activity feature.

    Args:
        properties (dict): GeoJSON properties dict for one activity.

    Returns:
        str: Stable key suitable for de-duplication.
    """
    activity_id = properties.get("activity_id")
    if activity_id is not None:
        return f"id:{activity_id}"

    name = properties.get("name", "")
    date_value = properties.get("date", "")
    distance = properties.get("distance", "")
    return f"meta:{name}|{date_value}|{distance}"


def get_existing_activity_keys(existing_geojson: Dict[str, Any]) -> Set[str]:
    """Collect de-duplication keys for all features in the GeoJSON.

    Args:
        existing_geojson (dict): Existing GeoJSON FeatureCollection.

    Returns:
        set: Keys representing already-stored activities.
    """
    keys: Set[str] = set()
    for feature in existing_geojson.get("features", []):
        properties = feature.get("properties", {})
        keys.add(build_activity_key(properties))
    return keys


def filter_new_features(
    features: List[Dict[str, Any]],
    existing_keys: Set[str],
) -> List[Dict[str, Any]]:
    """Filter out features we already have in the GeoJSON.

    Args:
        features (list): Candidate GeoJSON features from this batch.
        existing_keys (set): Known activity keys (mutated in place to stay current).

    Returns:
        list: Only the genuinely new features.
    """
    new_features: List[Dict[str, Any]] = []
    for feature in features:
        properties = feature.get("properties", {})
        key = build_activity_key(properties)
        if key in existing_keys:
            continue
        existing_keys.add(key)
        new_features.append(feature)
    return new_features


def process_activity_batch(
    activities: List[Dict[str, Any]],
    combined_geojson: Dict[str, Any],
    existing_keys: Set[str],
) -> int:
    """Convert a batch of activities to GeoJSON, dedupe, and write to disk.

    Args:
        activities (list): Activity payloads fetched from Strava.
        combined_geojson (dict): Current full GeoJSON collection (mutated in place).
        existing_keys (set): Known activity keys for de-duplication.

    Returns:
        int: Number of new features added.
    """
    batch_geojson = activities_to_geojson(activities)
    new_features = filter_new_features(batch_geojson["features"], existing_keys)
    if not new_features:
        return 0

    combined_geojson["features"].extend(new_features)
    final_geojson = split_activities(combined_geojson, threshold_km=PAUSE_SPLIT_THRESHOLD_KM)
    cleaned_geojson = clean_geojson(final_geojson)
    save_geojson(cleaned_geojson)
    save_activity_dataset(cleaned_geojson)
    return len(new_features)


def update_geojson(
    strava: StravaClient,
    existing_geojson: Dict[str, Any],
) -> Dict[str, Any]:
    """Fetch new activities from Strava and save an updated GeoJSON file.

    Args:
        strava (StravaClient): Authenticated Strava client.
        existing_geojson (dict): Existing GeoJSON FeatureCollection.

    Returns:
        dict: Updated GeoJSON FeatureCollection.
    """
    lookback_days = get_lookback_days_from_env(RECENT_ACTIVITY_LOOKBACK_DAYS)
    most_recent_date = get_most_recent_activity_date(existing_geojson)
    start_date = get_start_date(existing_geojson, lookback_days=lookback_days)

    logging.info("Most recent stored activity: %s", most_recent_date)
    logging.info("Lookback window: %s days", lookback_days)
    logging.info("Fetching activities after %s", start_date)

    combined_geojson = {
        "type": "FeatureCollection",
        "features": list(existing_geojson.get("features", [])),
    }
    existing_keys = get_existing_activity_keys(existing_geojson)

    batch: List[Dict[str, Any]] = []
    new_feature_count = 0
    fetched_any = False
    fetched_count = 0
    earliest_fetched: Optional[datetime] = None
    latest_fetched: Optional[datetime] = None

    for activity in strava.iter_detailed_activities(start_date):
        fetched_any = True
        fetched_count += 1
        activity_date = ensure_timezone_aware(activity["date"])
        earliest_fetched = min(earliest_fetched, activity_date) if earliest_fetched else activity_date
        latest_fetched = max(latest_fetched, activity_date) if latest_fetched else activity_date
        batch.append(activity)

        if len(batch) < BATCH_SIZE:
            continue

        added = process_activity_batch(batch, combined_geojson, existing_keys)
        new_feature_count += added
        if added:
            logging.info("Saved %s new activities to GeoJSON.", added)
        batch = []

    if batch:
        added = process_activity_batch(batch, combined_geojson, existing_keys)
        new_feature_count += added
        if added:
            logging.info("Saved %s new activities to GeoJSON.", added)

    if not fetched_any:
        logging.info("No new activities found after %s.", start_date)
    else:
        logging.info("Fetched %s activities from Strava.", fetched_count)
        logging.info("Date range: %s to %s", earliest_fetched, latest_fetched)
        if not new_feature_count:
            logging.info("All fetched activities were already in the GeoJSON.")

    # always re-clean and re-save the dataset even if nothing new, keeps files consistent
    if not new_feature_count:
        final_geojson = split_activities(combined_geojson, threshold_km=PAUSE_SPLIT_THRESHOLD_KM)
        cleaned_geojson = clean_geojson(final_geojson)
        save_geojson(cleaned_geojson)
        save_activity_dataset(cleaned_geojson)
        logging.info("Saved cleaned GeoJSON with %s features.", len(cleaned_geojson["features"]))

    return combined_geojson


def main() -> Optional[Dict[str, Any]]:
    """Run the headless Pac-Tyler update workflow.

    loads a saved strava token, refreshes it if needed, fetches new
    activities, and writes updated GeoJSON and activity dataset files.

    Returns:
        dict: Updated GeoJSON data if successful, None on failure.
    """
    configure_logging()

    try:
        client_id, client_secret = load_strava_credentials()
    except ValueError as exc:
        logging.error("%s", exc)
        return None

    set_strava_env_credentials(client_id, client_secret)

    strava = StravaClient(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=REDIRECT_URI,
    )

    if not strava.authenticate_from_token_file(TOKEN_FILE):
        logging.error(
            "No valid token at %s. Run auth_setup.py once to authorize with Strava, "
            "then try again.",
            TOKEN_FILE,
        )
        return None

    existing_geojson = load_existing_geojson()
    updated_geojson = update_geojson(strava, existing_geojson)
    logging.info("Finished updating GeoJSON.")
    return updated_geojson


if __name__ == "__main__":
    main()
