"""
Remote control relay for the display kiosk (displaytop).

The kiosk's keyboard drives its screens through a key log kept by the surfcam
agent on displaytop (pi/services/surfcam-agent/kiosk_control.py). That agent
only listens on the laptop's own loopback, so the admin page can't reach it.
Instead both sides meet here:

- the admin page queues key presses (`queue_keys`), and the agent long-polls
  for them (`wait_for_commands`) and adds them to its log, as if they'd been
  typed on the kiosk
- the agent pushes its whole log up whenever it changes (`set_kiosk_log`), and
  the admin page long-polls it (`wait_for_state`) to show what's on screen

Everything lives in memory: it's a relay, not a record. A backend restart just
drops queued presses (the agent picks up from the next one) and forgets the
log until the agent's next push. This relies on uvicorn running one worker.
"""

import asyncio
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Optional

# how long a long-poll waits for a change before answering with nothing new, so
# no request sits open long enough for cloudflare's tunnel to drop it (100 s)
LONG_POLL_TIMEOUT_S = 25

# a queued press older than this is dropped instead of delivered: if the kiosk
# was offline when it was pressed, it shouldn't jump screens minutes later
COMMAND_MAX_AGE_S = 30

# only the newest presses are kept; the agent normally takes them within a second
MAX_QUEUED_COMMANDS = 100

# the agent polls for commands every LONG_POLL_TIMEOUT_S at most, so silence for
# well over that means it's down (or displaytop is offline)
KIOSK_ONLINE_WINDOW_S = 60

MS_PER_S = 1000


def now_ms() -> int:
    """Wall-clock time in epoch ms, the clock the kiosk's key log uses too."""
    return int(time.time() * MS_PER_S)


@dataclass
class QueuedCommand:
    """One button press from the admin page: keys the agent adds to its log in order."""

    id: int
    keys: list[str]
    queued_at_s: float = field(default_factory=time.monotonic)


class DisplayControlRelay:
    """
    Holds queued presses and the kiosk's last pushed key log.

    One `asyncio.Condition` wakes every waiting long-poll on any change; each
    waiter re-checks its own predicate, so commands and state share it.
    """

    def __init__(self) -> None:
        """Starts empty: no presses queued, no log pushed yet."""
        self._changed = asyncio.Condition()
        self._commands: deque[QueuedCommand] = deque(maxlen=MAX_QUEUED_COMMANDS)
        self._last_command_id = 0
        self._kiosk_log: Optional[dict] = None
        self._state_revision = 0
        self._kiosk_seen_ms: Optional[int] = None

    async def queue_keys(self, keys: list[str]) -> int:
        """
        Queues one press (a sequence of keys) for the kiosk and wakes the agent.

        Args:
            keys: Key names, already validated against the kiosk's key list.

        Returns:
            int: The command's id.
        """
        async with self._changed:
            self._last_command_id += 1
            self._commands.append(QueuedCommand(id=self._last_command_id, keys=keys))
            self._changed.notify_all()
            return self._last_command_id

    def _fresh_commands_after(self, after: int) -> list[QueuedCommand]:
        """Queued commands newer than `after` that aren't too old to deliver."""
        cutoff_s = time.monotonic() - COMMAND_MAX_AGE_S
        return [c for c in self._commands if c.id > after and c.queued_at_s >= cutoff_s]

    async def wait_for_commands(self, after: int, timeout_s: float = LONG_POLL_TIMEOUT_S) -> tuple[int, list[QueuedCommand]]:
        """
        Long-poll for the agent: waits for presses newer than `after`.

        `after` below zero (the agent just started) answers straight away with
        the current cursor and nothing to do, so presses queued before the agent
        was listening aren't replayed. `after` above the newest id means the
        backend restarted and ids started over, so it gets everything queued
        since.

        Args:
            after: The last command id the agent has handled, or -1.
            timeout_s: How long to wait for a press.

        Returns:
            tuple[int, list[QueuedCommand]]: The cursor to send next time, and
                the commands to run (possibly none).
        """
        self._kiosk_seen_ms = now_ms()
        async with self._changed:
            if after < 0:
                return self._last_command_id, []
            if after > self._last_command_id:
                after = 0
            try:
                await asyncio.wait_for(
                    self._changed.wait_for(lambda: self._last_command_id > after),
                    timeout_s,
                )
            except TimeoutError:
                pass
            self._kiosk_seen_ms = now_ms()
            return self._last_command_id, self._fresh_commands_after(after)

    async def set_kiosk_log(self, log: dict) -> None:
        """
        Stores the agent's latest key log and wakes the admin pages watching it.

        Args:
            log: The agent's log, `{"session_ms", "version", "events": [...]}`.
        """
        async with self._changed:
            self._kiosk_log = log
            self._kiosk_seen_ms = now_ms()
            self._state_revision += 1
            self._changed.notify_all()

    def _state(self) -> dict:
        """The admin page's view of the kiosk: its log, and whether it's online."""
        current_ms = now_ms()
        online = (
            self._kiosk_seen_ms is not None
            and current_ms - self._kiosk_seen_ms <= KIOSK_ONLINE_WINDOW_S * MS_PER_S
        )
        return {
            "revision": self._state_revision,
            "online": online,
            "kiosk_seen_ms": self._kiosk_seen_ms,
            "now_ms": current_ms,
            "log": self._kiosk_log,
        }

    async def wait_for_state(self, after: int, timeout_s: float = LONG_POLL_TIMEOUT_S) -> dict:
        """
        Long-poll for the admin page: waits for the kiosk's log to change.

        "Changes" means the revision differs from `after` rather than is newer,
        so a page still holding a revision from before a backend restart gets
        the new state straight away.

        Args:
            after: The revision the page already has, or -1 for none.
            timeout_s: How long to wait for a change.

        Returns:
            dict: `{"revision", "online", "kiosk_seen_ms", "now_ms", "log"}`,
                current either way.
        """
        async with self._changed:
            try:
                await asyncio.wait_for(
                    self._changed.wait_for(lambda: self._state_revision != after),
                    timeout_s,
                )
            except TimeoutError:
                pass
            return self._state()


relay = DisplayControlRelay()
