#!/usr/bin/env python3
"""surfcam agent: plays live surf cams fullscreen on the display kiosk machine for the /display page.

the kiosk page (chrome) can't play these streams itself -- hdontap only allows
its own embed on other sites and 403s any browser request carrying a foreign
Origin header, and surfline's cdn only serves requests that come from its own
embed player. mpv sends no Origin and can send the referrer surfline expects, so
it plays both. this agent runs on the kiosk next to the browser and drives mpv on
behalf of the page over a tiny localhost-only HTTP API:

    POST /cams/<cam>/prepare   start mpv paused + minimized so it buffers in the background
    POST /cams/<cam>/show      unpause, bring it fullscreen on top of chrome, and draw the
                               place name + surf conditions overlay (see surf_conditions.py)
    POST /cams/<cam>/stop      kill that cam's mpv
    GET  /cams/<cam>/conditions  the cam's name, waves, wind and tide (with its graph) as
                                 json, for the conditions panel on the other screen

see pi/services/surfcam-agent/README.md for setup.
"""

import json
import logging
import re
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Optional

from surf_conditions import (
    SCRIPPS_PIER_WIND,
    Metric,
    Site,
    SurfSpot,
    conditions_to_json,
    get_conditions,
    get_metrics,
)

LISTEN_HOST = "127.0.0.1"
LISTEN_PORT = 8765

# the only page origins allowed to call this API (browser cors check)
ALLOWED_ORIGINS = {"https://tyler-schwenk.com"}

# surfline's stream cdn 403s any request without its embed player as the referrer
SURFLINE_REFERRER = "https://embed.cdn-surfline.com/"
SURFLINE_STREAM_URL_TEMPLATE = "https://hls.cdn-surfline.com/oregon/{alias}/playlist.m3u8"


@dataclass(frozen=True)
class Cam:
    """a live cam and the surf spot it looks at.

    hdontap cams set page_url: their stream url carries an expiring token, so it's scraped
    from the public cam page when needed. surfline cams set stream_url directly (it's
    fixed) plus the referrer their cdn insists on. only use surfline cams marked free
    (isPremium false) -- premium ones are for paying subscribers.
    """

    spot: SurfSpot
    page_url: Optional[str] = None
    stream_url: Optional[str] = None
    referrer: Optional[str] = None


def surfline_cam(alias: str, spot: SurfSpot) -> Cam:
    """builds a cam for one of surfline's free streams, from its alias (like 'wc-scripps')."""
    return Cam(spot, stream_url=SURFLINE_STREAM_URL_TEMPLATE.format(alias=alias), referrer=SURFLINE_REFERRER)


# cam id (used by the display page) -> cam. keep ids in sync with website/app/display/surfCams.ts.
# each spot's mop point is the cdip nowcast point nearest the beach the cam looks at.
# keep cams at 1080p or lower so decode and rendering stay light
CAMS = {
    "pb": Cam(
        SurfSpot(Site("Pacific Beach", 32.7936, -117.2570), "D0402"),
        page_url="https://hdontap.com/stream/186699/pacific-beach-live-surf-webcam/",
    ),
    "la-jolla-shores": Cam(
        SurfSpot(Site("La Jolla Shores", 32.8567, -117.2560), "D0499", SCRIPPS_PIER_WIND),
        page_url="https://hdontap.com/stream/532541/la-jolla-shores-live-surf-cam/",
    ),
    "scripps": surfline_cam(
        "wc-scripps",
        SurfSpot(Site("Scripps Pier", 32.8658, -117.2561), "D0514", SCRIPPS_PIER_WIND),
    ),
    "scripps-underwater": Cam(
        SurfSpot(Site("Scripps Pier (underwater)", 32.8669, -117.2571), "D0514", SCRIPPS_PIER_WIND),
        page_url="https://hdontap.com/stream/018408/scripps-pier-underwater-live-webcam/",
    ),
    # the nearest free cam to swami's (both of surfline's swami's cams are premium)
    "moonlight": surfline_cam(
        "wc-moonlight",
        SurfSpot(Site("Moonlight Beach, Encinitas", 33.0469, -117.2997), "D0723"),
    ),
}

