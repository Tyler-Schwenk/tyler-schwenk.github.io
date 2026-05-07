"""
button_audio_test.py — one-shot hardware test for button + I2S audio.

Press the button wired to GPIO 17 and it plays the specified WAV file
through the I2S amps. Ctrl+C to exit.

Usage:
    python button_audio_test.py [--audio PATH]

Run this on the Pi to verify the breadboard wiring is correct before
setting up the full trash reminder service.
"""

import argparse
import logging
import subprocess
import time

import RPi.GPIO as GPIO

# GPIO pin (BCM numbering) connected to the button
BUTTON_PIN = 17

# debounce window — ignore edges within this many ms of a press
DEBOUNCE_MS = 200

# how long to poll between button checks (s)
POLL_INTERVAL_S = 0.05

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
    result = subprocess.run(["aplay", "-D", "plughw:0,0", path])
    if result.returncode != 0:
        logger.error(
            "aplay failed (exit %d) — check that I2S overlay is loaded "
            "and the card shows up in `aplay -l`",
            result.returncode,
        )


def setup_gpio() -> None:
    """Configure GPIO for the button with internal pull-up.

    Side effects:
        Sets BCM mode and configures BUTTON_PIN as input with pull-up.
    """
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(BUTTON_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)


def main() -> None:
    """Run the button test loop.

    Waits for a falling edge on BUTTON_PIN (button connects pin to GND)
    and plays the audio file. Cleans up GPIO on exit.
    """
    args = parse_args()
    setup_gpio()

    logger.info("Ready — press the button (GPIO %d) to play audio. Ctrl+C to quit.", BUTTON_PIN)

    try:
        while True:
            # LOW = pressed (pull-up means idle is HIGH)
            if GPIO.input(BUTTON_PIN) == GPIO.LOW:
                play_wav(args.audio)
                # wait for release + debounce before listening again
                while GPIO.input(BUTTON_PIN) == GPIO.LOW:
                    time.sleep(POLL_INTERVAL_S)
                time.sleep(DEBOUNCE_MS / 1000)

            time.sleep(POLL_INTERVAL_S)

    except KeyboardInterrupt:
        logger.info("Exiting.")
    finally:
        GPIO.cleanup()


if __name__ == "__main__":
    main()
