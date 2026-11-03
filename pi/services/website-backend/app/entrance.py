"""
Entrance song: plays a pre-rendered clip on the big speakers on command.

The fades and the cut are baked into the wav by scripts/render_entrance.py. The speaker
agent on displaytop does the playing and keeps the time, so this only starts and stops it.
See pi/docs/services/entrance-song.md and pi/docs/services/speaker-agent.md.
"""

import asyncio
import hashlib
import logging
from pathlib import Path

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# the song's timeline. the wav has these baked in, so rerun scripts/render_entrance.py
# after changing any of them
ENTRANCE_DROP_S = 58
ENTRANCE_END_S = 84
ENTRANCE_FADE_IN_S = 15
# linear gain at the very start of the fade in, 0.5 is about 6 db down
ENTRANCE_FADE_IN_START_GAIN = 0.5
ENTRANCE_FADE_OUT_S = 8

ENTRANCE_SOURCE_FILENAME = "source.mp3"
ENTRANCE_RENDERED_FILENAME = "song.wav"

# who the speaker agent thinks this is, so we can only stop our own clip
SPEAKER_OWNER = "entrance"
AGENT_REQUEST_TIMEOUT_S = 5
# 15 mb over wifi
AGENT_UPLOAD_TIMEOUT_S = 60

HTTP_NOT_FOUND = 404
HTTP_CONFLICT = 409

MS_PER_S = 1000


class EntranceUnavailableError(Exception):
    """The song can't play because something's missing or broken. The message says what to do."""


class SpeakersBusyError(Exception):
    """Another service (trash reminder, house ghost) is using the speakers right now."""


def rendered_path() -> Path:
    """
    Where the rendered wav lives.

    Returns:
        Path: The wav inside ENTRANCE_DIR.
    """
    return Path(settings.ENTRANCE_DIR) / ENTRANCE_RENDERED_FILENAME


def _read_rendered() -> bytes:
    """
    Reads the rendered wav.

    Returns:
        bytes: The whole file.

    Raises:
        EntranceUnavailableError: It hasn't been rendered.
    """
    path = rendered_path()
    try:
        return path.read_bytes()
    except FileNotFoundError as exc:
        raise EntranceUnavailableError(
            f"{path} doesn't exist - render it with the steps in pi/docs/services/entrance-song.md"
        ) from exc


async def _call_agent(method: str, route: str, timeout_s: float = AGENT_REQUEST_TIMEOUT_S, content: bytes | None = None) -> httpx.Response:
    """
    Sends one request to the speaker agent.

    Args:
        method: HTTP method.
        route: Path on the agent.
        timeout_s: How long to wait for an answer.
        content: Request body, if any.

    Returns:
        httpx.Response: Its answer, whatever the status.

    Raises:
        EntranceUnavailableError: It couldn't be reached.
    """
    try:
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            return await client.request(method, f"{settings.SPEAKER_AGENT_URL}{route}", content=content)
    except httpx.HTTPError as exc:
        raise EntranceUnavailableError(
            f"couldn't reach the speaker agent at {settings.SPEAKER_AGENT_URL} ({exc!r}) - "
            "is displaytop on? check `systemctl status speaker-agent` there"
        ) from exc


def _failure(response: httpx.Response, doing: str) -> EntranceUnavailableError:
    """
    Builds the error for an answer the agent shouldn't have given.

    Args:
        response: The agent's answer.
        doing: What was being tried, like "start the song".

    Returns:
        EntranceUnavailableError: Ready to raise.
    """
    logger.error("entrance song: agent answered %s trying to %s: %s", response.status_code, doing, response.text)
    return EntranceUnavailableError(f"the speaker agent couldn't {doing} ({response.status_code}): {response.text}")


async def upload_rendered() -> None:
    """
    Puts the rendered wav on the speaker agent, so the first press doesn't wait for the upload.

    Raises:
        EntranceUnavailableError: It's not rendered, or the agent wouldn't take it.
    """
    wav = await asyncio.to_thread(_read_rendered)
    clip = await asyncio.to_thread(lambda: hashlib.sha256(wav).hexdigest())
    await _upload(clip, wav)


