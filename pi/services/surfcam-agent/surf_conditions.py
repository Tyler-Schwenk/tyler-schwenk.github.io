"""surf conditions for the cams: waves, wind and tide, from the most accurate free source for each.

  - waves: cdip's MOP nearshore nowcast, which turns the real buoy measurements into wave
    height, period and direction at each beach (every 100 m along the san diego coast, in
    10 m of water). far better than a coarse wave model, where nearby spots share a cell
  - wind: measured at a nearby station when the spot has one (the scripps pier gauge, for
    the la jolla cams), else the open-meteo forecast model at the spot
  - tide: noaa's scripps pier station: the measured water level, plus predictions for the
    curve ahead and the next high/low

get_conditions() turns a cam's spot into structured readings. two views are built from
them: get_metrics() makes the short lines for the video overlay, and conditions_to_json()
feeds the /display page's conditions panel (served by the agent at GET
/cams/<cam>/conditions). anything that comes from somewhere other than the cam's own spot
says where, so a faraway reading is never passed off as local.

built so a flaky api can't take the overlay or panel down:
  - each reading is fetched on its own thread and fails on its own, so a missing wave
    reading still leaves wind and tide, and a hanging api only costs one timeout
  - any error at all (network, bad data, a field we didn't expect) just drops that reading;
    measured wind falls back to the model, and the tide graph works without its measured line
  - if a refresh fails, the last good reading is reused for a while before being dropped
  - after a failure the api isn't retried for FAILURE_RETRY_S, so an outage doesn't add a
    timeout to every cam change

all apis are free and keyless. results are cached for CACHE_TTL_S so a rotation that
shows the cams every few minutes doesn't hammer them.
"""

import json
import logging
import math
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional
from zoneinfo import ZoneInfo

MOP_URL_TEMPLATE = "https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/model/MOP_alongshore/{point}_nowcast.nc"
WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast"
NDBC_REALTIME_URL_TEMPLATE = "https://www.ndbc.noaa.gov/data/realtime2/{station}.txt"
TIDE_API_URL = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"

TIMEZONE = "America/Los_Angeles"
REQUEST_TIMEOUT_S = 5
CACHE_TTL_S = 600

# when a refresh fails, keep showing the last good reading this long before dropping it.
# waves/wind drift over hours; tide predictions are fixed so they stay good for a day
STALE_MAX_AGE_S = 2 * 3600
TIDE_STALE_MAX_AGE_S = 24 * 3600

# after a fetch fails with nothing usable to fall back on, wait this long before trying again
FAILURE_RETRY_S = 60

# the mop nowcast updates hourly and lags about an hour; older than this means it's stuck
MOP_MAX_AGE_S = 3 * 3600
MOP_VARIABLES = ("waveTime", "waveHs", "waveTp", "waveDp")
MOP_TIME_COUNT_PATTERN = re.compile(r"waveTime\[waveTime = (\d+)\]")
# opendap ascii puts a line of dashes between the header and the values
OPENDAP_SEPARATOR_PATTERN = re.compile(r"^-+$", re.MULTILINE)

# a station's wind reading older than this is ignored in favour of the model
WIND_OBSERVATION_MAX_AGE_S = 3600
NDBC_MISSING_VALUE = "MM"

M_TO_FT = 3.28084
MPS_TO_MPH = 2.23694

# a reading from a source closer than this to the cam counts as "here" and gets no source tag
LOCAL_RADIUS_KM = 1.0
EARTH_RADIUS_KM = 6371.0

# only mention gusts in the overlay when they're meaningfully above the steady wind
GUST_NOTE_MIN_MPH = 5

# the tide graph spans this far back and ahead of now
TIDE_GRAPH_PAST_H = 12
TIDE_GRAPH_FUTURE_H = 24
# noaa predictions span yesterday through two days ahead, so the graph window and the
# next high/low are always covered
TIDE_PREDICTION_START_DAYS_AGO = 1
TIDE_PREDICTION_RANGE_H = 72
TIDE_PREDICTION_INTERVAL_MIN = "6"
# the gauge reading counts as "now" if it's at most this old; otherwise the prediction does
TIDE_OBSERVATION_MAX_AGE_S = 1800

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
class WindStation:
    """a station that measures wind: its ndbc id, and a short name for the source note."""

    station_id: str
    name: str


