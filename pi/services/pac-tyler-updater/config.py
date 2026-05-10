"""Centralized configuration for the Pac-Tyler data updater."""

import os
from pathlib import Path

# data dir is configurable so it can differ between local dev and the Pi
DATA_DIR = Path(os.getenv("PAC_TYLER_DATA_DIR", "/home/tyler/pac-tyler-data"))

GEOJSON_FILE = DATA_DIR / "cleaned_output.geojson"
DERIVED_ACTIVITY_JSON = DATA_DIR / "pac-tyler-activities.json"
TOKEN_FILE = DATA_DIR / "strava_token.json"

DOTENV_FILE = Path(__file__).resolve().parent / ".env"

OAUTH_PORT = 8080
REDIRECT_URI = f"http://localhost:{OAUTH_PORT}"

DEFAULT_LOOKBACK_DAYS = 365
RECENT_ACTIVITY_LOOKBACK_DAYS = 7
BATCH_SIZE = 5
ACTIVITY_DATE_INCREMENT_SECONDS = 1

LOOKBACK_DAYS_ENV_VAR = "PAC_TYLER_LOOKBACK_DAYS"
SILENCE_TOKEN_WARNINGS_ENV_VAR = "SILENCE_TOKEN_WARNINGS"

# refresh the strava token this many seconds before it actually expires
TOKEN_REFRESH_BUFFER_SECONDS = 5 * 60

DATE_TIME_OUTPUT_TIMESPEC = "seconds"

MIN_COORDINATES_PER_FEATURE = 2
MIN_COORDINATE_DISTANCE_METERS = 0
MAX_COORDINATES_PER_FEATURE = 0

PAUSE_SPLIT_THRESHOLD_KM = 2.0

STRAVA_SCOPES = ["read_all", "activity:read_all"]
STRAVA_STREAM_TYPES = ["latlng"]
STRAVA_STREAM_RESOLUTION = "medium"

RATE_LIMIT_SLEEP_SECONDS = 15 * 60

MIN_LATITUDE = -90.0
MAX_LATITUDE = 90.0
MIN_LONGITUDE = -180.0
MAX_LONGITUDE = 180.0

JSON_INDENT = 4
METERS_PER_MILE = 1609.34
