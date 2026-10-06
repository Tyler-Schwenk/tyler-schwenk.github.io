"""
Trash reminder service.

Runs on fart-pi as a systemd service. Plays audio reminders through I2S
speakers to remind roommates to take out the trash every Thursday at 5 PM.
Escalates every 10 minutes with increasingly obnoxious clips until someone
hits the button or 11 PM arrives.

Button behavior:
  - During trash time (Thu 5-11 PM): kills current audio, plays a thanks
    sequence, and stops reminders for the rest of the week.
  - Any other time: plays an alternating idle greeting.

It also serves a tiny LAN-only HTTP API so the display kiosk (displaytop) can
take over its screens while it's trash time, and confirm from its keyboard:

    GET  /status    {"state": "idle" | "trash_active" | "trash_done",
                     "confirmed_at_ms": epoch ms of the last confirmation, or null}
    POST /confirm   same as the button during trash time; 409 any other time

see pi/docs/services/trash-reminder.md.

Audio files live in the audio/ subdirectory next to this script.
Copy them to the Pi with scp — they're not in git (binary files).
"""

import json
import logging
import random
import subprocess
import threading
import time
from datetime import date, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from signal import pause

from gpiozero import Button
from gpiozero.pins.lgpio import LGPIOFactory

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---- hardware ----

# GPIO pin (BCM numbering) for the confirmation button
BUTTON_PIN = 17

# ALSA device for I2S amps — card 2 on fart-pi (verify with `aplay -l`)
ALSA_DEVICE = "plughw:2,0"

# debounce window (s) — prevents double-fires on a single press
BUTTON_DEBOUNCE_S = 0.2


# ---- http api ----

# every interface, so displaytop can reach it over the LAN. the cloudflare tunnel only
# points at port 8000, so this never leaves the house
API_LISTEN_HOST = "0.0.0.0"
API_PORT = 8770
API_STATUS_PATH = "/status"
API_CONFIRM_PATH = "/confirm"


# ---- paths ----

SERVICE_DIR = Path(__file__).parent
AUDIO_DIR = SERVICE_DIR / "audio"
STATE_FILE = SERVICE_DIR / "trash_state.json"


# ---- audio clips ----

CLIP_SIREN = "siren.wav"
CLIP_TAKE_OUT_TRASH = "take_out_trash.wav"
CLIP_HEY_GUYS = "hey_guys.wav"
CLIP_TELL_THE_BIRD = "tell_the_bird.wav"
CLIP_THANKS = "thanks.wav"
CLIP_I_LOVE_YOU = "i_love_you.wav"


# ---- schedule ----

# weekday for trash night (Monday=0, Thursday=3)
TRASH_WEEKDAY = 3
TRASH_START_HOUR = 17   # 5 PM
TRASH_END_HOUR = 23     # 11 PM

# time between follow-up reminders (s)
REMINDER_INTERVAL_S = 600  # 10 minutes

# probability of prepending the siren before a follow-up
SIREN_PROBABILITY = 0.3

# how often the scheduler wakes up to check the clock (s)
SCHEDULE_CHECK_INTERVAL_S = 30

# pause after killing a reminder mid-clip before the thanks starts (s)
THANKS_GAP_S = 0.3


# ---- shared state ----

# current mode: "idle" | "trash_active" | "trash_done"
_state = "idle"
_state_lock = threading.Lock()

# epoch ms of the last confirmation (button or kiosk), so the kiosk can show its thanks
# screen whichever one did it. memory only: after a restart there's nothing to thank
_confirmed_at_ms: int | None = None

# tracked so we can kill it when the button is pressed mid-playback
_current_proc: subprocess.Popen | None = None
_proc_lock = threading.Lock()

# alternates between hey_guys and i_love_you on idle button presses
_idle_clip_index = 0

# monotonic time of the last reminder, used to space out follow-ups
_last_reminder_time = 0.0


# ---- state helpers ----

def get_state() -> str:
    """Return the current state string, thread-safe.

    Returns:
        One of "idle", "trash_active", "trash_done".
    """
    with _state_lock:
        return _state


def get_status() -> dict:
    """Return the state plus when trash was last confirmed, as the http api serves it.

    Returns:
        {"state": str, "confirmed_at_ms": int | None}
    """
    with _state_lock:
        return {"state": _state, "confirmed_at_ms": _confirmed_at_ms}


def set_state(new_state: str) -> None:
    """Set the current state, thread-safe.

    Args:
        new_state: One of "idle", "trash_active", "trash_done".
    """
    global _state
    with _state_lock:
        _state = new_state
    logger.info("State -> %s", new_state)


# ---- persistence ----

