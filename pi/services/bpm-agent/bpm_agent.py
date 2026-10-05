#!/usr/bin/env python3
"""bpm agent: listens to the usb mic on the display kiosk and streams the beat to the /display page.

runs on displaytop next to the kiosk browsers, so the page reads the beat straight off the
same machine and the same clock: a beat time the agent sends is directly comparable to the
page's Date.now(), with no network in between. the mic only records while at least one
page has the stream open (the bpm view is up), and stops CAPTURE_IDLE_GRACE_S after the
last one closes. localhost-only HTTP API:

    GET  /stream          server-sent events while the bpm view is up (see the README for
                          the event shapes): `config` once, then a `frame` per hop
                          (spectrum bands, onset, level) and a `tempo` a few times a second.
                          with ?waveform=1, also a `waveform` per hop: the raw recent
                          samples, for the milkdrop view
    POST /offset/earlier  move the beat earlier on screen by OFFSET_STEP_MS (the - key)
    POST /offset/later    move it later (the = key). both only work while listening
    GET  /status          whether it's listening, how many pages are connected, the offset

the offset is the calibration: it covers the delay between a beat in the room and its
pulse on screen, and is saved in calibration.json next to this file.

see pi/services/bpm-agent/README.md for setup.
"""

import base64
import json
import logging
import queue
import re
import signal
import subprocess
import sys
import threading
import time
import urllib.parse
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
from beat_tracker import (
    BAND_EDGES_HZ,
    BPM_GRID_STEP,
    DISPLAY_CEIL_DB,
    DISPLAY_FLOOR_DB,
    FRAME_RATE_HZ,
    HOP_SAMPLES,
    MIN_BPM,
    ONSET_MAX_HZ,
    ONSET_MIN_HZ,
    SAMPLE_RATE_HZ,
    SILENCE_DB,
    BeatTracker,
    Frame,
    TempoEstimate,
)

LISTEN_HOST = "127.0.0.1"
LISTEN_PORT = 8766

# the only page origins allowed to call this API (browser cors check)
ALLOWED_ORIGINS = {"https://tyler-schwenk.com"}

STREAM_PATH = "/stream"
WAVEFORM_QUERY_PARAM = "waveform"
STATUS_PATH = "/status"
OFFSET_ROUTE_PATTERN = re.compile(r"^/offset/(?P<direction>earlier|later)$")

# picks the usb mic out of `arecord -l`, whose card lines look like
# "card 1: Device [USB PnP Sound Device], device 0: USB Audio [USB Audio]"
ARECORD_CARD_PATTERN = re.compile(r"^card (?P<card>\d+): .*?\[(?P<name>[^\]]*)\], device (?P<device>\d+):")
USB_MIC_NAME_MARKER = "USB"
BYTES_PER_SAMPLE = 2  # S16_LE
# keep arecord's own buffering short, so samples reach us soon after they're captured
ARECORD_BUFFER_US = 40_000
ARECORD_PERIOD_US = 10_000
PROCESS_EXIT_TIMEOUT_S = 3

TEMPO_UPDATE_INTERVAL_S = 0.25
# a page reloading or switching views reconnects within this, and shouldn't make the
# tracker start over (it needs a few seconds of audio before its first tempo)
CAPTURE_IDLE_GRACE_S = 5.0

# frame times come from counting samples (steady) anchored to the wall clock, with the
# anchor eased this far toward each read's wall-clock time, so pipe jitter averages out
# and the sound card's clock can't drift away from the system clock
CLOCK_ANCHOR_SMOOTHING = 0.01

OFFSET_STEP_MS = 10
MAX_OFFSET_MS = 1000
CALIBRATION_FILE = Path(__file__).parent / "calibration.json"

# the waveform event carries this many of the latest samples: what butterchurn (milkdrop)
# reads from a web audio analyser each frame (its fftSize), at our 44.1 kHz rate
WAVEFORM_SAMPLES = 1024
# int16 -> unsigned byte centred on 128, like the web audio api's getByteTimeDomainData
WAVEFORM_BYTE_SCALE = 256
WAVEFORM_BYTE_CENTRE = 128

# a page that stops reading for this many messages (~1.5-3 s of frames) gets them dropped
CLIENT_QUEUE_SIZE = 256
SSE_KEEPALIVE_S = 15
# how long a disconnected page's EventSource waits before reconnecting
SSE_RETRY_MS = 3000

MS_PER_S = 1000

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("bpm-agent")


class MicUnavailableError(Exception):
    """raised when the usb mic can't be found or recorded from."""


