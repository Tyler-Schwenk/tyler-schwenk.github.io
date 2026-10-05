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
    POST /cams/stop-all        kill every cam's mpv (kiosk-run.sh, when it kills the browsers)
    GET  /cams/<cam>/conditions  the cam's name, waves, wind and tide (with its graph) as
                                 json, for the conditions panel on the other screen

it also relays the kiosk's keyboard to the pages (see kiosk_control.py):

    POST /control/keys/<key>   a key press, from xbindkeys
    POST /control/reset        clear the presses (kiosk-run.sh, when the overnight sleep starts)
    GET  /control/log?after=N  the presses since the last reset, long-polled by the pages
    POST /control/status       {"preset": name or null}: the milkdrop preset playing, from
                               the page, passed on to the admin page's remote

and, when ~/surfcam-agent/kiosk-token is set up, it picks up presses from the admin
page's remote through the website backend (see remote_control.py).

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
import urllib.parse
import urllib.request
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Optional

from kiosk_control import CONTROL_KEYS, ControlLog
from remote_control import start_remote_control
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

# a prepared cam that isn't shown within this long is stopped: a key press can change
# what's due next after the page has already prepared it, and nothing else would stop it
PREPARED_UNSHOWN_TIMEOUT_S = 30

# show waits this long for mpv's first frame before giving up (see wait_for_first_frame)
FIRST_FRAME_TIMEOUT_S = 20
FIRST_FRAME_POLL_INTERVAL_S = 0.25

# a shown cam whose mpv exits by itself (the stream dropped, or its token expired on a long
# hold) is restarted after this pause, for as long as the page still wants it shown
SHOWN_RESTART_DELAY_S = 10

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
CONTROL_KEY_ROUTE_PATTERN = re.compile(r"^/control/keys/(?P<key>[a-z0-9]+)$")
CONTROL_LOG_PATH = "/control/log"
CONTROL_RESET_PATH = "/control/reset"
CONTROL_STATUS_PATH = "/control/status"
# a status report is a preset name in a tiny json object; anything bigger isn't one
MAX_STATUS_BODY_BYTES = 1024
STOP_ALL_PATH = "/cams/stop-all"

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
# cam -> token of the page mount that last asked to show it (see stop_player)
_shown_tokens: dict[str, Optional[str]] = {}
# stands in for "no entry" when a token itself may be None
_NOT_SHOWN = object()
control_log = ControlLog()


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


def await_reply(reader) -> dict:
    """blocks until mpv answers our ipc command, skipping its unsolicited event lines.

    mpv drops commands still queued when the client disconnects, so we have to
    read each reply before moving on or closing the socket.

    args:
        reader: file-like object over the ipc socket.

    returns:
        mpv's reply, like {"data": ..., "error": "success", "request_id": 1}.
    """
    for line in reader:
        reply = json.loads(line)
        if reply.get("request_id") == IPC_REQUEST_ID:
            return reply
    return {}


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


def get_mpv_property(cam: str, name: str) -> object:
    """reads one property from a cam's mpv.

    args:
        cam: cam id.
        name: mpv property name, like "vo-configured".

    returns:
        the value, or None if mpv says it's unavailable.

    raises:
        StreamUnavailableError: the control socket never became available.
    """
    with connect_ipc(cam) as sock:
        request = {"command": ["get_property", name], "request_id": IPC_REQUEST_ID}
        sock.sendall(json.dumps(request).encode() + b"\n")
        return await_reply(sock.makefile("rb")).get("data")


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


def stop_player(cam: str, token: Optional[str] = None) -> None:
    """kills a cam's mpv if it's running. safe to call when nothing's running.

    a stop carrying the token of an older show is ignored: the page's stop for a cam it's
    leaving can reach the agent after its show for the same cam again (they travel on
    separate connections), and must not kill the video that's meant to be up.

    args:
        cam: cam id from CAMS.
        token: the token the page's show used, or None to stop unconditionally.
    """
    with _state_lock:
        shown_token = _shown_tokens.get(cam)
    if token is not None and shown_token is not None and token != shown_token:
        log.info("ignoring a stale stop for %s", cam)
        return
    close_overlay(cam)
    with _cam_locks[cam]:
        with _state_lock:
            process = _players.pop(cam, None)
            _shown_tokens.pop(cam, None)
        if process is not None and process.poll() is None:
            terminate_process(process)