def _current_iso_week() -> str:
    """Return the ISO year-week string for today, e.g. '2026-W19'.

    Returns:
        str: ISO year-week.
    """
    iso = date.today().isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def _load_confirmed_week() -> str | None:
    """Load the ISO week when trash was last confirmed from disk.

    Returns:
        ISO week string, or None if no state file exists yet.
    """
    try:
        return json.loads(STATE_FILE.read_text()).get("confirmed_week")
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def _save_confirmed_week() -> None:
    """Persist the current week as confirmed so restarts don't re-trigger.

    Side effects:
        Writes trash_state.json next to this script.
    """
    try:
        STATE_FILE.write_text(json.dumps({"confirmed_week": _current_iso_week()}))
    except OSError as exc:
        logger.error("Failed to save state: %s — confirmation wont survive a restart", exc)


def _already_confirmed_this_week() -> bool:
    """True if trash was already confirmed during the current ISO week.

    Returns:
        bool
    """
    return _load_confirmed_week() == _current_iso_week()


# ---- audio ----

def _play_one(filename: str) -> None:
    """Play a single WAV file, blocking until done.

    Stores the subprocess handle so stop_playback() can kill it mid-clip.

    Args:
        filename: Clip filename within AUDIO_DIR (not a full path).

    Side effects:
        Blocks. Updates _current_proc.
    """
    global _current_proc
    path = AUDIO_DIR / filename
    if not path.exists():
        logger.error("Clip not found: %s — copy it to the audio/ directory", path)
        return

    logger.info("Playing %s", filename)
    with _proc_lock:
        _current_proc = subprocess.Popen(["aplay", "-D", ALSA_DEVICE, str(path)])

    returncode = _current_proc.wait()

    with _proc_lock:
        _current_proc = None

    # -15 = SIGTERM (killed intentionally by stop_playback), not an error
    if returncode not in (0, -15):
        logger.error("aplay exited %d for %s", returncode, filename)


def stop_playback() -> None:
    """Kill any currently playing audio clip immediately.

    Side effects:
        Terminates _current_proc if it's still running.
    """
    with _proc_lock:
        if _current_proc and _current_proc.poll() is None:
            _current_proc.terminate()


def play_sequence(*filenames: str, only_while: str | None = None) -> None:
    """Play a list of clips in order.

    Checks state between clips and aborts early if it changes away from
    only_while. This prevents stale reminders from finishing after the
    button has been pressed.

    Args:
        *filenames: Clip filenames to play in order.
        only_while: Abort if state != this value between clips.

    Side effects:
        Blocks for the full duration of all clips.
    """
    for filename in filenames:
        if only_while and get_state() != only_while:
            logger.debug("State changed, aborting sequence")
            return
        _play_one(filename)


# ---- schedule logic ----

def _in_trash_window() -> bool:
    """True if it's currently within the Thursday reminder window.

    Returns:
        bool
    """
    now = datetime.now()
    return (
        now.weekday() == TRASH_WEEKDAY
        and TRASH_START_HOUR <= now.hour < TRASH_END_HOUR
    )


def _start_trash_mode() -> None:
    """Enter trash_active and play the opening siren + announcement.

    Side effects:
        Sets state to "trash_active". Updates _last_reminder_time. Plays audio.
    """
    global _last_reminder_time
    set_state("trash_active")
    _last_reminder_time = time.monotonic()
    play_sequence(CLIP_SIREN, CLIP_TAKE_OUT_TRASH, only_while="trash_active")


def _play_followup() -> None:
    """Play a randomized follow-up reminder sequence.

    Always: hey_guys + (take_out_trash OR tell_the_bird)
    Sometimes: siren prepended, based on SIREN_PROBABILITY

    Side effects:
        Updates _last_reminder_time. Plays audio.
    """
    global _last_reminder_time
    _last_reminder_time = time.monotonic()

    clips = []
    if random.random() < SIREN_PROBABILITY:
        clips.append(CLIP_SIREN)
    clips.append(CLIP_HEY_GUYS)
    clips.append(random.choice([CLIP_TAKE_OUT_TRASH, CLIP_TELL_THE_BIRD]))

    play_sequence(*clips, only_while="trash_active")


def scheduler_loop() -> None:
    """Background thread that manages trash reminder timing.

    Checks the clock every SCHEDULE_CHECK_INTERVAL_S seconds and drives
    state transitions. Fires reminders on schedule.

    Side effects:
        Modifies global _state and _last_reminder_time. Triggers audio.
    """
    was_in_window = False

    while True:
        time.sleep(SCHEDULE_CHECK_INTERVAL_S)

        in_window = _in_trash_window()
        state = get_state()

        if in_window and not was_in_window:
            # just entered the trash window
            if _already_confirmed_this_week():
                logger.info("Trash already confirmed this week, skipping")
            elif state == "idle":
                _start_trash_mode()

        elif not in_window and state in ("trash_active", "trash_done"):
            # trash window closed — reset so next week fires normally
            if state == "trash_active":
                logger.info("Trash window closed without confirmation, resetting")
            else:
                logger.info("Trash window closed, resetting for next week")
            set_state("idle")

        elif in_window and state == "trash_active":
            elapsed_s = time.monotonic() - _last_reminder_time
            if elapsed_s >= REMINDER_INTERVAL_S:
                _play_followup()

        was_in_window = in_window


