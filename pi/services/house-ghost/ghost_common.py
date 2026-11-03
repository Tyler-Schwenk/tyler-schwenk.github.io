"""shared bits for the house ghost: paths and the roommate list."""

import json
import re
from dataclasses import dataclass
from pathlib import Path

SERVICE_DIR = Path(__file__).parent
AUDIO_DIR = SERVICE_DIR / "audio"
ROOMMATES_FILE = SERVICE_DIR / "roommates.json"

MAC_PATTERN = re.compile(r"^([0-9a-f]{2}:){5}[0-9a-f]{2}$")


@dataclass(frozen=True)
class Roommate:
    """one person the ghost knows.

    Attributes:
        name: what we call them, also used to name their clips.
        macs: lowercase wifi mac addresses of their devices.
        say_as: how the voice should say the name, for names tts mangles.
    """

    name: str
    macs: frozenset[str]
    say_as: str

    @property
    def slug(self) -> str:
        """their name as a filename-safe prefix for clips."""
        return re.sub(r"[^a-z0-9]+", "-", self.name.lower()).strip("-")


def load_roommates(path: Path = ROOMMATES_FILE) -> list[Roommate]:
    """read and validate the roommate list.

    Args:
        path: json file, see roommates.example.json for the format.

    Returns:
        the roommates, in file order.

    Raises:
        ValueError: if the file's missing, isn't valid json, or has a bad entry.
    """
    try:
        entries = json.loads(path.read_text())
    except FileNotFoundError as exc:
        raise ValueError(
            f"can't find {path}: copy roommates.example.json to roommates.json and fill it in"
        ) from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"{path} isn't valid json ({exc}): fix it and restart") from exc
    return [_parse_entry(entry, path) for entry in entries]


def _parse_entry(entry: dict, path: Path) -> Roommate:
    """turn one json entry into a Roommate.

    Args:
        entry: one object from the roommate list.
        path: the file it came from, for error messages.

    Returns:
        the parsed roommate.

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
    return Roommate(name=name, macs=frozenset(macs), say_as=entry.get("say_as", name))