# auto-safe picks vaapi on displaytop's intel gpu, so 1080p streams decode in hardware
MPV_HWDEC = "auto-safe"

PAGE_FETCH_TIMEOUT_S = 15
PAGE_USER_AGENT = "Mozilla/5.0"
STREAM_SRC_PATTERN = re.compile(r'"streamSrc":\s*("[^"]+")')
TOKEN_EXPIRY_PATTERN = re.compile(r"[?&]e=(\d+)")

# stream urls carry an expiring token (~12h). reuse one until it's this close to expiring
TOKEN_MIN_REMAINING_S = 3600

# how long to wait for a freshly-launched mpv to open its control socket
IPC_READY_TIMEOUT_S = 10.0
IPC_POLL_INTERVAL_S = 0.1
IPC_REPLY_TIMEOUT_S = 5
IPC_REQUEST_ID = 1  # tags our commands so replies can be told apart from mpv's event lines
IPC_SOCKET_PATH_TEMPLATE = "/tmp/surfcam-{cam}.sock"

# how long to wait for mpv to exit after terminate() before killing it
MPV_EXIT_TIMEOUT_S = 3

# paused streams keep demuxing this far ahead, so unpausing starts instantly
DEMUXER_READAHEAD_S = 10

# overlay layout, in ASS script coordinates (mpv scales them to the actual window).
# a translucent bar across the top holds the place name (left) and one line per metric (right)
OVERLAY_ID = 1
OVERLAY_RES_X = 1920
OVERLAY_RES_Y = 1080
OVERLAY_MARGIN_PX = 48
OVERLAY_NAME_FONT_PX = 72
OVERLAY_METRIC_FONT_PX = 34
OVERLAY_SOURCE_FONT_PX = 24
OVERLAY_METRIC_LINE_PX = 42
OVERLAY_BAR_MIN_HEIGHT_PX = 120
OVERLAY_BAR_PADDING_PX = 28
# ASS colors are BGR hex; alpha is 00 opaque .. FF clear
OVERLAY_TEXT_COLOR = "&HFFFFFF&"
OVERLAY_SOURCE_COLOR = "&HCCCCCC&"
OVERLAY_BAR_ALPHA = "&H70&"

ROUTE_PATTERN = re.compile(r"^/cams/(?P<cam>[a-z0-9-]+)/(?P<action>prepare|show|stop)$")
CONDITIONS_ROUTE_PATTERN = re.compile(r"^/cams/(?P<cam>[a-z0-9-]+)/conditions$")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("surfcam-agent")


class StreamUnavailableError(Exception):
    """raised when a cam's stream url can't be found or mpv can't be controlled."""


_stream_url_cache: dict[str, tuple[str, int]] = {}
_players: dict[str, subprocess.Popen] = {}
# mpv removes an overlay the moment the client that drew it disconnects, so each shown cam
# keeps one ipc connection open for as long as it's playing
_overlay_connections: dict[str, socket.socket] = {}
_state_lock = threading.Lock()
# held while a cam's mpv is started or stopped. without it two requests landing together
# (the stream scrape takes ~1s) both see no player and both start one, and the first mpv
# is orphaned: its socket gets taken over, so stop can never reach it
_cam_locks = {cam: threading.Lock() for cam in CAMS}


def fetch_stream_url(page_url: str) -> str:
    """scrapes the tokenized hls url out of a public hdontap cam page.

    args:
        page_url: the hdontap page for the cam.

    returns:
        the .m3u8 url, including its expiring token.

    raises:
        StreamUnavailableError: page unreachable or no streamSrc in it (hdontap
            may have changed their page format).
    """
    request = urllib.request.Request(page_url, headers={"User-Agent": PAGE_USER_AGENT})
    try:
        html = urllib.request.urlopen(request, timeout=PAGE_FETCH_TIMEOUT_S).read().decode()
    except (urllib.error.URLError, TimeoutError) as err:
        raise StreamUnavailableError(
            f"could not load {page_url}: {err}. check the kiosk machine's internet connection."
        ) from err
    match = STREAM_SRC_PATTERN.search(html)
    if not match:
        raise StreamUnavailableError(
            f"no streamSrc found on {page_url}. hdontap likely changed their page "
            "format -- inspect the page source and update STREAM_SRC_PATTERN."
        )
    # the value is a json string literal, so json handles the & / \/ escapes
    return json.loads(match.group(1))


