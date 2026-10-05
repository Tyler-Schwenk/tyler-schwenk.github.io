"""remote control for the display kiosk: relays the admin page's buttons to the key log.

the admin page (tyler-schwenk.com/admin, display tab) can't reach this agent -- it only
listens on the laptop's loopback -- so the website backend sits in between (see
pi/services/website-backend/app/display_control.py). two threads, both outbound only, so
nothing on the laptop has to be reachable from outside:

- pull: long-polls the backend for remote presses and adds them to the key log, exactly
  as if they'd been typed on the kiosk (the bpm calibration nudges go to the bpm agent
  instead, like the - and = keys do)
- push: sends the whole key log up whenever it changes (and every long-poll timeout as a
  heartbeat), so the admin page can show what's on screen and whether the kiosk is up

both need the shared secret in ~/surfcam-agent/kiosk-token (the backend's KIOSK_TOKEN).
without it remote control stays off and the keyboard works as before.
"""

import json
import logging
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Callable, Optional

from kiosk_control import CONTROL_KEYS, LONG_POLL_TIMEOUT_S, ControlLog

REMOTE_API_URL = "https://api.tyler-schwenk.com/display-control"
TOKEN_PATH = Path(__file__).resolve().parent / "kiosk-token"
TOKEN_HEADER = "X-Kiosk-Token"

# the bpm calibration nudges: remote key -> direction for the bpm agent (same as - and =)
BPM_OFFSET_URL = "http://127.0.0.1:8766/offset"
BPM_OFFSET_KEYS = {"beat-earlier": "earlier", "beat-later": "later"}
LOCAL_REQUEST_TIMEOUT_S = 2

# the backend holds a long-poll for up to LONG_POLL_TIMEOUT_S; give it room on top of that
REMOTE_REQUEST_TIMEOUT_S = LONG_POLL_TIMEOUT_S + 15

# after a failed request (backend restarting, wifi down) wait this long before trying again
RETRY_DELAY_S = 5

log = logging.getLogger("remote-control")


class RemoteControlError(Exception):
    """raised when the backend can't be reached or rejects a request."""


def read_token() -> Optional[str]:
    """the shared secret from TOKEN_PATH, or None if it isn't set up."""
    try:
        token = TOKEN_PATH.read_text().strip()
    except OSError:
        return None
    return token or None


def api_request(method: str, path: str, token: str, body: Optional[dict] = None) -> Optional[dict]:
    """sends one request to the backend's display-control api.

    args:
        method: http method.
        path: path under REMOTE_API_URL, with any query string.
        token: the kiosk token.
        body: json body, if any.

    returns:
        the json response, or None for an empty one.

    raises:
        RemoteControlError: the request failed, with the backend's reason when it gave one.
    """
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(f"{REMOTE_API_URL}{path}", data=data, method=method)
    request.add_header(TOKEN_HEADER, token)
    if data is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=REMOTE_REQUEST_TIMEOUT_S) as response:
            payload = response.read()
    except urllib.error.HTTPError as err:
        detail = err.read().decode(errors="replace")
        raise RemoteControlError(f"{method} {path} got {err.code}: {detail}") from err
    except (urllib.error.URLError, OSError) as err:
        raise RemoteControlError(f"{method} {path} failed: {err}") from err
    return json.loads(payload) if payload else None


def nudge_bpm_offset(direction: str) -> None:
    """moves the bpm agent's beat earlier or later, like the - and = keys.

    args:
        direction: "earlier" or "later".
    """
    request = urllib.request.Request(f"{BPM_OFFSET_URL}/{direction}", data=b"", method="POST")
    try:
        urllib.request.urlopen(request, timeout=LOCAL_REQUEST_TIMEOUT_S).close()
    except (urllib.error.URLError, OSError) as err:
        log.warning("remote beat %s: bpm agent didn't take it (%s); is it running?", direction, err)


def run_command(control_log: ControlLog, keys: list[str]) -> None:
    """applies one remote press: log keys go in as one change, bpm nudges to the bpm agent.

    args:
        control_log: the agent's key log.
        keys: the press's keys, in order.
    """
    log_keys = [key for key in keys if key in CONTROL_KEYS]
    unknown = [key for key in keys if key not in CONTROL_KEYS and key not in BPM_OFFSET_KEYS]
    if unknown:
        log.warning("remote press with keys this agent doesn't know: %s (site and agent out of sync?)", unknown)
    if log_keys:
        control_log.add(log_keys)
        log.info("remote keys %s", " ".join(log_keys))
    for key in keys:
        if key in BPM_OFFSET_KEYS:
            nudge_bpm_offset(BPM_OFFSET_KEYS[key])


def keep_trying(name: str, attempt: Callable[[], None]) -> None:
    """runs attempt forever, waiting RETRY_DELAY_S after each failure.

    only the first failure in a row and the recovery are logged, so a long outage
    doesn't fill the log.

    args:
        name: what's being done, for the log.
        attempt: one round of the loop; raises RemoteControlError on failure.
    """
    failing = False
    while True:
        try:
            attempt()
        except RemoteControlError as err:
            if not failing:
                log.warning("%s: %s. retrying every %d s", name, err, RETRY_DELAY_S)
            failing = True
            time.sleep(RETRY_DELAY_S)
            continue
        if failing:
            log.info("%s: back up", name)
        failing = False


def pull_commands(control_log: ControlLog, token: str) -> None:
    """long-polls the backend for remote presses and runs them, forever."""
    cursor = -1

    def attempt() -> None:
        nonlocal cursor
        batch = api_request("GET", f"/kiosk/commands?after={cursor}", token)
        cursor = batch["cursor"]
        for command in batch["commands"]:
            run_command(control_log, command["keys"])

    keep_trying("pulling remote presses", attempt)


def push_log(control_log: ControlLog, token: str) -> None:
    """sends the key log to the backend on every change (and every long-poll timeout), forever."""
    version = -1

    def attempt() -> None:
        nonlocal version
        # after a failed push the version is unchanged, so this answers at once and retries it
        snapshot = control_log.wait_for_change(version)
        api_request("PUT", "/kiosk/log", token, snapshot)
        version = snapshot["version"]

    keep_trying("pushing the key log", attempt)


def start_remote_control(control_log: ControlLog) -> None:
    """starts the pull and push threads, if the kiosk token is set up.

    args:
        control_log: the agent's key log.
    """
    token = read_token()
    if not token:
        log.warning("no kiosk token at %s, remote control is off (see pi/docs/services/display-kiosk.md)", TOKEN_PATH)
        return
    threading.Thread(target=pull_commands, args=(control_log, token), name="remote-pull", daemon=True).start()
    threading.Thread(target=push_log, args=(control_log, token), name="remote-push", daemon=True).start()
    log.info("remote control on, via %s", REMOTE_API_URL)
