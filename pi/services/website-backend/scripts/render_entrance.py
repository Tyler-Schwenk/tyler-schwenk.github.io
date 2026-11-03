"""Renders the entrance song's mp3 into the wav that gets played, then sends it to the speaker agent.

Trims it and bakes in the fades. Safe to rerun, it overwrites the wav. Run it from inside the
container after copying the source over or changing the timeline constants in app/entrance.py:

    docker exec website-backend-api python scripts/render_entrance.py

See pi/docs/services/entrance-song.md.
"""

import asyncio
import os
import subprocess
import sys
from pathlib import Path

# make app importable when run from the project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.config import settings
from app.entrance import (
    ENTRANCE_END_S,
    ENTRANCE_FADE_IN_S,
    ENTRANCE_FADE_IN_START_GAIN,
    ENTRANCE_FADE_OUT_S,
    ENTRANCE_SOURCE_FILENAME,
    EntranceUnavailableError,
    rendered_path,
    upload_rendered,
)


def audio_filter() -> str:
    """
    Builds the ffmpeg filter for the fades.

    Returns:
        str: A volume ramp up from the start gain, then a fade to silence at the end.
    """
    start_gain = ENTRANCE_FADE_IN_START_GAIN
    fade_in = f"volume='min(1,{start_gain}+{1 - start_gain}*t/{ENTRANCE_FADE_IN_S})':eval=frame"
    fade_out = f"afade=t=out:st={ENTRANCE_END_S - ENTRANCE_FADE_OUT_S}:d={ENTRANCE_FADE_OUT_S}"
    return f"{fade_in},{fade_out}"


def render(source: Path, output: Path) -> None:
    """
    Runs ffmpeg to render the song.

    Args:
        source: The original mp3.
        output: The wav to write.

    Raises:
        SystemExit: The source is missing or ffmpeg failed.

    Side effects:
        Overwrites `output`.
    """
    if not source.is_file():
        raise SystemExit(f"can't find {source}: copy the mp3 there first (see pi/docs/services/entrance-song.md)")

    command = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(source),
        "-t", str(ENTRANCE_END_S),
        "-af", audio_filter(),
        "-c:a", "pcm_s16le",
        str(output),
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f"ffmpeg exited {result.returncode} rendering {source}: {result.stderr.strip()}")
    print(f"wrote {output}")


def main() -> None:
    """Renders the song and uploads it, so the first press plays right away."""
    render(Path(settings.ENTRANCE_DIR) / ENTRANCE_SOURCE_FILENAME, rendered_path())
    try:
        asyncio.run(upload_rendered())
    except EntranceUnavailableError as exc:
        # not fatal: the first press uploads it, just with a few seconds' wait
        print(f"rendered, but couldn't upload it yet: {exc}")
        return
    print("uploaded to the speaker agent")


if __name__ == "__main__":
    main()
