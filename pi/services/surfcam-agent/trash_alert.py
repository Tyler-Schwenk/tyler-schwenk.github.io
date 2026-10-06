"""trash night takeover for the display kiosk: watches fart-pi's trash reminder.

fart-pi's trash-reminder service (pi/services/trash-reminder) knows when it's trash time
and plays matt's reminders through its speakers. this polls its lan api and tells the
display pages, which drop whatever they're showing for the trash screens while it's
trash time, then show the happy cormorant for a bit once someone confirms:

    GET  /trash?after=N   {"version", "alert", "thanks_until_ms"}, long-polled by the pages
    POST /trash/done      the trash is out: fart-pi plays its thanks, the pages show the
                          cormorant. from a page's keydown, or any control key (below)

while the takeover is up, surfcam_agent.py hands the control keys from xbindkeys to
confirm() instead of the key log, so "press any key" works for the grabbed keys too and
the presses don't also change what the display shows underneath.

fart-pi is the source of truth: confirming with its own button ends the alert and starts
the thanks screen just the same, since the thanks timing comes from its confirmed_at_ms.
"""

import json
import logging
import threading
import time
import urllib.error
import urllib.request
from typing import Optional

from kiosk_control import LONG_POLL_TIMEOUT_S, now_ms

# fart-pi's trash-reminder api (lan only, see pi/docs/services/trash-reminder.md)
TRASH_API_URL = "http://192.168.1.116:8770"
TRASH_STATUS_PATH = "/status"
TRASH_CONFIRM_PATH = "/confirm"
TRASH_ACTIVE_STATE = "trash_active"

# how often to ask fart-pi whether it's trash time. the alert can come up this late
TRASH_POLL_INTERVAL_S = 5
TRASH_REQUEST_TIMEOUT_S = 3

# with fart-pi unreachable this long, the alert comes down rather than leave the screens
# stuck on it all night
TRASH_UNREACHABLE_GIVE_UP_S = 60

# how long the pages show the happy cormorant after the trash is confirmed
THANKS_DISPLAY_MS = 10_000

log = logging.getLogger("trash-alert")


class TrashApiError(Exception):
    """raised when fart-pi's trash reminder can't be reached or answers with nonsense."""


def trash_api_request(method: str, path: str) -> tuple[int, dict]:
    """sends one request to fart-pi's trash reminder.

    a 409 from /confirm still carries the status, so http errors with a json body are
    returned rather than raised.

    args:
        method: http method.
        path: path under TRASH_API_URL.

    returns:
        (http status, json body)

    raises:
        TrashApiError: fart-pi didn't answer, or didn't answer with json.
    """
    request = urllib.request.Request(f"{TRASH_API_URL}{path}", data=b"" if method == "POST" else None, method=method)
    try:
        with urllib.request.urlopen(request, timeout=TRASH_REQUEST_TIMEOUT_S) as response:
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as err:
        try:
            return err.code, json.loads(err.read())
        except json.JSONDecodeError as decode_err:
            raise TrashApiError(f"{method} {path} got {err.code} without a json body") from decode_err
    except (urllib.error.URLError, OSError, json.JSONDecodeError) as err:
        raise TrashApiError(
            f"{method} {TRASH_API_URL}{path} failed: {err}. is fart-pi up and trash-reminder running?"
        ) from err


