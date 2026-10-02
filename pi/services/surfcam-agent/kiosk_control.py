"""keyboard control for the display kiosk: a log of the key presses since the last reset.

xbindkeys on the kiosk grabs the control keys system-wide (so they work whichever window
has focus, mpv included) and posts each press to the agent, which appends it here. the
display pages long-poll the log and replay it through the same state machine
(website/app/display/kioskControl.ts), so both screens always agree on what's showing,
and a page that reloads just replays the log and lands in the same place.

the log is cleared by kiosk-run.sh when the overnight sleep starts (POST /control/reset),
so every morning starts on the standard rotation. an agent restart clears it too.
"""

import threading
import time

# key names the pages understand. xbindkeys maps the physical keys onto these
# (see setup-displaytop.sh): tab, esc, backspace, ] and [, the digit row, and b (the
# bpm visualizer)
CONTROL_KEYS = {"tab", "escape", "backspace", "next", "prev", "b", *map(str, range(1, 10))}

# a day of button mashing is nowhere near this; it only stops a stuck key growing the log forever
MAX_EVENTS = 1000

# how long a long-poll waits for a change before answering with the unchanged log, so
# the page's request never sits open long enough for anything in between to drop it
LONG_POLL_TIMEOUT_S = 25


def now_ms() -> int:
    """wall-clock time in epoch ms, the same clock the pages use for their rotation."""
    return int(time.time() * 1000)


class ControlLog:
    """the key presses since the last reset, with a version that bumps on every change.

    thread-safe: presses arrive on one request thread while pages wait on others.
    """

    def __init__(self) -> None:
        """starts empty, as if just reset."""
        self._changed = threading.Condition()
        self._version = 0
        self._session_ms = now_ms()
        self._events: list[dict] = []

    def add(self, key: str) -> None:
        """appends a key press and wakes any waiting pages.

        args:
            key: one of CONTROL_KEYS (the caller checks).
        """
        with self._changed:
            self._events.append({"key": key, "at_ms": now_ms()})
            # dropping the oldest presses only matters past MAX_EVENTS in one day
            del self._events[:-MAX_EVENTS]
            self._version += 1
            self._changed.notify_all()

    def reset(self) -> None:
        """clears the log, so the pages go back to the standard rotation."""
        with self._changed:
            self._events = []
            self._session_ms = now_ms()
            self._version += 1
            self._changed.notify_all()

    def wait_for_change(self, after_version: int, timeout_s: float = LONG_POLL_TIMEOUT_S) -> dict:
        """waits until the log's version differs from after_version, or the timeout passes.

        "differs" rather than "is newer": after an agent restart the version starts over,
        and a page still holding the old, higher number must get the new log straight away.

        args:
            after_version: the version the caller already has (-1 for none).
            timeout_s: how long to wait for a change.

        returns:
            {"session_ms", "version", "events": [{"key", "at_ms"}, ...]}, current either way.
        """
        with self._changed:
            self._changed.wait_for(lambda: self._version != after_version, timeout_s)
            return {"session_ms": self._session_ms, "version": self._version, "events": list(self._events)}
