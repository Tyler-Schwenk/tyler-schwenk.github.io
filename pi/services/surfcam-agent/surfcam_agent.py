#!/usr/bin/env python3
"""surfcam agent: plays live surf cams fullscreen on the display kiosk machine for the /display page.

the kiosk page (chrome) can't play these streams itself -- hdontap only allows
its own embed on other sites and 403s any browser request carrying a foreign
Origin header. mpv sends no Origin, so it plays them fine. this agent runs on
the kiosk next to the browser and drives mpv on behalf of the page over a tiny
localhost-only HTTP API:

    POST /cams/<cam>/prepare   start mpv paused + minimized so it buffers in the background
    POST /cams/<cam>/show      unpause, bring it fullscreen on top of chrome, and draw the
                               place name + surf conditions overlay (see surf_conditions.py)
    POST /cams/<cam>/stop      kill that cam's mpv

see pi/services/surfcam-agent/README.md for setup.
"""

import json
import logging
import re
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from surf_conditions import Metric, Site, get_metrics

LISTEN_HOST = "127.0.0.1"
LISTEN_PORT = 8765

# the only page origins allowed to call this API (browser cors check)
ALLOWED_ORIGINS = {"https://tyler-schwenk.com"}


@dataclass(frozen=True)
class Cam:
    """a live cam: the hdontap page that carries its stream, and where it is."""

    page_url: str
    site: Site


# cam id (used by the display page) -> cam. keep ids in sync with website/app/display/surfCams.ts.
# keep cams at 1080p or lower so decode and rendering stay light
CAMS = {
    "pb": Cam(
        "https://hdontap.com/stream/186699/pacific-beach-live-surf-webcam/",
        Site("Pacific Beach", 32.7936, -117.2570),
    ),
    "la-jolla-shores": Cam(
        "https://hdontap.com/stream/532541/la-jolla-shores-live-surf-cam/",
        Site("La Jolla Shores", 32.8567, -117.2560),
    ),
    "scripps-underwater": Cam(
        "https://hdontap.com/stream/018408/scripps-pier-underwater-live-webcam/",
        Site("Scripps Pier (underwater)", 32.8669, -117.2571),
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
    """returns a stream url for the cam, reusing a cached one while its token is fresh.

    args:
        cam: cam id from CAMS.

    returns:
        the .m3u8 url.
    """
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
    site = CAMS[cam].site
    try:
        ass = build_overlay_ass(site, get_metrics(site))
        sock = connect_ipc(cam)
        # no event lines are needed, and a client that never reads would let them pile up
        run_commands(sock, [
            ["disable_event", "all"],
            ["osd-overlay", OVERLAY_ID, "ass-events", ass, OVERLAY_RES_X, OVERLAY_RES_Y],
        ])
    except (StreamUnavailableError, OSError) as err:
        log.warning("overlay for %s not shown: %s", cam, err)
        return
    close_overlay(cam)
    with _state_lock:
        _overlay_connections[cam] = sock


def stop_player(cam: str) -> None:
    """kills a cam's mpv if it's running. safe to call when nothing's running."""
    close_overlay(cam)
    with _state_lock:
        process = _players.pop(cam, None)
    if process is None or process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=MPV_EXIT_TIMEOUT_S)
    except subprocess.TimeoutExpired:
        process.kill()


def prepare_player(cam: str) -> None:
    """starts mpv for a cam paused and minimized so it buffers without covering chrome.

    no-op if that cam's mpv is already running. mpv opens on the primary screen, which
    kiosk-run.sh makes the external monitor.

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
    command = [
        "mpv", "--no-terminal", "--no-osc", "--no-audio",
        "--pause", "--window-minimized=yes", "--fullscreen", "--ontop",
        f"--hwdec={MPV_HWDEC}",
        f"--demuxer-readahead-secs={DEMUXER_READAHEAD_S}",
        f"--input-ipc-server={ipc_socket_path(cam)}",
        url,
    ]
    try:
        process = subprocess.Popen(command)
    except FileNotFoundError as err:
        raise StreamUnavailableError(
            "mpv isn't installed on the kiosk machine. run: sudo apt install mpv"
        ) from err
    with _state_lock:
        _players[cam] = process
    # warm the conditions cache now, while the stream buffers, so show doesn't wait on the apis
    get_metrics(CAMS[cam].site)
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
    """routes POST /cams/<cam>/<action> to the player functions."""

    def _send_json(self, status: int, body: dict) -> None:
        """writes a json response with cors headers for the allowed page origin."""
        payload = json.dumps(body).encode()
        self.send_response(status)
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
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

    def log_message(self, format: str, *args) -> None:
        """silences per-request access logs; actions are logged by the player functions."""


def main() -> None:
    """runs the agent until killed, cleaning up any mpv it started on the way out."""
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), AgentHandler)
    log.info("listening on %s:%d", LISTEN_HOST, LISTEN_PORT)
    try:
        server.serve_forever()
    finally:
        for cam in list(_players):
            stop_player(cam)


if __name__ == "__main__":
    main()
