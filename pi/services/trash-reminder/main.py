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


# ---- shared state ----

# current mode: "idle" | "trash_active" | "trash_done"
_state = "idle"
_state_lock = threading.Lock()

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

        elif not in_window and state == "trash_active":
            # 11 PM hit and nobody confirmed — reset for next week
            logger.info("Trash window closed without confirmation, resetting")
            set_state("idle")

        elif in_window and state == "trash_active":
            elapsed_s = time.monotonic() - _last_reminder_time
            if elapsed_s >= REMINDER_INTERVAL_S:
                _play_followup()

        was_in_window = in_window


# ---- button ----

def on_button_press() -> None:
    """Handle a button press event.

    During trash time: stop current audio, confirm trash is done, play thanks.
    Any other time: play an alternating idle greeting.

    Side effects:
        May change state to "trash_done". Persists to disk. Plays audio.
    """
    global _idle_clip_index
    state = get_state()

    if state == "trash_active":
        # set state first so the scheduler thread wont fire a new reminder
        set_state("trash_done")
        _save_confirmed_week()
        stop_playback()
        time.sleep(0.3)  # brief gap after kill before starting thanks
        play_sequence(CLIP_THANKS, CLIP_I_LOVE_YOU)
        return

    # idle greeting — alternates between hey_guys and i_love_you
    clip = [CLIP_HEY_GUYS, CLIP_I_LOVE_YOU][_idle_clip_index % 2]
    _idle_clip_index += 1
    play_sequence(clip)


# ---- main ----

def main() -> None:
    """Start the trash reminder service.

    Restores state from disk (so a restart mid-week doesnt re-trigger),
    sets up the button listener and background scheduler, then blocks forever.
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

    logger.info("Ready. Button on GPIO %d. Trash window: Thu %d:00-%d:00.", BUTTON_PIN, TRASH_START_HOUR, TRASH_END_HOUR)
    pause()


if __name__ == "__main__":
    main()