def find_usb_mic() -> str:
    """finds the usb mic's alsa device by name, so a changed card number doesn't matter.

    returns:
        an alsa device string like "plughw:1,0" (plughw converts to our format and rate).

    raises:
        MicUnavailableError: arecord isn't installed, or no usb capture device is plugged in.
    """
    try:
        listing = subprocess.run(["arecord", "-l"], capture_output=True, text=True, check=False).stdout
    except FileNotFoundError as err:
        raise MicUnavailableError("arecord isn't installed on the kiosk. run: sudo apt install alsa-utils") from err
    for line in listing.splitlines():
        match = ARECORD_CARD_PATTERN.match(line)
        if match and USB_MIC_NAME_MARKER in match["name"]:
            return f"plughw:{match['card']},{match['device']}"
    raise MicUnavailableError(
        "no usb mic found (`arecord -l` lists no capture card with USB in its name). "
        "check it's plugged in, and that `lsusb` shows it."
    )


def load_offset_ms() -> int:
    """reads the saved calibration offset, or 0 if there isn't one yet (or it's unreadable)."""
    try:
        return int(json.loads(CALIBRATION_FILE.read_text())["offset_ms"])
    except FileNotFoundError:
        return 0
    except (ValueError, KeyError, TypeError) as err:
        log.warning("ignoring unreadable %s (%s); starting from offset 0", CALIBRATION_FILE, err)
        return 0


def save_offset_ms(offset_ms: int) -> None:
    """saves the calibration offset atomically, so a crash mid-write can't corrupt it."""
    tmp_path = CALIBRATION_FILE.with_suffix(".tmp")
    tmp_path.write_text(json.dumps({"offset_ms": offset_ms}))
    tmp_path.replace(CALIBRATION_FILE)


def encode_event(name: str, data: dict) -> bytes:
    """formats one server-sent event."""
    return f"event: {name}\ndata: {json.dumps(data, separators=(',', ':'))}\n\n".encode()


def config_event() -> bytes:
    """the fixed facts the page needs to draw the stream: band layout and scale, rates, thresholds."""
    return encode_event("config", {
        "band_edges_hz": [round(float(edge), 1) for edge in BAND_EDGES_HZ],
        "band_floor_db": DISPLAY_FLOOR_DB,
        "band_ceil_db": DISPLAY_CEIL_DB,
        "onset_min_hz": ONSET_MIN_HZ,
        "onset_max_hz": ONSET_MAX_HZ,
        "frame_rate_hz": FRAME_RATE_HZ,
        "silence_db": SILENCE_DB,
        "curve_min_bpm": MIN_BPM,
        "curve_step_bpm": BPM_GRID_STEP,
    })


def frame_event(frame: Frame) -> bytes:
    """one analysed hop as a `frame` event."""
    return encode_event("frame", {
        "t_ms": round(frame.time_s * MS_PER_S, 1),
        "bands": frame.bands.tolist(),
        "onset": round(frame.onset, 3),
        "level_db": round(frame.level_db, 1),
    })


def tempo_event(estimate: TempoEstimate, offset_ms: int) -> bytes:
    """a tempo estimate as a `tempo` event, with the calibration offset applied to beat_ms."""
    beat_ms = None
    if estimate.beat_s is not None:
        beat_ms = round(estimate.beat_s * MS_PER_S + offset_ms, 1)
    period_ms = round(estimate.period_s * MS_PER_S, 2) if estimate.period_s is not None else None
    return encode_event("tempo", {
        "bpm": round(estimate.bpm, 1) if estimate.bpm is not None else None,
        "confidence": round(estimate.confidence, 2),
        "beat_ms": beat_ms,
        "period_ms": period_ms,
        "offset_ms": offset_ms,
        "level_db": round(estimate.level_db, 1),
        "curve": np.round(estimate.curve, 3).tolist(),
    })