def stop_if_never_shown(cam: str, process: subprocess.Popen) -> None:
    """stops a prepared mpv that was never shown (see PREPARED_UNSHOWN_TIMEOUT_S).

    args:
        cam: cam id from CAMS.
        process: the mpv that was prepared; a newer one for the same cam is left alone.
    """
    with _state_lock:
        abandoned = _players.get(cam) is process and cam not in _shown_tokens
    if abandoned:
        log.info("stopping %s: prepared but never shown", cam)
        stop_player(cam)


def prepare_player(cam: str) -> None:
    """starts mpv for a cam paused and minimized so it buffers without covering chrome.

    no-op if that cam's mpv is already running. mpv opens on the primary screen, which
    kiosk-run.sh makes the external monitor. if the cam isn't shown within
    PREPARED_UNSHOWN_TIMEOUT_S it's stopped again.

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
    cleanup = threading.Timer(PREPARED_UNSHOWN_TIMEOUT_S, stop_if_never_shown, args=(cam, process))
    cleanup.daemon = True
    cleanup.start()
    log.info("prepared %s (pid %d)", cam, process.pid)


def wait_for_first_frame(cam: str) -> None:
    """waits until a cam's mpv has decoded its first frame.

    until then its window is an empty white rectangle, so it mustn't be brought up yet.
    a cam prepared ahead of time is ready at once; one jumped to with a key takes a few
    seconds, during which the page's "loading surf cam..." stays on screen.

    args:
        cam: cam id from CAMS.

    raises:
        StreamUnavailableError: no frame within FIRST_FRAME_TIMEOUT_S.
    """
    deadline = time.monotonic() + FIRST_FRAME_TIMEOUT_S
    while time.monotonic() < deadline:
        if get_mpv_property(cam, "vo-configured"):
            return
        time.sleep(FIRST_FRAME_POLL_INTERVAL_S)
    raise StreamUnavailableError(
        f"no video from {cam} after {FIRST_FRAME_TIMEOUT_S} s. the stream may be down; "
        "check it with mpv by hand (see the agent README)."
    )


def is_shown_for(cam: str, token: Optional[str]) -> bool:
    """true while the show with this token is still the one the page wants up."""
    with _state_lock:
        return _shown_tokens.get(cam, _NOT_SHOWN) == token


def show_player(cam: str, token: Optional[str] = None, claim: bool = True) -> None:
    """unpauses a cam's mpv and brings it fullscreen once it has a picture. prepares it first if needed.

    if the cam is stopped while it's starting up, its window is never brought up.

    args:
        cam: cam id from CAMS.
        token: identifies the page mount asking, so its later stop can be told apart
            from a stale one (see stop_player).
        claim: record this token as the one showing the cam. a restart (see
            restart_if_dropped) passes False, so it can't undo a stop that lands meanwhile.

    raises:
        StreamUnavailableError: the stream couldn't be started or never produced a frame.
    """
    prepare_player(cam)
    # claim the cam before waiting, so a stale stop arriving meanwhile is recognised
    if claim:
        with _state_lock:
            _shown_tokens[cam] = token
    wait_for_first_frame(cam)
    if not is_shown_for(cam, token):
        # stopped while starting up (or a newer show took over, which raises it itself)
        with _state_lock:
            stopped = cam not in _shown_tokens
        if stopped:
            stop_player(cam)
        return
    send_mpv_commands(cam, [
        ["set_property", "window-minimized", False],
        ["set_property", "fullscreen", True],
        ["set_property", "pause", False],
    ])
    show_overlay(cam)
    log.info("showing %s", cam)
    with _state_lock:
        process = _players.get(cam)
    if process is not None:
        threading.Thread(target=restart_if_dropped, args=(cam, token, process), daemon=True).start()


def restart_if_dropped(cam: str, token: Optional[str], process: subprocess.Popen) -> None:
    """waits for a shown cam's mpv to exit, and shows the cam again if it wasn't stopped on purpose.

    a held cam can stay up for hours, long enough for the stream to drop or its url
    token to expire; without this the screen would be left on "loading surf cam...".
    a stop (from the page, stop_all_players, or a newer show) clears or replaces the
    token first, which is how a deliberate stop is told apart from a drop.

    args:
        cam: cam id from CAMS.
        token: the show this watcher belongs to.
        process: the mpv to watch.
    """
    process.wait()
    with _state_lock:
        dropped = _shown_tokens.get(cam, _NOT_SHOWN) == token and _players.get(cam) is process
        if dropped:
            _players.pop(cam, None)
    if not dropped:
        return
    log.warning("%s dropped while showing (mpv exit code %s); restarting it", cam, process.returncode)
    close_overlay(cam)
    # keep trying for as long as the page still wants this cam up
    while is_shown_for(cam, token):
        time.sleep(SHOWN_RESTART_DELAY_S)
        try:
            show_player(cam, token, claim=False)
            return
        except StreamUnavailableError as err:
            log.error("restarting %s failed: %s; trying again", cam, err)


def stop_all_players() -> None:
    """stops every cam, for kiosk-run.sh when it kills the browsers (nobody's left to send stop)."""
    for cam in CAMS:
        stop_player(cam)


class AgentHandler(BaseHTTPRequestHandler):
    """routes the cam player, conditions and keyboard-control requests (see the module docstring)."""

    def _send_json(self, status: int, body: dict) -> None:
        """writes a json response with cors headers for the allowed page origin."""
        payload = json.dumps(body).encode()
        self.send_response(status)
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            # the status report sends json, which needs Content-Type allowed
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            # chrome's private-network-access preflight (public site -> localhost) needs this
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _send_not_found(self) -> None:
        """404 naming what does exist, so a typo'd cam id or key is easy to spot."""
        self._send_json(404, {
            "error": f"unknown route: {self.path}. known cams: {sorted(CAMS)}, known keys: {sorted(CONTROL_KEYS)}"
        })

    def do_OPTIONS(self) -> None:
        """answers the browser's cors preflight."""
        self._send_json(200, {})

    def do_POST(self) -> None:
        """runs a cam action, records a control key press, or resets the control log."""
        path = urllib.parse.urlsplit(self.path).path
        key_route = CONTROL_KEY_ROUTE_PATTERN.match(path)
        if key_route and key_route["key"] in CONTROL_KEYS:
            control_log.add([key_route["key"]])
            log.info("key %s", key_route["key"])
            self._send_json(200, {"ok": True})
            return
        if path == STOP_ALL_PATH:
            stop_all_players()
            log.info("stopped all cams")
            self._send_json(200, {"ok": True})
            return
        if path == CONTROL_STATUS_PATH:
            self._record_status()
            return
        if path == CONTROL_RESET_PATH:
            control_log.reset()
            log.info("control reset")
            self._send_json(200, {"ok": True})
            return
        token = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).get("token", [None])[0]
        self._run_cam_action(path, token)

    def _record_status(self) -> None:
        """stores the page's report of the milkdrop preset playing (see ControlLog.set_preset)."""
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_STATUS_BODY_BYTES:
            self._send_json(413, {"error": f"status body is {length} bytes; at most {MAX_STATUS_BODY_BYTES}"})
            return
        try:
            preset = json.loads(self.rfile.read(length) or b"{}").get("preset")
        except (json.JSONDecodeError, AttributeError) as err:
            self._send_json(400, {"error": f'status must be json like {{"preset": "name"}}: {err}'})
            return
        control_log.set_preset(preset if isinstance(preset, str) else None)
        self._send_json(200, {"ok": True})

    def _run_cam_action(self, path: str, token: Optional[str]) -> None:
        """runs prepare/show/stop for a cam, from a /cams/<cam>/<action> path.

        args:
            path: request path.
            token: the ?token= the page's show/stop carry (see stop_player), if any.
        """
        route = ROUTE_PATTERN.match(path)
        if not route or route["cam"] not in CAMS:
            self._send_not_found()
            return
        actions = {
            "prepare": prepare_player,
            "show": lambda cam: show_player(cam, token),
            "stop": lambda cam: stop_player(cam, token),
        }
        try:
            actions[route["action"]](route["cam"])
        except StreamUnavailableError as err:
            log.error("%s %s failed: %s", route["action"], route["cam"], err)
            self._send_json(502, {"error": str(err)})
            return
        self._send_json(200, {"ok": True})

    def do_GET(self) -> None:
        """returns a cam's conditions, or long-polls the control log (see kiosk_control.py)."""
        url = urllib.parse.urlsplit(self.path)
        if url.path == CONTROL_LOG_PATH:
            after = urllib.parse.parse_qs(url.query).get("after", ["-1"])[0]
            if not after.lstrip("-").isdigit():
                self._send_json(400, {"error": f"after must be an integer version, got {after!r}"})
                return
            self._send_json(200, control_log.wait_for_change(int(after)))
            return
        route = CONDITIONS_ROUTE_PATTERN.match(url.path)
        if not route or route["cam"] not in CAMS:
            self._send_not_found()
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
    start_remote_control(control_log)
    try:
        server.serve_forever()
    finally:
        stop_all_players()


if __name__ == "__main__":
    main()