class TrashWatcher:
    """fart-pi's trash status as the pages see it, with a version that bumps on every change.

    thread-safe: the poll thread, the key handler and the pages' long-polls all touch it.
    """

    def __init__(self) -> None:
        """starts with no alert, until the first poll says otherwise."""
        self._changed = threading.Condition()
        self._version = 0
        self._alert = False
        self._confirmed_at_ms: Optional[int] = None
        # bumps on every confirm, so a poll that set off before one can't undo it on arrival
        self._confirms = 0

    def _apply(self, status: dict, confirms_seen: Optional[int] = None) -> None:
        """takes in a status from fart-pi, waking the pages if anything changed.

        args:
            status: {"state", "confirmed_at_ms"} as fart-pi serves it.
            confirms_seen: the confirm count when the request set off; a stale poll is dropped.
        """
        alert = status.get("state") == TRASH_ACTIVE_STATE
        confirmed_at_ms = status.get("confirmed_at_ms")
        with self._changed:
            if confirms_seen is not None and confirms_seen != self._confirms:
                return
            if alert == self._alert and confirmed_at_ms == self._confirmed_at_ms:
                return
            self._alert = alert
            self._confirmed_at_ms = confirmed_at_ms
            self._version += 1
            self._changed.notify_all()
        log.info("trash: alert %s, last confirmed at %s", "on" if alert else "off", confirmed_at_ms)

    def _drop_alert(self) -> None:
        """takes the alert down, for when fart-pi has stopped answering."""
        with self._changed:
            if not self._alert:
                return
            self._alert = False
            self._version += 1
            self._changed.notify_all()
        log.warning("trash: alert dropped, fart-pi unreachable for %d s", TRASH_UNREACHABLE_GIVE_UP_S)

    def _thanks_until_ms(self) -> Optional[int]:
        """when the thanks screen ends, or None when it isn't up. call with the lock held."""
        if self._confirmed_at_ms is None:
            return None
        until_ms = self._confirmed_at_ms + THANKS_DISPLAY_MS
        return until_ms if until_ms > now_ms() else None

    def _snapshot(self) -> dict:
        """what the pages get. call with the lock held."""
        return {"version": self._version, "alert": self._alert, "thanks_until_ms": self._thanks_until_ms()}

    def is_taking_over(self) -> bool:
        """whether the pages are showing the alert or the thanks screen right now."""
        with self._changed:
            return self._alert or self._thanks_until_ms() is not None

    def wait_for_change(self, after_version: int, timeout_s: float = LONG_POLL_TIMEOUT_S) -> dict:
        """waits until the version differs from after_version, or the timeout passes.

        "differs" for the same reason as ControlLog.wait_for_change: an agent restart
        starts the version over.

        args:
            after_version: the version the caller already has (-1 for none).
            timeout_s: how long to wait for a change.

        returns:
            {"version", "alert", "thanks_until_ms"}, current either way.
        """
        with self._changed:
            self._changed.wait_for(lambda: self._version != after_version, timeout_s)
            return self._snapshot()

    def confirm(self) -> tuple[int, dict]:
        """tells fart-pi the trash is out, which plays its thanks and ends the alert.

        returns:
            (http status, body) for the page: 200 and the new snapshot when it worked, 409
            when it wasn't trash time, 502 when fart-pi couldn't be reached.
        """
        try:
            status_code, body = trash_api_request("POST", TRASH_CONFIRM_PATH)
        except TrashApiError as err:
            log.error("confirming the trash: %s", err)
            return 502, {"error": str(err)}
        with self._changed:
            self._confirms += 1
        self._apply(body)
        if status_code != 200:
            log.warning("confirming the trash: fart-pi said %d: %s", status_code, body.get("error"))
            return status_code, {"error": body.get("error", f"fart-pi returned {status_code}")}
        log.info("trash confirmed")
        with self._changed:
            return 200, self._snapshot()

    def poll_forever(self) -> None:
        """asks fart-pi for its status every TRASH_POLL_INTERVAL_S, forever.

        only the first failure in a row and the recovery are logged, so a long outage
        doesn't fill the log. while fart-pi's unreachable the last status stands, for up
        to TRASH_UNREACHABLE_GIVE_UP_S.
        """
        failing_since: Optional[float] = None
        while True:
            with self._changed:
                confirms_seen = self._confirms
            try:
                _, status = trash_api_request("GET", TRASH_STATUS_PATH)
                self._apply(status, confirms_seen)
                if failing_since is not None:
                    log.info("trash: fart-pi back up")
                failing_since = None
            except TrashApiError as err:
                if failing_since is None:
                    log.warning("trash: %s. retrying every %d s", err, TRASH_POLL_INTERVAL_S)
                    failing_since = time.monotonic()
                if time.monotonic() - failing_since >= TRASH_UNREACHABLE_GIVE_UP_S:
                    self._drop_alert()
            time.sleep(TRASH_POLL_INTERVAL_S)


def start_trash_watcher(watcher: TrashWatcher) -> None:
    """starts polling fart-pi on a background thread.

    args:
        watcher: the agent's trash watcher.
    """
    threading.Thread(target=watcher.poll_forever, name="trash-poll", daemon=True).start()
    log.info("watching for trash night via %s", TRASH_API_URL)