def get_stream_url(cam: str) -> str:
    """returns a stream url for the cam: its fixed one, or a scraped one reused while its token is fresh.

    args:
        cam: cam id from CAMS.

    returns:
        the .m3u8 url.
    """
    if CAMS[cam].stream_url:
        return CAMS[cam].stream_url
    cached = _stream_url_cache.get(cam)
    if cached and cached[1] - time.time() > TOKEN_MIN_REMAINING_S:
        return cached[0]
    url = fetch_stream_url(CAMS[cam].page_url)
    expiry = TOKEN_EXPIRY_PATTERN.search(url)
    # no parseable expiry -> expire immediately so we re-scrape next time
    expires_at = int(expiry.group(1)) if expiry else 0
    _stream_url_cache[cam] = (url, expires_at)
    return url


def ipc_socket_path(cam: str) -> str:
    """returns the unix socket path mpv listens on for a cam."""
    return IPC_SOCKET_PATH_TEMPLATE.format(cam=cam)


def await_reply(reader) -> None:
    """blocks until mpv answers our ipc command, skipping its unsolicited event lines.

    mpv drops commands still queued when the client disconnects, so we have to
    read each reply before moving on or closing the socket.

    args:
        reader: file-like object over the ipc socket.
    """
    for line in reader:
        if json.loads(line).get("request_id") == IPC_REQUEST_ID:
            return


def connect_ipc(cam: str) -> socket.socket:
    """opens a connection to a cam's mpv control socket, waiting for mpv to create it.

    args:
        cam: cam id.

    returns:
        a connected socket with a reply timeout set. the caller closes it.

    raises:
        StreamUnavailableError: the socket never became available.
    """
    deadline = time.monotonic() + IPC_READY_TIMEOUT_S
    while True:
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        try:
            sock.connect(ipc_socket_path(cam))
        except OSError as err:
            sock.close()
            if time.monotonic() > deadline:
                raise StreamUnavailableError(
                    f"mpv for '{cam}' never opened its control socket: {err}. "
                    "check that mpv is installed, and run the agent in a terminal to see its log."
                ) from err
            time.sleep(IPC_POLL_INTERVAL_S)
            continue
        sock.settimeout(IPC_REPLY_TIMEOUT_S)
        return sock


def run_commands(sock: socket.socket, commands: list[list]) -> None:
    """sends ipc commands over an open connection, waiting for each reply.

    args:
        sock: connection from connect_ipc.
        commands: mpv ipc commands, e.g. [["set_property", "pause", False]].
    """
    reader = sock.makefile("rb")
    for command in commands:
        sock.sendall(json.dumps({"command": command, "request_id": IPC_REQUEST_ID}).encode() + b"\n")
        await_reply(reader)


def send_mpv_commands(cam: str, commands: list[list]) -> None:
    """sends ipc commands to a cam's mpv over a short-lived connection.

    args:
        cam: cam id.
        commands: mpv ipc commands, e.g. [["set_property", "pause", False]].

    raises:
        StreamUnavailableError: the socket never became available.
    """
    with connect_ipc(cam) as sock:
        run_commands(sock, commands)


