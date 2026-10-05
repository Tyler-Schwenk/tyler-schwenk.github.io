"""keyboard control for the display kiosk: a log of the key presses since the last reset.

xbindkeys on the kiosk grabs the control keys system-wide (so they work whichever window
has focus, mpv included) and posts each press to the agent, which appends it here. presses
from the admin page's remote arrive the same way via remote_control.py. the
display pages long-poll the log and replay it through the same state machine
(website/app/display/kioskControl.ts), so both screens always agree on what's showing,
and a page that reloads just replays the log and lands in the same place.

the log is cleared by kiosk-run.sh when the overnight sleep starts (POST /control/reset),
so every morning starts on the standard rotation. an agent restart clears it too.
"""

import re
import threading
import time
from typing import Optional

# key names the pages understand. xbindkeys maps the physical keys onto these
# (see setup-displaytop.sh): tab, esc, backspace, ] and [, the digit row, and b (the
# bpm visualizer)
CONTROL_KEYS = {"tab", "escape", "backspace", "next", "prev", "b", *map(str, range(1, 10))}

# the admin page's remote can also jump to a milkdrop preset: preset-<index into the
# page's sorted preset list>. no physical key sends these
PRESET_KEY_PATTERN = re.compile(r"^preset-\d{1,4}$")

# a preset name longer than this isn't a preset name; it's cut so a bad report can't bloat pushes
MAX_PRESET_NAME_CHARS = 200

# a day of button mashing is nowhere near this; it only stops a stuck key growing the log forever
MAX_EVENTS = 1000

# how long a long-poll waits for a change before answering with the unchanged log, so
# the page's request never sits open long enough for anything in between to drop it
LONG_POLL_TIMEOUT_S = 25


def is_control_key(key: str) -> bool:
    """whether the pages understand a key: one of CONTROL_KEYS, or a preset jump."""
    return key in CONTROL_KEYS or PRESET_KEY_PATTERN.match(key) is not None


def now_ms() -> int:
    """wall-clock time in epoch ms, the same clock the pages use for their rotation."""
    return int(time.time() * 1000)


class ControlLog:
    """the key presses since the last reset, with a version that bumps on every change.

    it also holds the milkdrop preset the page says is playing, which isn't part of
    the log (the pages don't need it) but goes up to the admin page with it.

    thread-safe: presses arrive on one request thread while pages wait on others.
    """

    def __init__(self) -> None:
        """starts empty, as if just reset."""
        self._changed = threading.Condition()
        self._version = 0
        self._session_ms = now_ms()
        self._events: list[dict] = []
        self._preset: Optional[str] = None
        # bumps on log changes and preset reports alike: what the remote push waits on
        self._push_version = 0

    def add(self, keys: list[str]) -> None:
        """appends key presses as one change and wakes any waiting pages.

        several keys go in together so the pages never see the state in between (a
        remote press of escape then 1 shouldn't flash the standard rotation first).

        args:
            keys: each one a control key (is_control_key; the caller checks), in order.
        """
        with self._changed:
            pressed_ms = now_ms()
            self._events.extend({"key": key, "at_ms": pressed_ms} for key in keys)
            # dropping the oldest presses only matters past MAX_EVENTS in one day
            del self._events[:-MAX_EVENTS]
            self._version += 1
            self._push_version += 1
            self._changed.notify_all()

    def set_preset(self, name: Optional[str]) -> None:
        """records the milkdrop preset playing (None when milkdrop closes) for the remote.

        args:
            name: the preset's name, as the page reported it.
        """
        with self._changed:
            self._preset = name[:MAX_PRESET_NAME_CHARS] if name else None
            self._push_version += 1
            self._changed.notify_all()

    def reset(self) -> None:
        """clears the log, so the pages go back to the standard rotation."""
        with self._changed:
            self._events = []
            self._session_ms = now_ms()
            self._version += 1
            self._push_version += 1
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

    def wait_for_push(self, after_push_version: int, timeout_s: float = LONG_POLL_TIMEOUT_S) -> dict:
        """waits until the log or the playing preset changes, for the remote push.

        args:
            after_push_version: the push version the caller already sent (-1 for none).
            timeout_s: how long to wait for a change.

        returns:
            the log as wait_for_change returns it, plus "preset" and "push_version".
        """
        with self._changed:
            self._changed.wait_for(lambda: self._push_version != after_push_version, timeout_s)
            return {
                "session_ms": self._session_ms,
                "version": self._version,
                "events": list(self._events),
                "preset": self._preset,
                "push_version": self._push_version,
            }
