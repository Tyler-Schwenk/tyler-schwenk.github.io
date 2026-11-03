"""house ghost: a scary voice greets roommates by name when their phone joins the wifi.

runs on fart-pi as a systemd service. it arp-scans the lan, and when a roommate's device
shows up after being gone a while, it plays one of their clips on the big speakers.
devices that aren't in roommates.json are ignored, and nothing's written to disk, so it
doesn't keep a history of who was home.

see pi/docs/services/house-ghost.md.

usage:
    python main.py          run the service
    python main.py --scan   list what's on the lan right now, then exit
"""

import argparse
import json
import logging
import random
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from ghost_common import AUDIO_DIR, Roommate, load_roommates

# shared with the other services on fart-pi: it's a plain folder in the repo, not a package
sys.path.insert(0, str(Path(__file__).parent.parent / "speaker-agent"))

from speaker_client import SpeakerAgentError, SpeakersBusyError, play_clip

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---- network ----

# phones on wifi are still visible from eth0, the router bridges them
SCAN_INTERFACE = "eth0"
SCAN_INTERVAL_S = 15
# sleeping phones miss arp requests sometimes, so ask each host a few times
SCAN_RETRIES = 3
SCAN_TIMEOUT_S = 30
SCAN_LINE_PATTERN = re.compile(r"^(\d+\.\d+\.\d+\.\d+)[ \t]+([0-9a-f:]{17})[ \t]*$", re.MULTILINE)


# ---- when to greet ----

# sleeping phones go quiet for a while, so this has to be well past that or the ghost
# greets someone who never left
AWAY_BEFORE_GREET_S = 45 * 60
# wifi dropouts and quick errands shouldn't get a second greeting
GREET_COOLDOWN_S = 4 * 60 * 60
# a greeting stuck behind busy speakers gets dropped after this, it'd be weird that late
PENDING_MAX_AGE_S = 5 * 60

# no greetings from QUIET_START_HOUR until QUIET_END_HOUR, people are asleep
QUIET_START_HOUR = 23
QUIET_END_HOUR = 8


# ---- audio ----

# who the speaker agent thinks this is, so we can only stop our own clips
SPEAKER_OWNER = "house-ghost"

# the trash reminder shares these speakers and takes priority over us
TRASH_STATUS_URL = "http://127.0.0.1:8770/status"
TRASH_STATUS_TIMEOUT_S = 2
TRASH_IDLE_STATE = "idle"


@dataclass
class Tracker:
    """what the service remembers about one roommate. memory only.

    Attributes:
        roommate: who this is.
        last_seen_s: monotonic time their device last answered.
        last_greeted_s: monotonic time of the last greeting, None if there hasn't been one.
        pending_since_s: monotonic time a greeting got queued, None if nothing's queued.
    """

    roommate: Roommate
    last_seen_s: float
    last_greeted_s: float | None = None
    pending_since_s: float | None = None


def scan_lan() -> list[tuple[str, str]]:
    """ask everything on the lan to identify itself.

    Returns:
        (ip, lowercase mac) for each host that replied.

    Raises:
        RuntimeError: if arp-scan can't run or fails.
    """
    command = [
        "arp-scan", "--localnet", f"--interface={SCAN_INTERFACE}",
        f"--retry={SCAN_RETRIES}", "--quiet", "--plain", "--ignoredups",
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=SCAN_TIMEOUT_S)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise RuntimeError(f"arp-scan didn't finish ({exc}): is it installed? try `sudo apt install arp-scan`") from exc
    if result.returncode != 0:
        raise RuntimeError(
            f"arp-scan exited {result.returncode}: {result.stderr.strip()}. "
            "the service needs CAP_NET_RAW, check house-ghost.service"
        )
    return SCAN_LINE_PATTERN.findall(result.stdout.lower())


def in_quiet_hours(hour: int) -> bool:
    """check if it's too late or too early to be yelling at people.

    Args:
        hour: local hour, 0-23.

    Returns:
        True during quiet hours.
    """
    return hour >= QUIET_START_HOUR or hour < QUIET_END_HOUR