def build_overlay_ass(site: Site, metrics: list[Metric]) -> str:
    """builds the ASS events for the overlay: a top bar, the place name, and one line per metric.

    args:
        site: the cam's location (its name is shown top left).
        metrics: lines to show top right. a metric with a source gets a small grey
            '(from <source>)' tag, since it was measured somewhere other than the cam.

    returns:
        newline-separated ASS event text for mpv's osd-overlay.
    """
    bar_height = max(
        OVERLAY_BAR_MIN_HEIGHT_PX, OVERLAY_BAR_PADDING_PX + OVERLAY_METRIC_LINE_PX * len(metrics)
    )
    center_y = bar_height // 2
    right_x = OVERLAY_RES_X - OVERLAY_MARGIN_PX
    bar = (
        rf"{{\an7\pos(0,0)\bord0\shad0\1c&H000000&\1a{OVERLAY_BAR_ALPHA}\p1}}"
        rf"m 0 0 l {OVERLAY_RES_X} 0 {OVERLAY_RES_X} {bar_height} 0 {bar_height}{{\p0}}"
    )
    name = (
        rf"{{\an4\pos({OVERLAY_MARGIN_PX},{center_y})\fs{OVERLAY_NAME_FONT_PX}\b1\bord3\shad1"
        rf"\1c{OVERLAY_TEXT_COLOR}\3c&H000000&}}{site.name}"
    )
    events = [bar, name]
    if metrics:
        lines = []
        for metric in metrics:
            line = metric.text
            if metric.source:
                line += rf" {{\fs{OVERLAY_SOURCE_FONT_PX}\1c{OVERLAY_SOURCE_COLOR}}}(from {metric.source})"
            lines.append(line)
        events.append(
            rf"{{\an6\pos({right_x},{center_y})\fs{OVERLAY_METRIC_FONT_PX}\bord2\shad1"
            rf"\1c{OVERLAY_TEXT_COLOR}\3c&H000000&}}" + r"\N".join(lines)
        )
    return "\n".join(events)


def close_overlay(cam: str) -> None:
    """drops a cam's overlay connection, which also removes the overlay from mpv."""
    with _state_lock:
        sock = _overlay_connections.pop(cam, None)
    if sock is not None:
        sock.close()


def show_overlay(cam: str) -> None:
    """draws the place name and conditions on a cam's mpv, and keeps the connection open.

    never raises: a missing overlay shouldn't stop the video from showing.

    args:
        cam: cam id from CAMS.
    """
    spot = CAMS[cam].spot
    sock = None
    try:
        ass = build_overlay_ass(spot.site, get_metrics(spot))
        sock = connect_ipc(cam)
        # no event lines are needed, and a client that never reads would let them pile up
        run_commands(sock, [
            ["disable_event", "all"],
            ["osd-overlay", OVERLAY_ID, "ass-events", ass, OVERLAY_RES_X, OVERLAY_RES_Y],
        ])
    except Exception as err:  # noqa: BLE001 -- the video must show even if the overlay can't
        log.warning("overlay for %s not shown: %s", cam, err)
        if sock is not None:
            sock.close()
        return
    close_overlay(cam)
    with _state_lock:
        _overlay_connections[cam] = sock


def terminate_process(process: subprocess.Popen) -> None:
    """asks a process to exit, killing it if it hasn't within MPV_EXIT_TIMEOUT_S."""
    process.terminate()
    try:
        process.wait(timeout=MPV_EXIT_TIMEOUT_S)
    except subprocess.TimeoutExpired:
        process.kill()


def stop_player(cam: str) -> None:
    """kills a cam's mpv if it's running. safe to call when nothing's running."""
    close_overlay(cam)
    with _cam_locks[cam]:
        with _state_lock:
            process = _players.pop(cam, None)
        if process is not None and process.poll() is None:
            terminate_process(process)


def prepare_player(cam: str) -> None:
    """starts mpv for a cam paused and minimized so it buffers without covering chrome.

    no-op if that cam's mpv is already running. mpv opens on the primary screen, which
    kiosk-run.sh makes the external monitor.

    args:
        cam: cam id from CAMS.

    raises:
        StreamUnavailableError: stream url couldn't be fetched, or mpv isn't installed.
    """
    with _cam_locks[cam]:
        start_player(cam)
    # warm the conditions cache now, while the stream buffers, so show doesn't wait on the apis
    get_metrics(CAMS[cam].spot)


