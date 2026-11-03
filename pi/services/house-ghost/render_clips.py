"""render each roommate's greetings to audio/ with piper, then make them scary with ffmpeg.

clips get made ahead of time so a greeting plays the moment someone shows up. safe to rerun:
it skips clips that already exist, so delete audio/ after changing the lines or the effect.

usage:
    python render_clips.py                 render clips for everyone in roommates.json
    python render_clips.py --name Sam      render one test name, without roommates.json
"""

import argparse
import subprocess
import sys
import urllib.request
import wave
from pathlib import Path

from ghost_common import AUDIO_DIR, SERVICE_DIR, Roommate, load_roommates

# {name} gets swapped for the roommate's name. the ellipses make piper pause
GREETING_LINES = (
    "Hello, {name}... I knew you would come home.",
    "Welcome back, {name}... I have been watching the door.",
    "{name}... there you are... we have been waiting for you.",
    "I can see you, {name}... you are not alone in this house.",
)

VOICE_DIR = SERVICE_DIR / "voices"
VOICE_NAME = "en_US-ryan-medium"
VOICE_BASE_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/ryan/medium"
VOICE_DOWNLOAD_TIMEOUT_S = 120

# piper's slow-speech knob, higher is slower
SPEECH_LENGTH_SCALE = 1.25

# dropping the sample rate lowers the pitch and slows it down too
PITCH_FACTOR = 0.74
OUTPUT_SAMPLE_RATE_HZ = 44100
# evens out loudness between clips, and the small amps need them loud
LOUDNESS_FILTER = "loudnorm=I=-14:TP=-1.5"
ROOM_ECHO_FILTER = "aecho=0.8:0.75:90|240|520:0.45|0.3|0.18"
TONE_FILTER = "bass=g=6:f=140,lowpass=f=5000"


def ensure_voice() -> Path:
    """download the piper voice if we don't have it yet.

    Returns:
        path to the voice model.

    Side effects:
        writes the model and its config to voices/.
    """
    VOICE_DIR.mkdir(exist_ok=True)
    for filename in (f"{VOICE_NAME}.onnx", f"{VOICE_NAME}.onnx.json"):
        target = VOICE_DIR / filename
        if target.exists():
            continue
        print(f"downloading {filename}")
        with urllib.request.urlopen(f"{VOICE_BASE_URL}/{filename}", timeout=VOICE_DOWNLOAD_TIMEOUT_S) as response:
            target.write_bytes(response.read())
    return VOICE_DIR / f"{VOICE_NAME}.onnx"


def synthesize(text: str, voice: Path, output: Path) -> None:
    """turn text into plain speech with piper.

    Args:
        text: what to say.
        voice: path to the voice model.
        output: wav file to write.

    Raises:
        subprocess.CalledProcessError: if piper fails.
    """
    subprocess.run(
        [
            sys.executable, "-m", "piper", "--model", str(voice),
            "--length-scale", str(SPEECH_LENGTH_SCALE), "--output-file", str(output),
        ],
        input=text, text=True, check=True, capture_output=True,
    )


def apply_scary_effect(source: Path, output: Path) -> None:
    """pitch a clip down and put it in a big empty room.

    Args:
        source: plain speech wav.
        output: wav file to write.

    Raises:
        subprocess.CalledProcessError: if ffmpeg fails.
    """
    with wave.open(str(source)) as clip:
        source_rate_hz = clip.getframerate()
    filters = ",".join((
        f"asetrate={int(source_rate_hz * PITCH_FACTOR)}",
        f"aresample={OUTPUT_SAMPLE_RATE_HZ}",
        TONE_FILTER,
        ROOM_ECHO_FILTER,
        LOUDNESS_FILTER,
        f"aresample={OUTPUT_SAMPLE_RATE_HZ}",
    ))
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(source), "-af", filters, "-ac", "2", str(output)],
        check=True, capture_output=True,
    )


def render_roommate(roommate: Roommate, voice: Path) -> None:
    """render all the lines for one roommate.

    Args:
        roommate: who the clips are for.
        voice: path to the voice model.

    Side effects:
        writes audio/<slug>_<n>.wav for any clip that doesn't exist yet.
    """
    for index, line in enumerate(GREETING_LINES):
        output = AUDIO_DIR / f"{roommate.slug}_{index}.wav"
        if output.exists():
            continue
        plain = output.with_suffix(".plain.tmp")
        synthesize(line.format(name=roommate.say_as), voice, plain)
        apply_scary_effect(plain, output)
        plain.unlink()
        print(f"rendered {output.name}")


def main() -> None:
    """render clips for everyone, or for one test name."""
    parser = argparse.ArgumentParser(description="render the ghost's greeting clips.")
    parser.add_argument("--name", help="render this name instead of reading roommates.json")
    name = parser.parse_args().name

    roommates = (
        [Roommate(name=name, macs=frozenset(), say_as=name)] if name else load_roommates()
    )
    AUDIO_DIR.mkdir(exist_ok=True)
    voice = ensure_voice()
    for roommate in roommates:
        render_roommate(roommate, voice)


if __name__ == "__main__":
    main()
