"""speaker agent: plays clips through the big speakers on displaytop's headphone jack.

runs on displaytop as a systemd service. fart-pi's services (the entrance song, the trash
reminder, house ghost) call it over the lan. clips are kept here on disk, named by their
sha256, so playback never depends on the wifi once it's started.

    GET  /status                   {"playing", "owner", "clip", "position_ms"}
    PUT  /clips/<sha256>           store a wav, the body has to match the hash
    POST /play/<owner>/<sha256>    start it. 404 if it's not stored, 409 if the speakers are
                                   busy. add ?wait=1 to answer when it finishes
    POST /stop/<owner>             stop it, only if that owner's the one playing

lan only, no auth, like the trash reminder's api. see pi/docs/services/speaker-agent.md.
"""

import hashlib
import json
import logging
import os
import re
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("speaker-agent")

LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 8771

CLIPS_DIR = Path(__file__).parent / "clips"
# the longest clip is the entrance song, about 15 mb
MAX_CLIP_BYTES = 64 * 1024 * 1024
UPLOAD_CHUNK_BYTES = 1024 * 1024

# by card name, since the usb mic can shift the card numbers between boots
ALSA_CARD = "PCH"
ALSA_DEVICE = f"plughw:CARD={ALSA_CARD},DEV=0"
# wide open, so the big speakers' own knob is the only volume. the laptop's speakers stay
# quiet while a cable's in the jack, because the codec's auto-mute is on
FULL_VOLUME_CONTROLS = ("Master", "Headphone")
FULL_VOLUME = "100%"
APLAY_BUSY_MESSAGE = "Device or resource busy"
# aplay fails within a few ms if it can't open the card, so surviving this long means it's playing
APLAY_STARTUP_GRACE_S = 0.3
APLAY_STOP_TIMEOUT_S = 2

MS_PER_S = 1000

STATUS_ROUTE = "/status"
CLIP_ROUTE = re.compile(r"^/clips/(?P<clip>[0-9a-f]{64})$")
PLAY_ROUTE = re.compile(r"^/play/(?P<owner>[a-z-]+)/(?P<clip>[0-9a-f]{64})(?P<wait>\?wait=1)?$")
STOP_ROUTE = re.compile(r"^/stop/(?P<owner>[a-z-]+)$")


class ClipMissingError(Exception):
    """the clip hasn't been uploaded yet."""


class SpeakersBusyError(Exception):
    """something else is playing."""


class PlaybackError(Exception):
    """aplay couldn't play the clip. the message says why."""