@dataclass(frozen=True)
class SurfSpot:
    """what a cam looks at: where it is, its cdip mop nowcast point, and a wind station if one's close."""

    site: Site
    mop_point: str
    wind_station: Optional[WindStation] = None


@dataclass(frozen=True)
class Metric:
    """one line of the overlay. source is set when the reading isn't from the cam's own spot."""

    text: str
    source: Optional[str] = None


@dataclass(frozen=True)
class Waves:
    """the waves at a spot. direction is where they come from, in degrees clockwise from north."""

    height_ft: float
    period_s: float
    direction_deg: float
    as_of: datetime  # local time, no tzinfo


@dataclass(frozen=True)
class Wind:
    """the wind at a spot. direction is where it comes from, in degrees clockwise from north."""

    speed_mph: float
    direction_deg: float
    gusts_mph: Optional[float]
    note: str  # where it's from, like "measured at Scripps Pier"


@dataclass(frozen=True)
class Tide:
    """the tide now, its next turn, and the curve around now for the graph.

    times are local, without tzinfo. source is set when the station isn't at the cam.
    """

    height_ft: float
    measured: bool  # height_ft is the gauge's latest reading rather than the prediction
    rising: bool
    next_turn_kind: str  # "high" or "low"
    next_turn_at: datetime
    source: Optional[str]
    now: datetime  # when this was worked out; the graph's "now" marker
    window_start: datetime
    window_end: datetime
    predicted: list[tuple[datetime, float]]  # across the whole window
    observed: list[tuple[datetime, float]]  # the past part of the window; may be empty
    turns: list[tuple[datetime, float, str]]  # highs and lows in the window, 'H' or 'L'


@dataclass(frozen=True)
class Conditions:
    """everything known about a spot right now. a reading that couldn't be had is None."""

    waves: Optional[Waves]
    wind: Optional[Wind]
    tide: Optional[Tide]


# the measured wind on the end of the scripps pier (noaa's la jolla tide station). ndbc's
# realtime file names are uppercase
SCRIPPS_PIER_WIND = WindStation("LJAC1", "Scripps Pier")

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


def fetch_text(url: str, params: Optional[dict] = None) -> str:
    """gets a text document, raising a readable error on any failure.

    args:
        url: endpoint.
        params: query string parameters, if any.

    returns:
        the body as text.

    raises:
        OSError: network failure, timeout, or an error status.
    """
    full_url = f"{url}?{urllib.parse.urlencode(params)}" if params else url
    try:
        with urllib.request.urlopen(full_url, timeout=REQUEST_TIMEOUT_S) as response:
            return response.read().decode()
    except (urllib.error.URLError, TimeoutError, UnicodeDecodeError) as err:
        raise OSError(f"could not fetch {url}: {err}") from err


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
    text = fetch_text(url, params)
    try:
        return json.loads(text)
    except ValueError as err:
        raise OSError(f"bad json from {url}: {err}") from err


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


def local_now() -> datetime:
    """the current local time, without tzinfo, to compare with the apis' local times."""
    return datetime.now(ZoneInfo(TIMEZONE)).replace(tzinfo=None)


def to_epoch_ms(local: datetime) -> int:
    """converts a local time without tzinfo to epoch milliseconds."""
    return int(local.replace(tzinfo=ZoneInfo(TIMEZONE)).timestamp() * 1000)


def parse_opendap_ascii(text: str) -> dict[str, float]:
    """reads single values out of an opendap .ascii response.

    after the dashed separator each variable comes as a 'name[1]' line then its value.

    args:
        text: the response body.

    returns:
        variable name -> value.
    """
    body = OPENDAP_SEPARATOR_PATTERN.split(text)[-1]
    lines = [line.strip() for line in body.splitlines() if line.strip()]
    return {label.split("[")[0]: float(value) for label, value in zip(lines[::2], lines[1::2])}


