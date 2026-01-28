"""Centralized configuration for the Pac-Tyler data updater."""

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

OAUTH_PORT = 8080
REDIRECT_URI = f"http://localhost:{OAUTH_PORT}"

DEFAULT_LOOKBACK_DAYS = 365
BATCH_SIZE = 5
ACTIVITY_DATE_INCREMENT_SECONDS = 1

PAUSE_SPLIT_THRESHOLD_KM = 0.5

STRAVA_SCOPES = ["read_all", "activity:read_all"]
STRAVA_STREAM_TYPES = ["latlng"]
STRAVA_STREAM_RESOLUTION = "medium"

RATE_LIMIT_SLEEP_SECONDS = 15 * 60

MIN_LATITUDE = -90.0
MAX_LATITUDE = 90.0
MIN_LONGITUDE = -180.0
MAX_LONGITUDE = 180.0

JSON_INDENT = 4

GEOJSON_FILE = REPO_ROOT / "cleaned_output.geojson"