async def _upload(clip: str, wav: bytes) -> None:
    """
    Sends the wav to the speaker agent.

    Args:
        clip: Its sha256.
        wav: The file.

    Raises:
        EntranceUnavailableError: The agent wouldn't take it.
    """
    response = await _call_agent("PUT", f"/clips/{clip}", AGENT_UPLOAD_TIMEOUT_S, wav)
    if not response.is_success:
        raise _failure(response, "store the song")
    logger.info("entrance song: uploaded %d bytes to the speaker agent", len(wav))


class EntrancePlayer:
    """Starts and stops the song on the speaker agent."""

    def __init__(self) -> None:
        """Nothing hashed yet."""
        self._lock = asyncio.Lock()
        # (size, mtime) of the wav when it was hashed, so a rerender gets picked up
        self._clip_version: tuple[int, int] | None = None
        self._clip: str | None = None

    async def status(self) -> dict:
        """
        Where the song is right now, with the timeline the page needs for its countdown.

        Returns:
            dict: `{"playing", "position_ms", "drop_at_ms", "duration_ms"}`. Only our own
                clip counts as playing, and position_ms is 0 when it isn't.

        Raises:
            EntranceUnavailableError: The agent can't be reached.
        """
        response = await _call_agent("GET", "/status")
        if not response.is_success:
            raise _failure(response, "report its status")
        agent = response.json()
        playing = agent["playing"] and agent["owner"] == SPEAKER_OWNER
        return {
            "playing": playing,
            "position_ms": agent["position_ms"] if playing else 0,
            "drop_at_ms": ENTRANCE_DROP_S * MS_PER_S,
            "duration_ms": ENTRANCE_END_S * MS_PER_S,
        }

    async def start(self) -> None:
        """
        Starts the song from the top. Does nothing if it's already playing, so a double
        tap can't restart it and throw off the countdown.

        Raises:
            SpeakersBusyError: Another service has the speakers.
            EntranceUnavailableError: The wav is missing or the agent can't play it.

        Side effects:
            Plays audio through the big speakers. Uploads the wav if the agent lacks it.
        """
        async with self._lock:
            current = await self.status()
            if current["playing"]:
                return

            clip = await asyncio.to_thread(self._current_clip)
            response = await _call_agent("POST", f"/play/{SPEAKER_OWNER}/{clip}")
            if response.status_code == HTTP_NOT_FOUND:
                await _upload(clip, await asyncio.to_thread(_read_rendered))
                response = await _call_agent("POST", f"/play/{SPEAKER_OWNER}/{clip}")
            if response.status_code == HTTP_CONFLICT:
                raise SpeakersBusyError(response.json()["error"])
            if not response.is_success:
                raise _failure(response, "start the song")
            logger.info("entrance song: started")

    async def stop(self) -> None:
        """
        Cuts the song off. Does nothing if it isn't playing.

        Raises:
            EntranceUnavailableError: The agent can't be reached.
        """
        response = await _call_agent("POST", f"/stop/{SPEAKER_OWNER}")
        if not response.is_success:
            raise _failure(response, "stop the song")
        logger.info("entrance song: stopped")

    def _current_clip(self) -> str:
        """
        Works out the wav's sha256, the name the agent knows it by.

        Returns:
            str: Hex sha256, only rehashed if the file changed.

        Raises:
            EntranceUnavailableError: It hasn't been rendered.
        """
        path = rendered_path()
        wav_stat = path.stat() if path.is_file() else None
        version = (wav_stat.st_size, wav_stat.st_mtime_ns) if wav_stat else None
        if self._clip is None or version != self._clip_version:
            self._clip = hashlib.sha256(_read_rendered()).hexdigest()
            self._clip_version = version
        return self._clip


player = EntrancePlayer()