def note_sighting(tracker: Tracker, now_s: float) -> None:
    """record that a roommate's device answered, and queue a greeting if they just got home.

    Args:
        tracker: the roommate's tracker.
        now_s: current monotonic time.

    Side effects:
        updates last_seen_s, and pending_since_s on an arrival.
    """
    away_s = now_s - tracker.last_seen_s
    tracker.last_seen_s = now_s
    if away_s < AWAY_BEFORE_GREET_S:
        return
    cooling_down = (
        tracker.last_greeted_s is not None
        and now_s - tracker.last_greeted_s < GREET_COOLDOWN_S
    )
    if cooling_down:
        logger.info("%s is back after %d min, already greeted recently", tracker.roommate.name, away_s // 60)
        return
    logger.info("%s is back after %d min", tracker.roommate.name, away_s // 60)
    tracker.pending_since_s = now_s


def trash_reminder_is_idle() -> bool:
    """check whether the trash reminder's leaving the speakers alone.

    Returns:
        True if it's idle or not running at all, False if it's mid-reminder.
    """
    try:
        with urllib.request.urlopen(TRASH_STATUS_URL, timeout=TRASH_STATUS_TIMEOUT_S) as response:
            return json.load(response).get("state") == TRASH_IDLE_STATE
    except (urllib.error.URLError, OSError, ValueError) as exc:
        logger.warning("couldn't get trash reminder status (%s), assuming it's idle", exc)
        return True


def pick_clip(roommate: Roommate) -> Path | None:
    """pick a random clip for a roommate.

    Args:
        roommate: who's being greeted.

    Returns:
        a clip path, or None if they don't have any rendered yet.
    """
    clips = sorted(AUDIO_DIR.glob(f"{roommate.slug}_*.wav"))
    return random.choice(clips) if clips else None


def play_greeting(clip: Path) -> bool:
    """play a clip through the speakers, blocking until it's done.

    Args:
        clip: wav file to play.

    Returns:
        True if it played. False means the speakers were busy or the speaker agent failed.
    """
    logger.info("playing %s", clip.name)
    try:
        play_clip(clip, SPEAKER_OWNER)
    except (SpeakersBusyError, SpeakerAgentError) as exc:
        logger.warning("couldn't play %s: %s", clip.name, exc)
        return False
    return True


def try_greet(tracker: Tracker, now_s: float, hour: int) -> None:
    """play a roommate's queued greeting if it's ok to right now.

    a greeting that can't play stays queued for the next sweep, until it gets too old.

    Args:
        tracker: the roommate's tracker, with a greeting queued.
        now_s: current monotonic time.
        hour: local hour, 0-23.

    Side effects:
        plays audio, updates pending_since_s and last_greeted_s.
    """
    name = tracker.roommate.name
    if in_quiet_hours(hour):
        logger.info("quiet hours, not greeting %s", name)
        tracker.pending_since_s = None
        return
    if now_s - tracker.pending_since_s > PENDING_MAX_AGE_S:
        logger.warning("dropping %s's greeting, speakers stayed busy too long", name)
        tracker.pending_since_s = None
        return
    if not trash_reminder_is_idle():
        return

    clip = pick_clip(tracker.roommate)
    if clip is None:
        logger.error("no clips for %s in %s: run render_clips.py", name, AUDIO_DIR)
        tracker.pending_since_s = None
        return
    if play_greeting(clip):
        tracker.pending_since_s = None
        tracker.last_greeted_s = time.monotonic()


def sweep(trackers: list[Tracker]) -> None:
    """do one scan and handle whatever it found.

    Args:
        trackers: everyone being tracked.

    Side effects:
        updates trackers, may play audio.
    """
    try:
        hosts = scan_lan()
    except RuntimeError as exc:
        logger.error("scan failed: %s", exc)
        return
    # the router always answers, so an empty scan means our network's down, not that
    # everyone left. counting it would greet the whole house when the network came back
    if not hosts:
        logger.warning("nobody answered on %s, skipping this sweep", SCAN_INTERFACE)
        return

    seen_macs = {mac for _, mac in hosts}
    now_s = time.monotonic()
    for tracker in trackers:
        if tracker.roommate.macs & seen_macs:
            note_sighting(tracker, now_s)
    for tracker in trackers:
        if tracker.pending_since_s is not None:
            try_greet(tracker, time.monotonic(), datetime.now().hour)


def lookup_hostname(ip: str) -> str:
    """get a device's hostname from the router's dns.

    Args:
        ip: the device's address.

    Returns:
        its hostname, or "?" if the router doesn't know it.
    """
    try:
        return socket.gethostbyaddr(ip)[0]
    except OSError:
        return "?"


def print_scan() -> None:
    """print the lan's devices, for finding roommates' macs.

    Side effects:
        writes to stdout.
    """
    for ip, mac in sorted(scan_lan(), key=lambda host: int(host[0].rsplit(".", 1)[1])):
        print(f"{ip:<16} {mac}  {lookup_hostname(ip)}")


def run() -> None:
    """run the service forever.

    everyone starts out as just seen, so a restart can't greet the whole house.
    """
    roommates = load_roommates()
    start_s = time.monotonic()
    trackers = [Tracker(roommate=roommate, last_seen_s=start_s) for roommate in roommates]
    logger.info("watching for %s", ", ".join(roommate.name for roommate in roommates))
    while True:
        sweep(trackers)
        time.sleep(SCAN_INTERVAL_S)


def main() -> None:
    """parse args and either scan once or run the service."""
    parser = argparse.ArgumentParser(description="greet roommates when their phones join the wifi.")
    parser.add_argument("--scan", action="store_true", help="list devices on the lan and exit")
    if parser.parse_args().scan:
        print_scan()
        return
    run()


if __name__ == "__main__":
    main()
