"""
button_audio_test.py — one-shot hardware test for button + I2S audio.

Press the button wired to GPIO 17 and it plays the specified WAV file
through the I2S amps. Ctrl+C to exit.

Usage:
    python button_audio_test.py [--audio PATH]

Run this on the Pi to verify the breadboard wiring is correct before
setting up the full trash reminder service.

Note: uses gpiozero + lgpio backend — RPi.GPIO doesn't support the Pi 5.
"""

import argparse
import logging
import subprocess

from gpiozero import Button
from gpiozero.pins.lgpio import LGPIOFactory
from signal import pause

# GPIO pin (BCM numbering) connected to the button
BUTTON_PIN = 17

# ALSA device for the I2S amps — card 2 on fart-pi (run `aplay -l` to verify)
ALSA_DEVICE = "plughw:2,0"

# debounce window (s)
DEBOUNCE_S = 0.2

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments.

    Returns:
        Parsed namespace with .audio path.
    """
    parser = argparse.ArgumentParser(description="Test button + I2S audio.")
    parser.add_argument(
        "--audio",
        default="/home/tyler/hey_guys.wav",
        help="Path to WAV file to play on button press.",
    )
    return parser.parse_args()


def play_wav(path: str) -> None:
    """Play a WAV file via aplay through the I2S device.

    Args:
        path: Absolute path to the WAV file.

    Side effects:
        Blocks until playback finishes. Logs an error if aplay fails.
    """
    logger.info("Playing %s", path)
    result = subprocess.run(["aplay", "-D", ALSA_DEVICE, path])
    if result.returncode != 0:
        logger.error(
            "aplay failed (exit %d) — check that I2S overlay is loaded "
            "and the card shows up in `aplay -l`",
            result.returncode,
        )


def main() -> None:
    """Run the button test loop.

    Plays audio once at startup to verify speakers work, then registers
    a callback on button press and blocks until Ctrl+C.
    Uses lgpio pin factory — required for Pi 5.
    """
    args = parse_args()

    logger.info("Playing audio at startup to test speakers...")
    play_wav(args.audio)
    logger.info("Startup audio done. Setting up button on GPIO %d...", BUTTON_PIN)

    # lgpio is the correct backend for Pi 5
    factory = LGPIOFactory()
    button = Button(BUTTON_PIN, pull_up=True, bounce_time=DEBOUNCE_S, pin_factory=factory)

    def on_press():
        logger.info("Button pressed!")
        play_wav(args.audio)

    button.when_pressed = on_press

    logger.info("Ready — press the button (GPIO %d) to play audio. Ctrl+C to quit.", BUTTON_PIN)
    pause()


if __name__ == "__main__":
    main()
