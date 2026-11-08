"""
Who's home, and when they got here, from the presence agent's pushes.

The agent arp-scans the lan for each person's phone and pushes when it last saw
them (pi/services/presence-agent/presence_agent.py). This keeps everyone's
last-seen time, spots arrivals, and decides who counts as home, for the admin page.

An arrival is a phone answering after being silent for AWAY_AFTER_S, the same
silence that makes someone count as away. It's stamped with the first push that
saw them, so it's as precise as the agent's scan interval.

It lives in memory only: it's a live view, not a history. A backend restart
forgets everyone until the agent's next push, and forgets past arrivals for good.
This relies on uvicorn running one worker.
"""

import time
from dataclasses import dataclass

# phones asleep on the wifi go quiet for close to an hour sometimes, so someone only
# counts as away (and coming back counts as arriving) once their phone's been silent
# well past that
AWAY_AFTER_S = 90 * 60

# the agent pushes every 15 s or so, so silence for well over that means it's down
AGENT_ONLINE_WINDOW_S = 120

MS_PER_S = 1000


def now_ms() -> int:
    """Wall-clock time in epoch ms, the clock the agent's last-seen times use too."""
    return int(time.time() * MS_PER_S)


@dataclass
class PersonRecord:
    """
    What the backend knows about one person.

    Attributes:
        last_seen_ms: Epoch ms their phone last answered, None if never seen.
        arrived_at_ms: Epoch ms of their last arrival, None if none seen.
    """

    last_seen_ms: int | None = None
    arrived_at_ms: int | None = None


class PresenceStore:
    """Keeps everyone's last-seen and arrival times, and the order the agent lists them in."""

    def __init__(self) -> None:
        """Starts empty: nothing pushed yet."""
        self._names: list[str] = []
        self._records: dict[str, PersonRecord] = {}
        self._agent_seen_ms: int | None = None

    def _is_arrival(self, record: PersonRecord, seen_ms: int, agent_was_online: bool) -> bool:
        """
        Whether a sighting is someone coming home.

        Only counts when the agent's been pushing all along: after the agent or the backend
        was down, a long gap could just be time nobody was looking.

        Args:
            record: The person, before this sighting.
            seen_ms: When the agent saw them now.
            agent_was_online: The previous push was recent.

        Returns:
            bool: True if they were silent for AWAY_AFTER_S before this.
        """
        if not agent_was_online or record.last_seen_ms is None:
            return False
        return seen_ms - record.last_seen_ms >= AWAY_AFTER_S * MS_PER_S

    def set_snapshot(self, people: list[dict]) -> None:
        """
        Takes in the agent's latest push, noting arrivals.

        A person the agent hasn't seen since it restarted comes through as None, which
        keeps what the backend already knew rather than wiping it.

        Args:
            people: `{"name", "last_seen_ms"}` for everyone the agent watches, in its order.
        """
        current_ms = now_ms()
        agent_was_online = self._agent_online(current_ms)
        for person in people:
            record = self._records.setdefault(person["name"], PersonRecord())
            seen_ms = person["last_seen_ms"]
            if seen_ms is None or seen_ms == record.last_seen_ms:
                continue
            if self._is_arrival(record, seen_ms, agent_was_online):
                record.arrived_at_ms = seen_ms
            record.last_seen_ms = seen_ms
        self._names = [person["name"] for person in people]
        self._agent_seen_ms = current_ms

    def _agent_online(self, current_ms: int) -> bool:
        """
        Whether the agent pushed recently.

        Args:
            current_ms: Now, epoch ms.

        Returns:
            bool: True if the last push was within AGENT_ONLINE_WINDOW_S.
        """
        return (
            self._agent_seen_ms is not None
            and current_ms - self._agent_seen_ms <= AGENT_ONLINE_WINDOW_S * MS_PER_S
        )

    def state(self) -> dict:
        """
        Who's home right now, for the admin page.

        Someone's home if their phone answered within AWAY_AFTER_S. With the agent
        offline, last-seen times stop moving, so the page should say so rather than
        trust them.

        Returns:
            dict: `{"agent_online", "agent_seen_ms", "now_ms", "away_after_ms", "people"}`,
                each person `{"name", "last_seen_ms", "arrived_at_ms", "home"}`.
        """
        current_ms = now_ms()
        away_after_ms = AWAY_AFTER_S * MS_PER_S
        people = []
        for name in self._names:
            record = self._records[name]
            home = record.last_seen_ms is not None and current_ms - record.last_seen_ms <= away_after_ms
            people.append({
                "name": name,
                "last_seen_ms": record.last_seen_ms,
                "arrived_at_ms": record.arrived_at_ms,
                "home": home,
            })
        return {
            "agent_online": self._agent_online(current_ms),
            "agent_seen_ms": self._agent_seen_ms,
            "now_ms": current_ms,
            "away_after_ms": away_after_ms,
            "people": people,
        }


store = PresenceStore()
