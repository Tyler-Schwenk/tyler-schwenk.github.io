"""
Kiln weather -- the outdoor temperature the kiln cools toward, from the Open-Meteo forecast.

The kiln's outdoors, so its cooldown near the end depends on the weather. The location is
only city-level (see KILN_WEATHER_LATITUDE in config), since this goes to an outside service
and the result ends up on a public page.

The forecast is optional: if it can't be fetched, callers get the last good value or None,
and the kiln page falls back to assuming a typical temperature.
"""

import logging
import threading
import time
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
# roughly how long what's left of a cooldown lasts, so it covers a day and night swing
FORECAST_HOURS = 12
FETCH_TIMEOUT_S = 5
REFRESH_AFTER_S = 30 * 60
RETRY_AFTER_FAILURE_S = 5 * 60
# after this, an old forecast is worse than admitting there isn't one
MAX_STALE_S = 6 * 60 * 60

_lock = threading.Lock()
_average_c: Optional[float] = None
_fetched_at_s = 0.0
_next_fetch_at_s = 0.0


def _fetch_average_c() -> float:
    """
    Fetches the average forecast temperature over the next few hours.

    Returns:
        float: The average, in Celsius.

    Raises:
        httpx.HTTPError: If the request fails.
        KeyError, TypeError, ValueError, ZeroDivisionError: If the response isn't what's expected.
    """
    response = httpx.get(
        FORECAST_URL,
        params={
            "latitude": settings.KILN_WEATHER_LATITUDE,
            "longitude": settings.KILN_WEATHER_LONGITUDE,
            "hourly": "temperature_2m",
            "forecast_hours": FORECAST_HOURS,
        },
        timeout=FETCH_TIMEOUT_S,
    )
    response.raise_for_status()
    temps_c = [float(temp_c) for temp_c in response.json()["hourly"]["temperature_2m"]]
    return sum(temps_c) / len(temps_c)


def get_outdoor_forecast_c() -> Optional[float]:
    """
    Gets the average outdoor temperature over the next few hours, cached between fetches.

    Side effects: fetches from Open-Meteo when the cached value is due for a refresh, which
    can hold up the caller for up to FETCH_TIMEOUT_S. Failures are logged, not raised.

    Returns:
        Optional[float]: The average in Celsius, or None if there's no recent forecast.
    """
    global _average_c, _fetched_at_s, _next_fetch_at_s
    with _lock:
        now_s = time.monotonic()
        if now_s >= _next_fetch_at_s:
            try:
                _average_c = _fetch_average_c()
                _fetched_at_s = now_s
                _next_fetch_at_s = now_s + REFRESH_AFTER_S
            except (httpx.HTTPError, KeyError, TypeError, ValueError, ZeroDivisionError) as error:
                _next_fetch_at_s = now_s + RETRY_AFTER_FAILURE_S
                logger.warning(
                    "kiln: couldn't get the outdoor forecast from open-meteo (%s), retrying in %d s. "
                    "the calculator assumes a typical temperature until then",
                    error,
                    RETRY_AFTER_FAILURE_S,
                )
        is_recent = _average_c is not None and now_s - _fetched_at_s <= MAX_STALE_S
        return _average_c if is_recent else None