def waveform_event(time_s: float, samples: np.ndarray) -> bytes:
    """the latest samples as a `waveform` event: unsigned bytes centred on 128, base64.

    args:
        time_s: when the newest sample was captured, epoch seconds.
        samples: the latest WAVEFORM_SAMPLES int16 samples, oldest first.
    """
    as_bytes = (samples.astype(np.int32) // WAVEFORM_BYTE_SCALE + WAVEFORM_BYTE_CENTRE).astype(np.uint8)
    return encode_event("waveform", {
        "t_ms": round(time_s * MS_PER_S, 1),
        "bytes": base64.b64encode(as_bytes.tobytes()).decode(),
    })


class Broadcaster:
    """fans encoded events out to every connected page, each through its own queue.

    a None in a queue tells that page's handler to close the stream (its EventSource then
    reconnects). the latest tempo event is kept and handed to each new page straight away.
    waveform events only go to pages that asked for them.
    """

    def __init__(self) -> None:
        """starts with no pages."""
        self._lock = threading.Lock()
        # page queue -> whether it wants waveform events
        self._queues: dict[queue.Queue, bool] = {}
        self._latest_tempo: bytes | None = None

    def add(self, wants_waveform: bool) -> queue.Queue:
        """registers a page and returns its queue, primed with the config and latest tempo.

        args:
            wants_waveform: also send it waveform events.
        """
        client_queue: queue.Queue = queue.Queue(maxsize=CLIENT_QUEUE_SIZE)
        client_queue.put_nowait(config_event())
        with self._lock:
            if self._latest_tempo is not None:
                client_queue.put_nowait(self._latest_tempo)
            self._queues[client_queue] = wants_waveform
        return client_queue

    def remove(self, client_queue: queue.Queue) -> int:
        """unregisters a page and returns how many are left."""
        with self._lock:
            self._queues.pop(client_queue, None)
            return len(self._queues)

    def wants_waveform(self) -> bool:
        """whether any page wants waveform events (so they're only built when needed)."""
        with self._lock:
            return any(self._queues.values())

    def count(self) -> int:
        """how many pages are connected."""
        with self._lock:
            return len(self._queues)

    def publish(self, event: bytes, is_tempo: bool = False, waveform_only: bool = False) -> None:
        """sends an event to every page, dropping it for any page that's fallen behind.

        args:
            event: the encoded event.
            is_tempo: remember it as the latest tempo, for pages that join later.
            waveform_only: only send it to pages that asked for waveform events.
        """
        with self._lock:
            if is_tempo:
                self._latest_tempo = event
            targets = [q for q, wants_waveform in self._queues.items() if wants_waveform or not waveform_only]
            for client_queue in targets:
                self._put(client_queue, event)

    def close_all(self) -> None:
        """tells every page's handler to close its stream, and forgets the last tempo."""
        with self._lock:
            self._latest_tempo = None
            for client_queue in self._queues:
                self._put(client_queue, None)

    @staticmethod
    def _put(client_queue: queue.Queue, item: bytes | None) -> None:
        """queues an item without blocking the capture thread on a slow page."""
        try:
            client_queue.put_nowait(item)
        except queue.Full:
            pass


@dataclass
class CaptureState:
    """what the capture thread carries from one hop to the next."""

    tracker: BeatTracker = field(default_factory=BeatTracker)
    samples_read: int = 0
    # wall-clock time of sample 0 (see Listener._ease_anchor), None before the first hop
    anchor_s: float | None = None
    next_tempo_s: float = 0.0
    waveform: np.ndarray = field(default_factory=lambda: np.zeros(WAVEFORM_SAMPLES, dtype=np.int16))


class Listener:
    """records the mic with arecord on a background thread and publishes what it hears.

    start/stop are called by CaptureManager under its lock; the capture thread itself
    only touches the tracker and the broadcaster.
    """

    def __init__(self, broadcaster: Broadcaster) -> None:
        """idle until start()."""
        self._broadcaster = broadcaster
        self._process: subprocess.Popen | None = None
        self._thread: threading.Thread | None = None
        self._stopping = threading.Event()
        self._offset_lock = threading.Lock()
        self._offset_ms = load_offset_ms()

    @property
    def running(self) -> bool:
        """true while the capture thread is alive."""
        return self._thread is not None and self._thread.is_alive()

    @property
    def offset_ms(self) -> int:
        """the current calibration offset."""
        with self._offset_lock:
            return self._offset_ms

    def nudge_offset(self, step_ms: int) -> int:
        """moves the calibration offset and saves it.

        args:
            step_ms: how far to move it (negative is earlier on screen).

        returns:
            the new offset, clamped to +-MAX_OFFSET_MS.
        """
        with self._offset_lock:
            self._offset_ms = max(-MAX_OFFSET_MS, min(MAX_OFFSET_MS, self._offset_ms + step_ms))
            save_offset_ms(self._offset_ms)
            return self._offset_ms

    def start(self) -> None:
        """starts arecord and the capture thread with a fresh tracker.

        raises:
            MicUnavailableError: no usb mic, or arecord couldn't start.
        """
        device = find_usb_mic()
        command = [
            "arecord", "-q", "-D", device, "-f", "S16_LE", "-r", str(SAMPLE_RATE_HZ), "-c", "1",
            "-t", "raw", f"--buffer-time={ARECORD_BUFFER_US}", f"--period-time={ARECORD_PERIOD_US}",
        ]
        try:
            self._process = subprocess.Popen(command, stdout=subprocess.PIPE)
        except OSError as err:
            raise MicUnavailableError(f"couldn't start arecord on {device}: {err}") from err
        self._stopping.clear()
        self._thread = threading.Thread(target=self._capture, args=(self._process,), daemon=True)
        self._thread.start()
        log.info("listening on %s", device)

    def stop(self) -> None:
        """stops arecord and waits for the capture thread to finish. safe when not running."""
        if self._thread is None:
            return
        self._stopping.set()
        if self._process is not None and self._process.poll() is None:
            self._process.terminate()
            try:
                self._process.wait(timeout=PROCESS_EXIT_TIMEOUT_S)
            except subprocess.TimeoutExpired:
                self._process.kill()
        self._thread.join()
        self._process = None
        self._thread = None
        log.info("stopped listening")

    def _capture(self, process: subprocess.Popen) -> None:
        """reads hops from arecord until it ends, publishing frames and tempo estimates.

        if arecord ends without stop() asking it to (the mic was unplugged, or it's busy),
        every page gets an `error` event and its stream is closed; the pages reconnect,
        which starts a fresh attempt.
        """
        state = CaptureState()
        hop_bytes = HOP_SAMPLES * BYTES_PER_SAMPLE
        try:
            raw = process.stdout.read(hop_bytes)
            while len(raw) == hop_bytes:
                self._process_hop(state, np.frombuffer(raw, dtype=np.int16))
                raw = process.stdout.read(hop_bytes)
        except Exception:  # noqa: BLE001 -- a bug here must still reach the pages, not die silently
            log.exception("capture failed")
        if self._stopping.is_set():
            return
        message = f"the mic stopped recording (arecord exit code {process.poll()}). is it still plugged in?"
        log.error(message)
        self._broadcaster.publish(encode_event("error", {"message": message}))
        self._broadcaster.close_all()

    def _process_hop(self, state: CaptureState, hop: np.ndarray) -> None:
        """analyses one hop and publishes its frame, its waveform (if wanted) and, every
        TEMPO_UPDATE_INTERVAL_S, a tempo estimate.

        args:
            state: the capture's running state, updated in place.
            hop: HOP_SAMPLES int16 samples.
        """
        state.samples_read += hop.size
        state.anchor_s = self._ease_anchor(state.anchor_s, state.samples_read)
        frame = state.tracker.process(hop, state.anchor_s + state.samples_read / SAMPLE_RATE_HZ)
        self._broadcaster.publish(frame_event(frame))
        state.waveform = np.concatenate([state.waveform[hop.size:], hop])
        if self._broadcaster.wants_waveform():
            self._broadcaster.publish(waveform_event(frame.time_s, state.waveform), waveform_only=True)
        if frame.time_s >= state.next_tempo_s:
            state.next_tempo_s = frame.time_s + TEMPO_UPDATE_INTERVAL_S
            self._broadcaster.publish(tempo_event(state.tracker.estimate(), self.offset_ms), is_tempo=True)

    @staticmethod
    def _ease_anchor(anchor_s: float | None, samples_read: int) -> float:
        """moves the sample clock's anchor a little toward this read's wall-clock time.

        args:
            anchor_s: wall-clock time of sample 0, or None on the first read.
            samples_read: samples read so far, including this read.

        returns:
            the new anchor: frame time = anchor + samples / rate.
        """
        observed_anchor_s = time.time() - samples_read / SAMPLE_RATE_HZ
        if anchor_s is None:
            return observed_anchor_s
        return anchor_s + CLOCK_ANCHOR_SMOOTHING * (observed_anchor_s - anchor_s)


class CaptureManager:
    """starts the mic when the first page connects and stops it once they've all gone."""

    def __init__(self, broadcaster: Broadcaster, listener: Listener) -> None:
        """idle until a page joins."""
        self._lock = threading.Lock()
        self._broadcaster = broadcaster
        self._listener = listener

    def page_joined(self) -> None:
        """makes sure the mic is recording.

        raises:
            MicUnavailableError: it couldn't be started.
        """
        with self._lock:
            if not self._listener.running:
                # tidy up after a capture thread that ended by itself
                self._listener.stop()
                self._listener.start()

    def page_left(self, remaining: int) -> None:
        """schedules the mic to stop if no pages are left once the grace period's up.

        args:
            remaining: pages still connected.
        """
        if remaining > 0:
            return
        timer = threading.Timer(CAPTURE_IDLE_GRACE_S, self._stop_if_idle)
        timer.daemon = True
        timer.start()

    def _stop_if_idle(self) -> None:
        """stops the mic if still nobody's watching."""
        with self._lock:
            if self._broadcaster.count() == 0 and self._listener.running:
                self._listener.stop()


broadcaster = Broadcaster()
listener = Listener(broadcaster)
capture = CaptureManager(broadcaster, listener)


class AgentHandler(BaseHTTPRequestHandler):
    """routes the stream, offset and status requests (see the module docstring)."""

    def _send_cors_headers(self) -> None:
        """adds cors headers for the allowed page origin."""
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            # chrome's private-network-access preflight (public site -> localhost) needs this
            self.send_header("Access-Control-Allow-Private-Network", "true")

    def _send_json(self, status: int, body: dict) -> None:
        """writes a json response."""
        payload = json.dumps(body).encode()
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self) -> None:
        """answers the browser's cors preflight."""
        self._send_json(200, {})

    def do_GET(self) -> None:
        """serves the event stream or the status."""
        url = urllib.parse.urlsplit(self.path)
        if url.path == STREAM_PATH:
            wants_waveform = urllib.parse.parse_qs(url.query).get(WAVEFORM_QUERY_PARAM) == ["1"]
            self._stream(wants_waveform)
            return
        if url.path == STATUS_PATH:
            self._send_json(200, {
                "listening": listener.running,
                "pages": broadcaster.count(),
                "offset_ms": listener.offset_ms,
            })
            return
        self._send_json(404, {"error": f"unknown route: {self.path}. try {STREAM_PATH} or {STATUS_PATH}"})

    def do_POST(self) -> None:
        """nudges the calibration offset, while listening."""
        route = OFFSET_ROUTE_PATTERN.match(urllib.parse.urlsplit(self.path).path)
        if not route:
            self._send_json(404, {"error": f"unknown route: {self.path}. try /offset/earlier or /offset/later"})
            return
        if not listener.running:
            self._send_json(409, {"error": "not listening -- press b for bpm mode before nudging the offset"})
            return
        step_ms = -OFFSET_STEP_MS if route["direction"] == "earlier" else OFFSET_STEP_MS
        offset_ms = listener.nudge_offset(step_ms)
        log.info("offset now %d ms", offset_ms)
        self._send_json(200, {"offset_ms": offset_ms})

    def _stream(self, wants_waveform: bool) -> None:
        """streams events to one page until it disconnects or the capture ends.

        args:
            wants_waveform: also send it waveform events (?waveform=1).
        """
        self.send_response(200)
        self._send_cors_headers()
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(f"retry: {SSE_RETRY_MS}\n\n".encode())

        client_queue = broadcaster.add(wants_waveform)
        try:
            capture.page_joined()
        except MicUnavailableError as err:
            log.error("can't listen: %s", err)
            self.wfile.write(encode_event("error", {"message": str(err)}))
            capture.page_left(broadcaster.remove(client_queue))
            return
        try:
            self._pump(client_queue)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            capture.page_left(broadcaster.remove(client_queue))

    def _pump(self, client_queue: queue.Queue) -> None:
        """writes queued events out until told to close, keeping an idle stream alive."""
        while True:
            try:
                event = client_queue.get(timeout=SSE_KEEPALIVE_S)
            except queue.Empty:
                event = b": keepalive\n\n"
            if event is None:
                return
            self.wfile.write(event)
            self.wfile.flush()

    def log_message(self, format: str, *args) -> None:
        """silences per-request access logs; listening and offset changes are logged instead."""


class AgentServer(ThreadingHTTPServer):
    """http server whose request threads don't hold up exit (streams never end on their own)."""

    daemon_threads = True


def exit_on_sigterm(signum: int, frame) -> None:
    """turns SIGTERM (pkill's default) into a normal exit so main's cleanup still runs."""
    sys.exit(0)


def main() -> None:
    """runs the agent until killed, stopping arecord on the way out."""
    signal.signal(signal.SIGTERM, exit_on_sigterm)
    server = AgentServer((LISTEN_HOST, LISTEN_PORT), AgentHandler)
    log.info("listening for pages on %s:%d (offset %d ms)", LISTEN_HOST, LISTEN_PORT, listener.offset_ms)
    try:
        server.serve_forever()
    finally:
        listener.stop()


if __name__ == "__main__":
    main()
