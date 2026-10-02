"""surf conditions for the cams: swell and wind from open-meteo, tides from noaa.

get_conditions() turns a cam's location into structured readings (swell, wind, tide).
two views are built from them: get_metrics() makes the short lines for the video
overlay, and conditions_to_json() feeds the /display page's conditions panel (served by
the agent at GET /cams/<cam>/conditions). anything that comes from somewhere other than
the cam's own spot says where, so a faraway reading is never passed off as local.

built so a flaky api can't take the overlay or panel down:
  - each reading is fetched on its own thread and fails on its own, so a missing swell
    reading still leaves wind and tide, and a hanging api only costs one timeout
  - any error at all (network, bad json, a field we didn't expect) just drops that line
  - if a refresh fails, the last good reading is reused for a while before being dropped
  - after a failure the api isn't retried for FAILURE_RETRY_S, so an outage doesn't add a
    timeout to every cam change

all apis are free and keyless. results are cached for CACHE_TTL_S so a rotation that
shows the cams every few minutes doesn't hammer them.
"""

import json
import logging
import math
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Callable, Optional
from zoneinfo import ZoneInfo

MARINE_API_URL = "https://marine-api.open-meteo.com/v1/marine"
WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast"
TIDE_API_URL = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"

TIMEZONE = "America/Los_Angeles"
REQUEST_TIMEOUT_S = 5
CACHE_TTL_S = 600

# when a refresh fails, keep showing the last good reading this long before dropping it.
# swell/wind drift over hours; tide predictions are fixed so they stay good for a day
STALE_MAX_AGE_S = 2 * 3600
TIDE_STALE_MAX_AGE_S = 24 * 3600

# after a fetch fails with nothing usable to fall back on, wait this long before trying again
FAILURE_RETRY_S = 60

# a reading from a source closer than this to the cam counts as "here" and gets no source tag
LOCAL_RADIUS_KM = 1.0
EARTH_RADIUS_KM = 6371.0

# only mention gusts when they're meaningfully above the steady wind
GUST_NOTE_MIN_MPH = 5

# noaa tide predictions span yesterday through tomorrow so we always have an extreme on
# each side of "now" to interpolate the current height between
TIDE_PREDICTION_START_DAYS_AGO = 1
TIDE_PREDICTION_RANGE_H = 72

COMPASS_POINTS = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
]

log = logging.getLogger("surf-conditions")


@dataclass(frozen=True)
class Site:
    """a place on the map: where a cam is, or where a tide station is."""

    name: str
    lat: float
    lon: float


@dataclass(frozen=True)
class Metric:
    """one line of the overlay. source is set when the reading isn't from the cam's own spot."""

    text: str
    source: Optional[str] = None


@dataclass(frozen=True)
class Swell:
    """the swell at a site. direction is where it comes from, in degrees clockwise from north."""

    height_ft: float
    period_s: float
    direction_deg: float


@dataclass(frozen=True)
class Wind:
    """the wind at a site. direction is where it comes from, in degrees clockwise from north."""

    speed_mph: float
    direction_deg: float
    gusts_mph: Optional[float]


@dataclass(frozen=True)
class Tide:
    """the tide right now and its next turn. source is set when the station isn't at the cam."""

    height_ft: float
    rising: bool
    next_turn_kind: str  # "high" or "low"
    next_turn_at: datetime  # local time, no tzinfo
    source: Optional[str]


@dataclass(frozen=True)
class Conditions:
    """everything known about a site right now. a reading that couldn't be had is None."""

    swell: Optional[Swell]
    wind: Optional[Wind]
    tide: Optional[Tide]


# the only tide station near the cams (at the scripps pier, la jolla)
TIDE_STATION_ID = "9410230"
TIDE_STATION = Site("Scripps Pier", 32.8669, -117.2571)

_cache: dict[str, tuple[float, object]] = {}
_failures: dict[str, tuple[float, Exception]] = {}
_cache_lock = threading.Lock()


def stale_or_raise(entry: Optional[tuple[float, object]], error: Exception, max_stale_s: float, key: str) -> object:
    """falls back to an old cached value if it's still young enough, else re-raises.

    args:
        entry: the (stored_at, value) cache entry, if there is one.
        error: why a fresh value couldn't be had.
        max_stale_s: how old a cached value may be and still be shown.
        key: cache key, for the log line.

    returns:
        the stale value.

    raises:
        Exception: the original error, when there's no usable stale value.
    """
    if entry and time.monotonic() - entry[0] < max_stale_s:
        log.warning("%s refresh failed (%s); showing the last good reading", key, error)
        return entry[1]
    raise error


