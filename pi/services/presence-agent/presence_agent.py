"""presence agent: works out who's home from whose phone is on the wifi.

runs on fart-pi as a systemd service. every 15 s it arp-scans the lan, matches the
replies against the macs in people.json, and pushes when it last saw each person to the
website backend, which shows it on the admin page. only names and times leave this
machine, never macs, and nothing's written to disk.

see pi/docs/services/presence-agent.md.

usage:
    python presence_agent.py          run the agent
    python presence_agent.py --scan   list what's on the lan right now, then exit

stdlib only, plus the arp-scan package.
"""

import argparse
import json
import logging
import re
import socket
import subprocess
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("presence-agent")


# ---- config ----

SERVICE_DIR = Path(__file__).parent
PEOPLE_FILE = SERVICE_DIR / "people.json"
TOKEN_PATH = Path("/etc/presence-agent/token")

# the backend's on this same pi, so this never touches the internet
API_URL = "http://127.0.0.1:8000/presence/agent"
REQUEST_TIMEOUT_S = 10


# ---- scanning ----

# phones on wifi are still visible from eth0, the router bridges them
SCAN_INTERFACE = "eth0"
SCAN_INTERVAL_S = 15
# sleeping phones miss arp requests sometimes, so ask each host a few times
SCAN_RETRIES = 3
SCAN_TIMEOUT_S = 30
SCAN_LINE_PATTERN = re.compile(r"^(\d+\.\d+\.\d+\.\d+)[ \t]+([0-9a-f:]{17})[ \t]*$", re.MULTILINE)
MAC_PATTERN = re.compile(r"^([0-9a-f]{2}:){5}[0-9a-f]{2}$")

MS_PER_S = 1000


@dataclass
class Person:
    """someone the agent watches for.

    Attributes:
        name: what the admin page calls them.
        macs: lowercase wifi macs of their devices.
        last_seen_ms: epoch ms one of their devices last answered, None if not since startup.
    """

    name: str
    macs: frozenset[str]
    last_seen_ms: int | None = None


def load_people(path: Path = PEOPLE_FILE) -> list[Person]:
    """read and validate the people list.

    Args:
        path: json file, see people.example.json for the format.

    Returns:
        everyone in it, in file order.

    Raises:
        ValueError: if the file's missing, isn't valid json, or has a bad entry.
    """
    try:
        entries = json.loads(path.read_text())
    except FileNotFoundError as exc:
        raise ValueError(f"can't find {path}: copy people.example.json to people.json and fill it in") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"{path} isn't valid json ({exc}): fix it and restart") from exc
    return [parse_person(entry, path) for entry in entries]


def parse_person(entry: dict, path: Path) -> Person:
    """turn one json entry into a Person.

    Args:
        entry: one object from the people list.
        path: the file it came from, for error messages.

    Returns:
        the parsed person.

    Raises:
        ValueError: if the name or macs are missing or malformed.
    """
    name = entry.get("name", "").strip()
    macs = [mac.strip().lower() for mac in entry.get("macs", [])]
    if not name or not macs:
        raise ValueError(f"bad entry in {path}: {entry} needs a name and at least one mac")
    for mac in macs:
        if not MAC_PATTERN.match(mac):
            raise ValueError(f"bad mac '{mac}' for {name} in {path}: use aa:bb:cc:dd:ee:ff")
    return Person(name=name, macs=frozenset(macs))


def read_token(path: Path = TOKEN_PATH) -> str:
    """read the shared secret the backend expects.

    Args:
        path: file holding PRESENCE_TOKEN from the backend's .env.

    Returns:
        the token.

    Raises:
        ValueError: if the file's missing or empty.
    """
    try:
        token = path.read_text().strip()
    except OSError as exc:
        raise ValueError(f"can't read {path} ({exc}): put PRESENCE_TOKEN from the backend's .env in it") from exc
    if not token:
        raise ValueError(f"{path} is empty: put PRESENCE_TOKEN from the backend's .env in it")
    return token


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
            "it needs CAP_NET_RAW, check presence-agent.service (or use sudo for --scan)"
        )
    return SCAN_LINE_PATTERN.findall(result.stdout.lower())


def note_sightings(people: list[Person], hosts: list[tuple[str, str]], now_ms: int) -> None:
    """mark everyone whose device answered as seen now.

    Args:
        people: everyone being watched.
        hosts: the scan's (ip, mac) replies.
        now_ms: current epoch ms.

    Side effects:
        updates last_seen_ms.
    """
    seen_macs = {mac for _, mac in hosts}
    for person in people:
        if person.macs & seen_macs:
            person.last_seen_ms = now_ms


def push_snapshot(people: list[Person], token: str) -> None:
    """send everyone's last-seen time to the backend.

    a failed push just gets logged, the next sweep sends a fresh one anyway.

    Args:
        people: everyone being watched.
        token: the backend's PRESENCE_TOKEN.
    """
    body = json.dumps({
        "people": [{"name": person.name, "last_seen_ms": person.last_seen_ms} for person in people],
    }).encode()
    request = urllib.request.Request(
        API_URL,
        data=body,
        method="PUT",
        headers={"Content-Type": "application/json", "X-Presence-Token": token},
    )
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_S):
            pass
    except urllib.error.HTTPError as exc:
        logger.error("backend refused the snapshot: HTTP %d %s", exc.code, exc.read().decode(errors="replace"))
    except (urllib.error.URLError, OSError) as exc:
        logger.error("can't reach the backend at %s (%s): is website-backend running?", API_URL, exc)


def sweep(people: list[Person], token: str) -> None:
    """do one scan and push the result.

    Args:
        people: everyone being watched.
        token: the backend's PRESENCE_TOKEN.

    Side effects:
        updates last_seen_ms, sends a request to the backend.
    """
    try:
        hosts = scan_lan()
    except RuntimeError as exc:
        logger.error("scan failed: %s", exc)
        hosts = []
    # the router always answers, so an empty scan means our network's down. nobody's
    # last-seen moves, and the push still goes out so the page knows the agent's alive
    if not hosts:
        logger.warning("nobody answered on %s, not updating anyone", SCAN_INTERFACE)
    note_sightings(people, hosts, int(time.time() * MS_PER_S))
    push_snapshot(people, token)


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
    """print the lan's devices, for finding someone's mac.

    Side effects:
        writes to stdout.
    """
    for ip, mac in sorted(scan_lan(), key=lambda host: int(host[0].rsplit(".", 1)[1])):
        print(f"{ip:<16} {mac}  {lookup_hostname(ip)}")


def run() -> None:
    """run the agent forever."""
    people = load_people()
    token = read_token()
    logger.info("watching for %s, pushing to %s", ", ".join(person.name for person in people), API_URL)
    while True:
        sweep(people, token)
        time.sleep(SCAN_INTERVAL_S)


def main() -> None:
    """parse args and either scan once or run the agent."""
    parser = argparse.ArgumentParser(description="work out who's home from the wifi.")
    parser.add_argument("--scan", action="store_true", help="list devices on the lan and exit")
    if parser.parse_args().scan:
        print_scan()
        return
    run()


if __name__ == "__main__":
    main()
