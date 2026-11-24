"""
Who's in the opium den's live room right now, kept in memory.

The room's only open while the stream's live. Each browser in it checks in every few
seconds with its chat name and its secret owner key (the same one the chat uses, see
routers/dj_chat.py). Anyone who hasn't checked in for PRESENCE_TIMEOUT_S has left. Each
person gets a character number while they're in, the lowest one nobody else is using, so
a small room gets different characters and a number frees up when its person leaves. The
room empties when the set ends, and a backend restart empties it too (everyone reappears
on their next check-in). Each stay is also saved as a visit (models.DjRoomVisit) by the
router, so a set's page can show who was there; this module just remembers which visit
row each person's on.
"""

import hashlib
import time
from dataclasses import dataclass

# a browser checks in about every 15 s, so this allows a missed check-in or two
PRESENCE_TIMEOUT_S = 40.0
# most people the room holds at once, which keeps memory bounded if someone scripts check-ins
MAX_ROOM_PEOPLE = 100


class RoomNameTakenError(Exception):
    """Someone else in the room is already using the name."""


class RoomFullError(Exception):
    """The room's at MAX_ROOM_PEOPLE."""


@dataclass
class RoomPerson:
    """
    One person in the room.

    Attributes:
        nickname: Their chat name, as they typed it.
        avatar: Their character number, 0 up.
        joined_seq: Order they came in, for listing the room in arrival order.
        last_seen: time.monotonic() of their latest check-in.
        visit_id: The dj_room_visits row for this stay under this name, None until the router saves it.
    """
    nickname: str
    avatar: int
    joined_seq: int
    last_seen: float
    visit_id: int | None = None


@dataclass
class CheckIn:
    """
    What a check-in did.

    Attributes:
        person: The person, as they are now.
        new_visit: They just came in or changed their name, so they need a new visit row.
    """
    person: RoomPerson
    new_visit: bool


def hash_key(owner_key: str) -> str:
    """
    Hashes a browser's owner key, so the room never holds a usable key.

    Args:
        owner_key: The browser's secret key.

    Returns:
        str: sha256 hex digest.
    """
    return hashlib.sha256(owner_key.encode()).hexdigest()


class LiveRoom:
    """The people in the live room, by hashed owner key."""

    def __init__(self) -> None:
        """Starts empty."""
        self._people: dict[str, RoomPerson] = {}
        self._next_seq = 0

    def _sweep(self, now: float) -> None:
        """
        Drops everyone who hasn't checked in for PRESENCE_TIMEOUT_S. Their visit rows
        already end at their last check-in, so there's nothing to save.

        Args:
            now: time.monotonic() now.
        """
        gone = [key for key, person in self._people.items() if now - person.last_seen > PRESENCE_TIMEOUT_S]
        for key in gone:
            del self._people[key]

    def _free_avatar(self) -> int:
        """
        The lowest character number nobody in the room has.

        Returns:
            int: The number.
        """
        taken = {person.avatar for person in self._people.values()}
        avatar = 0
        while avatar in taken:
            avatar += 1
        return avatar

    def check_in(self, nickname: str, owner_key: str) -> CheckIn:
        """
        Puts this browser in the room under this name, or keeps it there. A changed name
        keeps its character but starts a new visit, so the replay shows the new name from then.

        Args:
            nickname: The chat name, already trimmed.
            owner_key: The browser's secret key.

        Returns:
            CheckIn: The person, and whether they need a new visit row.

        Raises:
            RoomNameTakenError: Another browser in the room has the name (ignoring case).
            RoomFullError: The room's full and this browser isn't in it yet.
        """
        now = time.monotonic()
        self._sweep(now)
        key = hash_key(owner_key)
        name_key = nickname.lower()
        for other_key, person in self._people.items():
            if other_key != key and person.nickname.lower() == name_key:
                raise RoomNameTakenError(nickname)
        person = self._people.get(key)
        if person is not None:
            renamed = person.nickname != nickname
            person.nickname = nickname
            person.last_seen = now
            return CheckIn(person=person, new_visit=renamed)
        if len(self._people) >= MAX_ROOM_PEOPLE:
            raise RoomFullError()
        person = RoomPerson(nickname=nickname, avatar=self._free_avatar(), joined_seq=self._next_seq, last_seen=now)
        self._people[key] = person
        self._next_seq += 1
        return CheckIn(person=person, new_visit=True)

    def leave(self, owner_key: str) -> RoomPerson | None:
        """
        Takes this browser out of the room right away.

        Args:
            owner_key: The browser's secret key.

        Returns:
            RoomPerson | None: Who left, or None if they weren't in.
        """
        return self._people.pop(hash_key(owner_key), None)

    def clear(self) -> None:
        """Empties the room, for when the set ends."""
        self._people.clear()

    def people(self) -> list[RoomPerson]:
        """
        Everyone in the room, in the order they came in.

        Returns:
            list[RoomPerson]: The people.
        """
        self._sweep(time.monotonic())
        return sorted(self._people.values(), key=lambda person: person.joined_seq)


# the one room, shared by every request
live_room = LiveRoom()