def fetch_waves(spot: SurfSpot) -> Waves:
    """the latest wave height, peak period and direction from the spot's cdip mop nowcast point.

    the dataset is one long hourly time series, so this asks for its length first, then
    reads just the last entry.

    args:
        spot: whose mop point to read.

    returns:
        the waves.

    raises:
        OSError: the dataset couldn't be read, or its latest entry is too old.
    """
    base_url = MOP_URL_TEMPLATE.format(point=spot.mop_point)
    count = MOP_TIME_COUNT_PATTERN.search(fetch_text(f"{base_url}.dds"))
    if not count:
        raise OSError(f"no waveTime length in {base_url}.dds; has cdip changed the MOP dataset layout?")
    last = int(count.group(1)) - 1
    # brackets are percent-encoded, or the server rejects the query
    query = ",".join(f"{name}%5B{last}%5D" for name in MOP_VARIABLES)
    values = parse_opendap_ascii(fetch_text(f"{base_url}.ascii?{query}"))
    age_s = time.time() - values["waveTime"]
    if age_s > MOP_MAX_AGE_S:
        raise OSError(f"MOP nowcast {spot.mop_point} is {age_s / 3600:.1f} h old; cdip may be down")
    as_of = datetime.fromtimestamp(values["waveTime"], ZoneInfo(TIMEZONE)).replace(tzinfo=None)
    return Waves(values["waveHs"] * M_TO_FT, values["waveTp"], values["waveDp"], as_of)


def fetch_measured_wind(station: WindStation) -> Wind:
    """the latest wind reading from an ndbc station's realtime feed.

    args:
        station: which station.

    returns:
        the wind.

    raises:
        OSError: the feed couldn't be read, or its latest reading is missing or too old.
    """
    lines = fetch_text(NDBC_REALTIME_URL_TEMPLATE.format(station=station.station_id)).splitlines()
    columns = {name: index for index, name in enumerate(lines[0].lstrip("#").split())}
    rows = [line.split() for line in lines if not line.startswith("#")]
    if not rows:
        raise OSError(f"no readings in the {station.station_id} feed")
    latest = rows[0]
    reading = {name: latest[index] for name, index in columns.items()}
    observed_at = datetime(
        int(reading["YY"]), int(reading["MM"]), int(reading["DD"]),
        int(reading["hh"]), int(reading["mm"]), tzinfo=timezone.utc,
    )
    age_s = time.time() - observed_at.timestamp()
    if age_s > WIND_OBSERVATION_MAX_AGE_S:
        raise OSError(f"{station.station_id} wind is {age_s / 60:.0f} min old")
    if NDBC_MISSING_VALUE in (reading["WDIR"], reading["WSPD"]):
        raise OSError(f"{station.station_id} has no wind in its latest reading")
    gust = None if reading["GST"] == NDBC_MISSING_VALUE else float(reading["GST"]) * MPS_TO_MPH
    return Wind(float(reading["WSPD"]) * MPS_TO_MPH, float(reading["WDIR"]), gust, f"measured at {station.name}")