def start_player(cam: str) -> None:
    """launches a cam's mpv unless one's already running. caller holds the cam's lock.

    args:
        cam: cam id from CAMS.

    raises:
        StreamUnavailableError: stream url couldn't be fetched, or mpv isn't installed.
    """
    with _state_lock:
        existing = _players.get(cam)
    if existing is not None and existing.poll() is None:
        return
    url = get_stream_url(cam)
    # no default key bindings: mpv takes keyboard focus when it comes on top, and keys
    # meant for the kiosk (q, space, f...) would otherwise quit, pause, or shrink it
    command = [
        "mpv", "--no-terminal", "--no-osc", "--no-audio", "--no-input-default-bindings",
        "--pause", "--window-minimized=yes", "--fullscreen", "--ontop",
        f"--hwdec={MPV_HWDEC}",
        f"--demuxer-readahead-secs={DEMUXER_READAHEAD_S}",
        f"--input-ipc-server={ipc_socket_path(cam)}",
    ]
    if CAMS[cam].referrer:
        command.append(f"--referrer={CAMS[cam].referrer}")
    command.append(url)
    try:
        process = subprocess.Popen(command)
    except FileNotFoundError as err:
        raise StreamUnavailableError(
            "mpv isn't installed on the kiosk machine. run: sudo apt install mpv"
        ) from err
    with _state_lock:
        _players[cam] = process
    log.info("prepared %s (pid %d)", cam, process.pid)


def show_player(cam: str) -> None:
    """unpauses a cam's mpv and brings it fullscreen. prepares it first if needed.

    args:
        cam: cam id from CAMS.
    """
    prepare_player(cam)
    send_mpv_commands(cam, [
        ["set_property", "window-minimized", False],
        ["set_property", "fullscreen", True],
        ["set_property", "pause", False],
    ])
    show_overlay(cam)
    log.info("showing %s", cam)


ACTIONS = {"prepare": prepare_player, "show": show_player, "stop": stop_player}


class AgentHandler(BaseHTTPRequestHandler):
    """routes POST /cams/<cam>/<action> to the player functions, GET .../conditions to the readings."""

    def _send_json(self, status: int, body: dict) -> None:
        """writes a json response with cors headers for the allowed page origin."""
        payload = json.dumps(body).encode()
        self.send_response(status)
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            # chrome's private-network-access preflight (public site -> localhost) needs this
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self) -> None:
        """answers the browser's cors preflight."""
        self._send_json(200, {})

    def do_POST(self) -> None:
        """runs a prepare/show/stop action for a cam."""
        route = ROUTE_PATTERN.match(self.path)
        if not route or route["cam"] not in CAMS:
            self._send_json(404, {"error": f"unknown route or cam: {self.path}. known cams: {sorted(CAMS)}"})
            return
        try:
            ACTIONS[route["action"]](route["cam"])
        except StreamUnavailableError as err:
            log.error("%s %s failed: %s", route["action"], route["cam"], err)
            self._send_json(502, {"error": str(err)})
            return
        self._send_json(200, {"ok": True})

    def do_GET(self) -> None:
        """returns a cam's place name and current conditions (see conditions_to_json)."""
        route = CONDITIONS_ROUTE_PATTERN.match(self.path)
        if not route or route["cam"] not in CAMS:
            self._send_json(404, {"error": f"unknown route or cam: {self.path}. known cams: {sorted(CAMS)}"})
            return
        spot = CAMS[route["cam"]].spot
        self._send_json(200, {"name": spot.site.name, **conditions_to_json(get_conditions(spot))})

    def log_message(self, format: str, *args) -> None:
        """silences per-request access logs; actions are logged by the player functions."""


def exit_on_sigterm(signum: int, frame) -> None:
    """turns SIGTERM (pkill's default) into a normal exit so main's cleanup still runs."""
    sys.exit(0)


def main() -> None:
    """runs the agent until killed, cleaning up any mpv it started on the way out."""
    signal.signal(signal.SIGTERM, exit_on_sigterm)
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), AgentHandler)
    log.info("listening on %s:%d", LISTEN_HOST, LISTEN_PORT)
    try:
        server.serve_forever()
    finally:
        for cam in list(_players):
            stop_player(cam)


if __name__ == "__main__":
    main()