def cached(key: str, fetch: Callable[[], object], max_stale_s: float = STALE_MAX_AGE_S) -> object:
    """returns a cached value for key, refreshing it when older than CACHE_TTL_S.

    a failed refresh falls back to the previous value if it's under max_stale_s old, and
    a key that just failed isn't retried for FAILURE_RETRY_S.

    args:
        key: cache key.
        fetch: zero-arg function that produces a fresh value (may raise anything).
        max_stale_s: how old a previous value may be when a refresh fails.

    returns:
        the cached, freshly-fetched, or stale value.

    raises:
        Exception: whatever fetch raised, when there's no usable stale value.
    """
    now = time.monotonic()
    with _cache_lock:
        entry = _cache.get(key)
        failure = _failures.get(key)
    if entry and now - entry[0] < CACHE_TTL_S:
        return entry[1]
    if failure and now - failure[0] < FAILURE_RETRY_S:
        return stale_or_raise(entry, failure[1], max_stale_s, key)
    try:
        value = fetch()
    except Exception as err:  # noqa: BLE001 -- any failure must degrade to "no reading"
        with _cache_lock:
            _failures[key] = (now, err)
        return stale_or_raise(entry, err, max_stale_s, key)
    with _cache_lock:
        _cache[key] = (now, value)
        _failures.pop(key, None)
    return value


def fetch_json(url: str, params: dict) -> dict:
    """gets a json document, raising a readable error on any failure.

    args:
        url: api endpoint.
        params: query string parameters.

    returns:
        the decoded json body.

    raises:
        OSError: network failure, timeout, or a bad response body.
    """
    full_url = f"{url}?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(full_url, timeout=REQUEST_TIMEOUT_S) as response:
            return json.loads(response.read().decode())
    except (urllib.error.URLError, TimeoutError, ValueError) as err:
        raise OSError(f"could not fetch {url}: {err}") from err


def compass(degrees: float) -> str:
    """converts a bearing in degrees to a 16-point compass name (350 -> 'N')."""
    return COMPASS_POINTS[round(degrees / 22.5) % len(COMPASS_POINTS)]


def distance_km(a: Site, b: Site) -> float:
    """great-circle distance between two sites in km (haversine)."""
    lat1, lat2 = math.radians(a.lat), math.radians(b.lat)
    d_lat = lat2 - lat1
    d_lon = math.radians(b.lon - a.lon)
    h = math.sin(d_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(h))


def format_clock(moment: datetime) -> str:
    """formats a time like '1:25 PM' (no leading zero)."""
    return moment.strftime("%I:%M %p").lstrip("0")


def fetch_swell(site: Site) -> Optional[Swell]:
    """swell height, period and direction from the open-meteo marine model at the site.

    args:
        site: where to read the model.

    returns:
        the swell, or None when the model has no swell value for that point.
    """
    params = {
        "latitude": site.lat, "longitude": site.lon, "timezone": TIMEZONE,
        "length_unit": "imperial",
        "current": "swell_wave_height,swell_wave_period,swell_wave_direction",
    }
    current = fetch_json(MARINE_API_URL, params)["current"]
    height, period = current.get("swell_wave_height"), current.get("swell_wave_period")
    direction = current.get("swell_wave_direction")
    if height is None or period is None or direction is None:
        return None
    return Swell(height, period, direction)