def fetch_model_wind(site: Site) -> Wind:
    """wind speed, direction and gusts from the open-meteo forecast model at the site.

    args:
        site: where to read the model.

    returns:
        the wind.

    raises:
        OSError: the api failed or had no wind value for that point.
    """
    params = {
        "latitude": site.lat, "longitude": site.lon, "timezone": TIMEZONE,
        "wind_speed_unit": "mph",
        "current": "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    }
    current = fetch_json(WEATHER_API_URL, params)["current"]
    speed, direction = current.get("wind_speed_10m"), current.get("wind_direction_10m")
    if speed is None or direction is None:
        raise OSError(f"open-meteo had no wind for {site.name}")
    return Wind(speed, direction, current.get("wind_gusts_10m"), "forecast model")


def fetch_wind(spot: SurfSpot) -> Wind:
    """the spot's wind: measured at its station if it has one that's reporting, else the model.

    args:
        spot: the cam's spot.

    returns:
        the wind.
    """
    if spot.wind_station:
        try:
            return fetch_measured_wind(spot.wind_station)
        except Exception as err:  # noqa: BLE001 -- any station trouble just means use the model
            log.warning("measured wind for %s unavailable (%s); using the model", spot.site.name, err)
    return fetch_model_wind(spot.site)


def fetch_tide_series(product: str, params: dict) -> list[tuple[datetime, float]]:
    """a series of (local time, height in ft) from the noaa station, skipping blank values.

    args:
        product: "predictions" or "water_level".
        params: extra query parameters (the time range, interval).

    returns:
        (time, height) tuples in time order.
    """
    base = {
        "product": product, "station": TIDE_STATION_ID, "datum": "MLLW",
        "time_zone": "lst_ldt", "units": "english", "format": "json",
    }
    body = fetch_json(TIDE_API_URL, {**base, **params})
    # predictions come under "predictions", observations under "data"
    points = body.get("predictions") or body.get("data") or []
    return [(datetime.strptime(p["t"], "%Y-%m-%d %H:%M"), float(p["v"])) for p in points if p["v"]]


def tide_prediction_params() -> dict:
    """the time range for prediction requests: yesterday through two days ahead."""
    start = local_now() - timedelta(days=TIDE_PREDICTION_START_DAYS_AGO)
    return {"begin_date": start.strftime("%Y%m%d"), "range": TIDE_PREDICTION_RANGE_H}


def fetch_tide_curve() -> list[tuple[datetime, float]]:
    """predicted heights every 6 minutes, for the graph and the predicted height now."""
    return fetch_tide_series("predictions", {**tide_prediction_params(), "interval": TIDE_PREDICTION_INTERVAL_MIN})


def fetch_tide_observed() -> list[tuple[datetime, float]]:
    """the gauge's measured water level over the graph's past window."""
    return fetch_tide_series("water_level", {"range": TIDE_GRAPH_PAST_H})


def fetch_tide_extremes() -> list[tuple[datetime, float, str]]:
    """high and low tide predictions around now, as (time, height in ft, 'H' or 'L')."""
    params = {
        "product": "predictions", "station": TIDE_STATION_ID, "datum": "MLLW",
        "time_zone": "lst_ldt", "units": "english", "interval": "hilo", "format": "json",
        **tide_prediction_params(),
    }
    predictions = fetch_json(TIDE_API_URL, params)["predictions"]
    return [(datetime.strptime(p["t"], "%Y-%m-%d %H:%M"), float(p["v"]), p["type"]) for p in predictions]


def interpolate_height(curve: list[tuple[datetime, float]], moment: datetime) -> Optional[float]:
    """linearly interpolates a height curve at a moment.

    args:
        curve: (time, height) in time order.
        moment: when to read it.

    returns:
        the height, or None when the curve doesn't cover the moment.
    """
    for (t0, h0), (t1, h1) in zip(curve, curve[1:]):
        if t0 <= moment <= t1:
            return h0 + (h1 - h0) * (moment - t0) / (t1 - t0)
    return None


def build_tide(
    extremes: list[tuple[datetime, float, str]],
    curve: list[tuple[datetime, float]],
    observed: list[tuple[datetime, float]],
    now: datetime,
    source: Optional[str],
) -> Optional[Tide]:
    """puts the tide now and its graph together from the noaa series.

    the height now is the gauge's latest reading when it's fresh (it catches surge that
    predictions miss), else the predicted curve at now.

    args:
        extremes: predicted highs and lows.
        curve: predicted heights every 6 minutes.
        observed: measured heights; may be empty.
        now: current local time, without tzinfo.
        source: where the station is, if not at the cam.

    returns:
        the tide, or None when the predictions don't cover now.
    """
    next_turn = next((turn for turn in extremes if turn[0] > now), None)
    latest = observed[-1] if observed else None
    if latest and (now - latest[0]).total_seconds() <= TIDE_OBSERVATION_MAX_AGE_S:
        height, measured = latest[1], True
    else:
        height, measured = interpolate_height(curve, now), False
    if next_turn is None or height is None:
        return None
    window_start = now - timedelta(hours=TIDE_GRAPH_PAST_H)
    window_end = now + timedelta(hours=TIDE_GRAPH_FUTURE_H)
    rising = next_turn[2] == "H"
    return Tide(
        height, measured, rising, "high" if rising else "low", next_turn[0], source,
        now, window_start, window_end,
        [point for point in curve if window_start <= point[0] <= window_end],
        [point for point in observed if point[0] >= window_start],
        [turn for turn in extremes if window_start <= turn[0] <= window_end],
    )


def fetch_tide(site: Site) -> Optional[Tide]:
    """the tide now and its graph, tagged with the station's name when it isn't at the cam.

    the measured line is optional: if the gauge feed fails, the graph just shows predictions.

    args:
        site: the cam's location, to decide whether the station counts as local.

    returns:
        the tide, or None when predictions don't cover now.
    """
    extremes = cached("tide-extremes", fetch_tide_extremes, TIDE_STALE_MAX_AGE_S)
    curve = cached("tide-curve", fetch_tide_curve, TIDE_STALE_MAX_AGE_S)
    try:
        observed = cached("tide-observed", fetch_tide_observed)
    except Exception as err:  # noqa: BLE001 -- the graph still works from predictions alone
        log.warning("no measured tide: %s", err)
        observed = []
    is_local = distance_km(site, TIDE_STATION) <= LOCAL_RADIUS_KM
    return build_tide(extremes, curve, observed, local_now(), None if is_local else TIDE_STATION.name)


def get_conditions(spot: SurfSpot) -> Conditions:
    """the waves, wind and tide at a cam's spot. any that fail are left as None.

    never raises. the readings are fetched in parallel, so the slowest one sets the wait.

    args:
        spot: the cam's spot.

    returns:
        the conditions (every field None if every source failed).
    """
    site = spot.site
    sources = [
        ("waves", lambda: cached(f"waves:{spot.mop_point}", lambda: fetch_waves(spot))),
        ("wind", lambda: cached(f"wind:{site.lat},{site.lon}", lambda: fetch_wind(spot))),
        # not cached itself: fetch_tide caches the noaa series and works out "now" fresh
        # each time, so a stale "rising, high at 1:25 PM" can't outlive 1:25
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


def get_metrics(spot: SurfSpot) -> list[Metric]:
    """the overlay lines for a cam: waves, wind, tide. any that fail are left out.

    never raises.

    args:
        spot: the cam's spot.

    returns:
        metrics in display order (possibly empty if every source failed).
    """
    conditions = get_conditions(spot)
    waves, wind, tide = conditions.waves, conditions.wind, conditions.tide
    metrics = []
    if waves:
        metrics.append(Metric(
            f"Waves {waves.height_ft:.1f} ft at {waves.period_s:.0f} s from {compass(waves.direction_deg)}"
        ))
    if wind:
        metrics.append(Metric(wind_text(wind)))
    if tide:
        direction = "rising" if tide.rising else "falling"
        turn = f"{tide.next_turn_kind} at {format_clock(tide.next_turn_at)}"
        metrics.append(Metric(f"Tide {tide.height_ft:.1f} ft {direction}, {turn}", tide.source))
    return metrics


def tide_to_json(tide: Tide) -> dict:
    """the tide part of conditions_to_json, with times as epoch ms for the graph."""
    return {
        "height_ft": tide.height_ft,
        "measured": tide.measured,
        "rising": tide.rising,
        "next_turn_kind": tide.next_turn_kind,
        "next_turn_at": format_clock(tide.next_turn_at),
        "source": tide.source,
        "now_ms": to_epoch_ms(tide.now),
        "window_start_ms": to_epoch_ms(tide.window_start),
        "window_end_ms": to_epoch_ms(tide.window_end),
        "predicted": [[to_epoch_ms(t), h] for t, h in tide.predicted],
        "observed": [[to_epoch_ms(t), h] for t, h in tide.observed],
        "turns": [
            {"at_ms": to_epoch_ms(t), "at": format_clock(t), "height_ft": h, "kind": "high" if kind == "H" else "low"}
            for t, h, kind in tide.turns
        ],
    }


def conditions_to_json(conditions: Conditions) -> dict:
    """turns conditions into the json the /display conditions panel reads.

    directions are where the waves/wind come from, in degrees clockwise from north, plus
    the 16-point compass name. a missing reading is null. the shape is in the agent README.

    args:
        conditions: from get_conditions.

    returns:
        a json-serializable dict with waves, wind and tide keys.
    """
    waves, wind, tide = conditions.waves, conditions.wind, conditions.tide
    return {
        "waves": waves and {
            "height_ft": waves.height_ft,
            "period_s": waves.period_s,
            "direction_deg": waves.direction_deg,
            "direction_compass": compass(waves.direction_deg),
            "as_of": format_clock(waves.as_of),
        },
        "wind": wind and {
            "speed_mph": wind.speed_mph,
            "gusts_mph": wind.gusts_mph,
            "direction_deg": wind.direction_deg,
            "direction_compass": compass(wind.direction_deg),
            "note": wind.note,
        },
        "tide": tide and tide_to_json(tide),
    }
