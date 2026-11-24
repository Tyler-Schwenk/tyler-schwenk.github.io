"""
Who's in the opium den's live room right now, kept in memory.

The room's only open while the stream's live. Each browser in it checks in every few
seconds with its chat name and its secret owner key (the same one the chat uses, see
routers/dj_chat.py). Anyone who hasn't checked in for PRESENCE_TIMEOUT_S has left. The
room empties when the set ends, and a backend restart empties it too (everyone reappears
on their next check-in).

Each person has an avatar number, unique in the room. Numbers below ROOM_CHARACTER_COUNT
are the site's dancing characters: someone can ask for a free one, or gets the lowest
free one. Someone standing in as their own photo gets a number from ROOM_CHARACTER_COUNT
up instead, so they don't use up a character. Each stay is also saved as a visit
(models.DjRoomVisit) by the router, so a set's page can show who was there; this module
just remembers which visit row each person's on.
"""

import hashlib
import time
from dataclasses import dataclass

from app.schemas import DJ_ROOM_CHARACTER_COUNT

# a browser checks in about every 15 s, so this allows a missed check-in or two
PRESENCE_TIMEOUT_S = 40.0
# most people the room holds at once, which keeps memory bounded if someone scripts check-ins
MAX_ROOM_PEOPLE = 100
# how many characters there are to pick from: the site's six dancers, plain then inverted
# (CHARACTERS in website/components/opium-den/roomCharacters.ts). keep the two in step
ROOM_CHARACTER_COUNT = DJ_ROOM_CHARACTER_COUNT


class RoomNameTakenError(Exception):
    """Someone else in the room is already using the name."""


class RoomLookTakenError(Exception):
    """Someone else in the room is already the character asked for."""


class RoomFullError(Exception):
    """The room's at MAX_ROOM_PEOPLE."""


@dataclass
class RoomPerson:
    """
    One person in the room.

    Attributes:
        nickname: Their chat name, as they typed it.
        avatar: Their number, unique in the room. Under ROOM_CHARACTER_COUNT it's their character.
        photo_id: The photo they're standing in as, or None for a character.
        joined_seq: Order they came in, for listing the room in arrival order.
        last_seen: time.monotonic() of their latest check-in.
        visit_id: The dj_room_visits row for this stay as they are now, None until the router saves it.
    """
    nickname: str
    avatar: int
    photo_id: int | None
    joined_seq: int
    last_seen: float
    visit_id: int | None = None


@dataclass
class CheckIn:
    """
    What a check-in did.

    Attributes:
        person: The person, as they are now.
        new_visit: They just came in, or changed their name or look, so they need a new visit row.
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

    def _free_avatar(self, key: str, start: int) -> int:
        """
        The lowest number from start up that nobody else in the room has.

        Args:
            key: The hashed key of whoever's asking (their own number counts as free).
            start: Where to start looking: 0 for anyone, ROOM_CHARACTER_COUNT for a photo.

        Returns:
            int: The number.
        """
        taken = {person.avatar for other_key, person in self._people.items() if other_key != key}
        avatar = start
        while avatar in taken:
            avatar += 1
        return avatar

    def _pick_avatar(self, key: str, current: RoomPerson | None, avatar: int | None, photo_id: int | None) -> int:
        """
        Works out someone's number from what they asked for: their photo's, the character
        they picked, or (asking for nothing) whatever they had, or the lowest free one.

        Args:
            key: Their hashed key.
            current: Them as they are in the room, or None if they're just coming in.
            avatar: The character they asked for, or None.
            photo_id: The photo they're coming in as, or None.

        Returns:
            int: Their number.

        Raises:
            RoomLookTakenError: Someone else is the character they asked for.
        """
        if photo_id is not None:
            keep = current is not None and current.avatar >= ROOM_CHARACTER_COUNT
            return current.avatar if keep else self._free_avatar(key, ROOM_CHARACTER_COUNT)
        if avatar is not None:
            if any(person.avatar == avatar for other_key, person in self._people.items() if other_key != key):
                raise RoomLookTakenError(avatar)
            return avatar
        return current.avatar if current is not None else self._free_avatar(key, 0)

    def check_in(self, nickname: str, owner_key: str, avatar: int | None = None, photo_id: int | None = None) -> CheckIn:
        """
        Puts this browser in the room under this name and look, or keeps it there. A
        changed name or look keeps their place but starts a new visit, so the replay shows
        the change from then.

        Args:
            nickname: The chat name, already trimmed.
            owner_key: The browser's secret key.
            avatar: A character asked for (0 to ROOM_CHARACTER_COUNT - 1), or None.
            photo_id: A photo to stand in as (the caller checks it's theirs), or None. Wins over avatar.

        Returns:
            CheckIn: The person, and whether they need a new visit row.

        Raises:
            RoomNameTakenError: Another browser in the room has the name (ignoring case).
            RoomLookTakenError: Another browser in the room is the character asked for.
            RoomFullError: The room's full and this browser isn't in it yet.
        """
        now = time.monotonic()
        self._sweep(now)
        key = hash_key(owner_key)
        name_key = nickname.lower()
        for other_key, person in self._people.items():
            if other_key != key and person.nickname.lower() == name_key:
                raise RoomNameTakenError(nickname)
        current = self._people.get(key)
        if current is None and len(self._people) >= MAX_ROOM_PEOPLE:
            raise RoomFullError()
        picked = self._pick_avatar(key, current, avatar, photo_id)
        if current is not None:
            # asking for nothing keeps a photo, the same as it keeps a character
            next_photo = photo_id if photo_id is not None or avatar is not None else current.photo_id
            changed = (current.nickname, current.avatar, current.photo_id) != (nickname, picked, next_photo)
            current.nickname, current.avatar, current.photo_id, current.last_seen = nickname, picked, next_photo, now
            return CheckIn(person=current, new_visit=changed)
        person = RoomPerson(nickname=nickname, avatar=picked, photo_id=photo_id, joined_seq=self._next_seq, last_seen=now)
        self._people[key] = person
        self._next_seq += 1
        return CheckIn(person=person, new_visit=True)

    def drop_photo(self, photo_id: int) -> None:
        """
        Takes a removed photo off whoever's standing in as it. They stay in the room; their
        next check-in still asks for it and gets turned away, so they pick something else.

        Args:
            photo_id: The photo.
        """
        for person in self._people.values():
            if person.photo_id == photo_id:
                person.photo_id = None

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