class Player:
    """runs one aplay at a time and tracks who it's for."""

    def __init__(self) -> None:
        """starts with nothing playing."""
        self._lock = threading.Lock()
        self._proc: subprocess.Popen | None = None
        self._owner: str | None = None
        self._clip: str | None = None
        self._started_at_s = 0.0

    def _is_playing(self) -> bool:
        """whether aplay is still running. call with the lock held."""
        return self._proc is not None and self._proc.poll() is None

    def status(self) -> dict:
        """what's playing right now.

        returns:
            {"playing", "owner", "clip", "position_ms"}. position_ms counts from when aplay
            was launched, and the rest are empty when nothing's playing.
        """
        with self._lock:
            if not self._is_playing():
                return {"playing": False, "owner": None, "clip": None, "position_ms": 0}
            position_ms = int((time.monotonic() - self._started_at_s) * MS_PER_S)
            return {"playing": True, "owner": self._owner, "clip": self._clip, "position_ms": position_ms}

    def play(self, owner: str, clip: str) -> subprocess.Popen:
        """starts a stored clip.

        args:
            owner: who's asking, so only they can stop it.
            clip: the clip's sha256.

        returns:
            the running aplay.

        raises:
            ClipMissingError: it isn't stored here.
            SpeakersBusyError: something's already using the card.
            PlaybackError: aplay failed some other way.
        """
        path = CLIPS_DIR / clip
        if not path.is_file():
            raise ClipMissingError(f"no clip {clip} here: PUT it to /clips/{clip} first")
        with self._lock:
            if self._is_playing():
                raise SpeakersBusyError(f"{self._owner} is using the speakers: try again when it's done")
            started_at_s = time.monotonic()
            proc = subprocess.Popen(
                ["aplay", "-q", "-D", ALSA_DEVICE, str(path)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                text=True,
            )
            _raise_if_aplay_failed(proc)
            self._proc, self._owner, self._clip, self._started_at_s = proc, owner, clip, started_at_s
        log.info("%s: playing %s", owner, clip[:12])
        return proc

    def stop(self, owner: str) -> None:
        """stops the current clip, if it belongs to this owner.

        args:
            owner: who's asking.

        side effects:
            terminates aplay, killing it if it won't go quietly.
        """
        with self._lock:
            if not self._is_playing() or self._owner != owner:
                return
            self._proc.terminate()
            try:
                self._proc.wait(APLAY_STOP_TIMEOUT_S)
            except subprocess.TimeoutExpired:
                log.warning("aplay ignored SIGTERM for %d s, killing it", APLAY_STOP_TIMEOUT_S)
                self._proc.kill()
                self._proc.wait()
        log.info("%s: stopped", owner)


def _raise_if_aplay_failed(proc: subprocess.Popen) -> None:
    """gives aplay a moment to fail, and turns a failure into the right error.

    args:
        proc: the aplay just launched.

    raises:
        SpeakersBusyError: the card's in use by something else on the laptop.
        PlaybackError: aplay failed some other way.
    """
    try:
        proc.wait(APLAY_STARTUP_GRACE_S)
    except subprocess.TimeoutExpired:
        return
    stderr = proc.stderr.read().strip()
    if APLAY_BUSY_MESSAGE in stderr:
        raise SpeakersBusyError("another program on displaytop has the sound card: try again in a few seconds")
    log.error("aplay exited %s: %s", proc.returncode, stderr)
    raise PlaybackError(f"aplay exited {proc.returncode} on {ALSA_DEVICE}: {stderr or 'no error output'}. check `aplay -l` on displaytop")


def store_clip(clip: str, body, length: int) -> None:
    """saves an uploaded clip, only if it really hashes to its name.

    args:
        clip: the sha256 it's meant to have.
        body: file-like object to read it from.
        length: how many bytes to read.

    raises:
        ValueError: the body doesn't match the hash.

    side effects:
        writes CLIPS_DIR/<clip>, atomically so a dropped upload can't leave half a clip.
    """
    digest = hashlib.sha256()
    with tempfile.NamedTemporaryFile(dir=CLIPS_DIR, delete=False) as temp:
        remaining = length
        while remaining > 0:
            chunk = body.read(min(UPLOAD_CHUNK_BYTES, remaining))
            if not chunk:
                break
            temp.write(chunk)
            digest.update(chunk)
            remaining -= len(chunk)
    if digest.hexdigest() != clip:
        os.unlink(temp.name)
        raise ValueError(f"upload hashes to {digest.hexdigest()}, not {clip}: was it cut off? send it again")
    os.chmod(temp.name, 0o644)
    os.replace(temp.name, CLIPS_DIR / clip)


player = Player()


class SpeakerHandler(BaseHTTPRequestHandler):
    """the http api, see the module docstring."""

    def _send_json(self, status: int, body: dict) -> None:
        """writes a json response. the caller may have hung up during a long wait, which is fine.

        args:
            status: http status code.
            body: response body.
        """
        payload = json.dumps(body).encode()
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except OSError as exc:
            log.info("caller hung up before its answer: %s", exc)

    def do_GET(self) -> None:
        """answers GET /status."""
        if self.path != STATUS_ROUTE:
            self._send_json(404, {"error": f"unknown route {self.path}, try GET {STATUS_ROUTE}"})
            return
        self._send_json(200, player.status())

    def do_PUT(self) -> None:
        """stores a clip."""
        match = CLIP_ROUTE.match(self.path)
        if not match:
            self._send_json(404, {"error": f"unknown route {self.path}, try PUT /clips/<sha256>"})
            return
        length = int(self.headers.get("Content-Length", 0))
        if not 0 < length <= MAX_CLIP_BYTES:
            self._send_json(413, {"error": f"a clip must be 1 to {MAX_CLIP_BYTES} bytes, this is {length}: send Content-Length"})
            return
        try:
            store_clip(match["clip"], self.rfile, length)
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return
        log.info("stored clip %s (%d bytes)", match["clip"][:12], length)
        self._send_json(201, {"clip": match["clip"]})

    def do_POST(self) -> None:
        """plays or stops a clip."""
        play = PLAY_ROUTE.match(self.path)
        if play:
            self._handle_play(play["owner"], play["clip"], bool(play["wait"]))
            return
        stop = STOP_ROUTE.match(self.path)
        if stop:
            player.stop(stop["owner"])
            self._send_json(200, player.status())
            return
        self._send_json(404, {"error": f"unknown route {self.path}, try POST /play/<owner>/<sha256> or /stop/<owner>"})

    def _handle_play(self, owner: str, clip: str, wait: bool) -> None:
        """starts a clip and answers with how it went.

        args:
            owner: who's asking.
            clip: the clip's sha256.
            wait: hold the answer until the clip's finished or stopped.
        """
        try:
            proc = player.play(owner, clip)
        except ClipMissingError as exc:
            self._send_json(404, {"error": str(exc)})
            return
        except SpeakersBusyError as exc:
            self._send_json(409, {"error": str(exc)})
            return
        except PlaybackError as exc:
            self._send_json(500, {"error": str(exc)})
            return
        if wait:
            proc.wait()
        self._send_json(200, player.status())

    def log_message(self, format: str, *args) -> None:
        """silences per-request logs, the entrance tab polls /status every few seconds."""


def set_full_volume() -> None:
    """opens up the laptop's volume, since the big speakers' knob is meant to be the control.

    a failure's only logged: playing too quietly beats not playing.

    side effects:
        changes the alsa mixer.
    """
    for control in FULL_VOLUME_CONTROLS:
        result = subprocess.run(["amixer", "-q", "-c", ALSA_CARD, "sset", control, FULL_VOLUME, "unmute"], capture_output=True, text=True)
        if result.returncode != 0:
            log.error("couldn't set %s to %s (%s): clips may play quietly. check `amixer -c %s`", control, FULL_VOLUME, result.stderr.strip(), ALSA_CARD)


def main() -> None:
    """sets the volume, then serves the api until it's stopped."""
    CLIPS_DIR.mkdir(exist_ok=True)
    set_full_volume()
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), SpeakerHandler)
    log.info("playing through %s, api on port %d", ALSA_DEVICE, LISTEN_PORT)
    server.serve_forever()


if __name__ == "__main__":
    main()