def fetch_wind(site: Site) -> Optional[Wind]:
    """wind speed, direction and gusts from the open-meteo forecast model at the site.

    args:
        site: where to read the model.

    returns:
        the wind, or None when the model has no wind value.
    """
    params = {
        "latitude": site.lat, "longitude": site.lon, "timezone": TIMEZONE,
        "wind_speed_unit": "mph",
        "current": "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    }
    current = fetch_json(WEATHER_API_URL, params)["current"]
    speed, direction = current.get("wind_speed_10m"), current.get("wind_direction_10m")
    if speed is None or direction is None:
        return None
    return Wind(speed, direction, current.get("wind_gusts_10m"))


def fetch_tide_extremes() -> list[tuple[datetime, float, str]]:
    """high and low tide predictions around now from the noaa station, in local time.

    returns:
        (time, height in ft, 'H' or 'L') tuples in time order.
    """
    now = datetime.now(ZoneInfo(TIMEZONE))
    start = now - timedelta(days=TIDE_PREDICTION_START_DAYS_AGO)
    params = {
        "product": "predictions", "station": TIDE_STATION_ID, "datum": "MLLW",
        "time_zone": "lst_ldt", "units": "english", "interval": "hilo", "format": "json",
        "begin_date": start.strftime("%Y%m%d"), "range": TIDE_PREDICTION_RANGE_H,
    }
    predictions = fetch_json(TIDE_API_URL, params)["predictions"]
    return [(datetime.strptime(p["t"], "%Y-%m-%d %H:%M"), float(p["v"]), p["type"]) for p in predictions]


def current_tide(
    extremes: list[tuple[datetime, float, str]], now: datetime, source: Optional[str]
) -> Optional[Tide]:
    """works out the tide right now: height, direction, and the next high or low.

    the current height is a cosine blend between the extremes either side of now, which
    is close to how real tides move.

    args:
        extremes: (time, height in ft, 'H' or 'L') tuples in time order.
        now: current local time, without a timezone, to compare against.
        source: where the predictions are from, if not the cam's own spot.

    returns:
        the tide, or None when now isn't between two known extremes.
    """
    for prev, nxt in zip(extremes, extremes[1:]):
        if prev[0] <= now < nxt[0]:
            break
    else:
        return None
    fraction = (now - prev[0]) / (nxt[0] - prev[0])
    height = prev[1] + (nxt[1] - prev[1]) * (1 - math.cos(math.pi * fraction)) / 2
    rising = nxt[2] == "H"
    return Tide(height, rising, "high" if rising else "low", nxt[0], source)


def fetch_tide(site: Site) -> Optional[Tide]:
    """the current tide, tagged with the station's name when it isn't at the cam's spot.

    args:
        site: the cam's location, to decide whether the station counts as local.

    returns:
        the tide, or None when predictions don't cover now.
    """
    extremes = cached("tide-extremes", fetch_tide_extremes, TIDE_STALE_MAX_AGE_S)
    now = datetime.now(ZoneInfo(TIMEZONE)).replace(tzinfo=None)
    is_local = distance_km(site, TIDE_STATION) <= LOCAL_RADIUS_KM
    return current_tide(extremes, now, None if is_local else TIDE_STATION.name)


def get_conditions(site: Site) -> Conditions:
    """the swell, wind and tide at a cam. any that fail are left as None.

    never raises. the readings are fetched in parallel, so the slowest one sets the wait.

    args:
        site: the cam's location.

    returns:
        the conditions (every field None if every source failed).
    """
    site_key = f"{site.lat},{site.lon}"
    sources = [
        ("swell", lambda: cached(f"swell:{site_key}", lambda: fetch_swell(site))),
        ("wind", lambda: cached(f"wind:{site_key}", lambda: fetch_wind(site))),
        # not cached itself: fetch_tide caches the predictions and works out the height
        # fresh each time, so a stale "rising, high at 1:25 PM" can't outlive 1:25
        ("tide", lambda: fetch_tide(site)),
    ]
    with ThreadPoolExecutor(max_workers=len(sources)) as pool:
        futures = [(name, pool.submit(fetch)) for name, fetch in sources]
    readings = {}
    for name, future in futures:
        try:
            readings[name] = future.result()
        except Exception as err:  # noqa: BLE001 -- see cached(): any failure drops just this reading
            log.warning("no %s for %s: %s", name, site.name, err)
            readings[name] = None
    return Conditions(**readings)


def wind_text(wind: Wind) -> str:
    """formats the wind like 'Wind 5 mph from WSW', noting gusts when they're notably higher."""
    text = f"Wind {wind.speed_mph:.0f} mph from {compass(wind.direction_deg)}"
    if wind.gusts_mph is not None and wind.gusts_mph - wind.speed_mph >= GUST_NOTE_MIN_MPH:
        text += f" (gusts {wind.gusts_mph:.0f})"
    return text


def get_metrics(site: Site) -> list[Metric]:
    """the overlay lines for a cam: swell, wind, tide. any that fail are left out.

    never raises.

    args:
        site: the cam's location.

    returns:
        metrics in display order (possibly empty if every source failed).
    """
    conditions = get_conditions(site)
    swell, wind, tide = conditions.swell, conditions.wind, conditions.tide
    metrics = []
    if swell:
        metrics.append(Metric(
            f"Swell {swell.height_ft:.1f} ft at {swell.period_s:.0f} s from {compass(swell.direction_deg)}"
        ))
    if wind:
        metrics.append(Metric(wind_text(wind)))
    if tide:
        direction = "rising" if tide.rising else "falling"
        turn = f"{tide.next_turn_kind} at {format_clock(tide.next_turn_at)}"
        metrics.append(Metric(f"Tide {tide.height_ft:.1f} ft {direction}, {turn}", tide.source))
    return metrics


def conditions_to_json(conditions: Conditions) -> dict:
    """turns conditions into the json the /display conditions panel reads.

    directions are where the swell/wind comes from, in degrees clockwise from north, plus
    the 16-point compass name. a missing reading is null. the shape is in the agent README.

    args:
        conditions: from get_conditions.

    returns:
        a json-serializable dict with swell, wind and tide keys.
    """
    swell, wind, tide = conditions.swell, conditions.wind, conditions.tide
    return {
        "swell": swell and {
            "height_ft": swell.height_ft,
            "period_s": swell.period_s,
            "direction_deg": swell.direction_deg,
            "direction_compass": compass(swell.direction_deg),
        },
        "wind": wind and {
            "speed_mph": wind.speed_mph,
            "gusts_mph": wind.gusts_mph,
            "direction_deg": wind.direction_deg,
            "direction_compass": compass(wind.direction_deg),
        },
        "tide": tide and {
            "height_ft": tide.height_ft,
            "rising": tide.rising,
            "next_turn_kind": tide.next_turn_kind,
            "next_turn_at": format_clock(tide.next_turn_at),
            "source": tide.source,
        },
    }