# ---- confirmation ----

def claim_confirmation() -> bool:
    """Mark the trash as taken out, if it's trash time and nobody beat us to it.

    Checked and set under one lock, so the button and the kiosk confirming at the
    same moment only thank once.

    Returns:
        True if this call confirmed it, False if it wasn't trash_active.

    Side effects:
        Sets state to "trash_done" and _confirmed_at_ms. Persists the week to disk.
    """
    global _state, _confirmed_at_ms
    with _state_lock:
        if _state != "trash_active":
            return False
        # trash_done blocks the scheduler while the thanks sequence plays
        _state = "trash_done"
        _confirmed_at_ms = int(time.time() * 1000)
    logger.info("State -> trash_done (confirmed)")
    _save_confirmed_week()
    return True


def play_thanks() -> None:
    """Cut off any reminder mid-clip and play the thanks sequence.

    Side effects:
        Blocks for the clips. Sets state back to "idle" afterwards.
    """
    stop_playback()
    time.sleep(THANKS_GAP_S)
    play_sequence(CLIP_THANKS, CLIP_I_LOVE_YOU)
    # back to idle so the button works normally for the rest of the night
    set_state("idle")


# ---- button ----

def on_button_press() -> None:
    """Handle a button press event.

    During trash time: confirm trash is done and play thanks.
    Any other time: play an alternating idle greeting.

    Side effects:
        May change state to "trash_done". Persists to disk. Plays audio.
    """
    global _idle_clip_index

    if claim_confirmation():
        play_thanks()
        return

    # idle greeting — alternates between hey_guys and i_love_you
    clip = [CLIP_HEY_GUYS, CLIP_I_LOVE_YOU][_idle_clip_index % 2]
    _idle_clip_index += 1
    play_sequence(clip)


# ---- http api ----

class ApiHandler(BaseHTTPRequestHandler):
    """Serves the state to displaytop and takes its confirmations (see module docstring)."""

    def _send_json(self, status: int, body: dict) -> None:
        """Write a json response.

        Args:
            status: HTTP status code.
            body: Response body.
        """
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:
        """Return the current status."""
        if self.path != API_STATUS_PATH:
            self._send_json(404, {"error": f"unknown route {self.path}, try GET {API_STATUS_PATH}"})
            return
        self._send_json(200, get_status())

    def do_POST(self) -> None:
        """Confirm the trash, like the button. Answers right away; the thanks plays after."""
        if self.path != API_CONFIRM_PATH:
            self._send_json(404, {"error": f"unknown route {self.path}, try POST {API_CONFIRM_PATH}"})
            return
        if not claim_confirmation():
            status = get_status()
            self._send_json(409, {"error": f"not trash time (state is {status['state']}), nothing to confirm", **status})
            return
        logger.info("Trash confirmed from %s", self.client_address[0])
        threading.Thread(target=play_thanks, daemon=True, name="thanks").start()
        self._send_json(200, get_status())

    def log_message(self, format: str, *args) -> None:
        """Silence per-request access logs; displaytop polls every few seconds."""


def start_api() -> None:
    """Serve the http api on a background thread.

    Side effects:
        Binds API_LISTEN_HOST:API_PORT.
    """
    server = ThreadingHTTPServer((API_LISTEN_HOST, API_PORT), ApiHandler)
    threading.Thread(target=server.serve_forever, daemon=True, name="api").start()


# ---- main ----

def main() -> None:
    """Start the trash reminder service.

    Restores state from disk (so a restart mid-week doesnt re-trigger),
    sets up the button listener, background scheduler and http api, then
    blocks forever.
    """
    logger.info("Starting trash reminder service")

    if _already_confirmed_this_week():
        set_state("trash_done")
        logger.info("Trash already confirmed this week, starting in trash_done state")

    factory = LGPIOFactory()
    button = Button(BUTTON_PIN, pull_up=True, bounce_time=BUTTON_DEBOUNCE_S, pin_factory=factory)
    button.when_pressed = on_button_press

    scheduler = threading.Thread(target=scheduler_loop, daemon=True, name="scheduler")
    scheduler.start()

    start_api()

    logger.info(
        "Ready. Button on GPIO %d. Trash window: Thu %d:00-%d:00. API on port %d.",
        BUTTON_PIN, TRASH_START_HOUR, TRASH_END_HOUR, API_PORT,
    )
    pause()


if __name__ == "__main__":
    main()
