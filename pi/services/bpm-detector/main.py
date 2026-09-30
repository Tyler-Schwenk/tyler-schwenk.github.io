"""
BPM detector service.

Runs on fart-pi as a systemd service. Continuously listens to a USB mic and
estimates the tempo (BPM) of ambient music using a simple energy-based beat
detector, then writes the current estimate to a state file that
website-backend reads and serves to the BPM visualizer display panel.

Algorithm: compares each audio chunk's energy against a rolling local
average. A chunk that exceeds the average by BEAT_THRESHOLD_MULTIPLIER
counts as a beat, subject to a debounce window. BPM is the median of the
most recent inter-beat intervals, which is more robust to a single missed
or double-triggered beat than a plain average would be.

We tried aubio (a purpose-built beat tracking library) first, but its last
release (2018) doesn't build against any numpy/gcc combination available on
Python 3.13 -- a real C-API incompatibility, not a version mismatch we could
pin around. This hand-rolled detector needs only numpy.
"""

import json
import logging
import statistics
import subprocess
import time
from pathlib import Path

import numpy as np

logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S"
)
logger = logging.getLogger(__name__)


# ---- audio capture ----

# USB mic on fart-pi (TI PCM2902 codec) -- card index can shift if other USB
# audio devices are added/removed, verify with `arecord -l`
ALSA_DEVICE = "plughw:3,0"
SAMPLE_RATE_HZ = 44100
CHUNK_SAMPLES = 1024  # ~23ms per chunk at 44100Hz
BYTES_PER_SAMPLE = 2  # S16_LE


# ---- beat detection ----

# local average energy window (s) -- the baseline a chunk's energy is compared against
ENERGY_WINDOW_S = 1.0
ENERGY_WINDOW_CHUNKS = int(ENERGY_WINDOW_S * SAMPLE_RATE_HZ / CHUNK_SAMPLES)

# a chunk counts as a beat when its energy exceeds the local average by this factor
BEAT_THRESHOLD_MULTIPLIER = 2.5

# minimum gap between detected beats (s) -- debounce, caps detectable tempo at 200 BPM
MIN_BEAT_INTERVAL_S = 0.3

# ignore gaps longer than this when estimating tempo (s) -- corresponds to a 30 BPM floor
MAX_BEAT_INTERVAL_S = 2.0

# how many recent inter-beat intervals to use for the BPM estimate
BEAT_HISTORY_COUNT = 8

# if no beat has landed in this long, report "no signal" instead of a stale BPM
STALE_THRESHOLD_S = 3.0


# ---- output ----

STATE_FILE = Path(__file__).parent / "state" / "bpm_state.json"


def start_capture() -> subprocess.Popen:
    """Launch arecord streaming raw PCM from the USB mic to stdout.

    Returns:
        The running arecord subprocess. Its stdout yields raw S16_LE mono
        samples at SAMPLE_RATE_HZ.
    """
    return subprocess.Popen(
        [
            "arecord", "-D", ALSA_DEVICE,
            "-f", "S16_LE", "-r", str(SAMPLE_RATE_HZ), "-c", "1",
            "-t", "raw",
        ],
        stdout=subprocess.PIPE,
    )


def read_chunk(proc: subprocess.Popen) -> np.ndarray:
    """Read one fixed-size chunk of samples from the capture process.

    Blocks until CHUNK_SAMPLES samples are available or the stream ends.

    Args:
        proc: The arecord subprocess started by start_capture().

    Returns:
        int16 numpy array of CHUNK_SAMPLES samples (fewer, or empty, at EOF).
    """
    raw = proc.stdout.read(CHUNK_SAMPLES * BYTES_PER_SAMPLE)
    return np.frombuffer(raw, dtype=np.int16)


def chunk_energy(chunk: np.ndarray) -> float:
    """Compute the mean-square energy of an audio chunk.

    Args:
        chunk: int16 samples.

    Returns:
        Mean of squared sample values. Unnormalized -- only meaningful as a
        relative comparison against the rolling local average.
    """
    return float(np.mean(chunk.astype(np.float64) ** 2))


def estimate_bpm(beat_times: list[float]) -> float | None:
    """Estimate BPM from recent beat timestamps.

    Args:
        beat_times: Monotonic timestamps of detected beats, oldest first.

    Returns:
        Estimated BPM, or None if there aren't enough recent beats yet.
    """
    if len(beat_times) < 3:
        return None
    intervals = [b - a for a, b in zip(beat_times[:-1], beat_times[1:])]
    intervals = [i for i in intervals if i <= MAX_BEAT_INTERVAL_S]
    if len(intervals) < 2:
        return None
    median_interval = statistics.median(intervals[-BEAT_HISTORY_COUNT:])
    return 60.0 / median_interval


def write_state(bpm: float | None) -> None:
    """Write the current BPM estimate to the state file, atomically.

    Args:
        bpm: Current BPM estimate, or None if there's no signal.

    Side effects:
        Writes STATE_FILE via a temp file + rename, so a concurrent reader
        (website-backend) never sees a half-written file.
    """
    payload = {"bpm": round(bpm, 1) if bpm is not None else None, "updated_at": time.time()}
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = STATE_FILE.with_suffix(".tmp")
    tmp_path.write_text(json.dumps(payload))
    tmp_path.replace(STATE_FILE)


def main() -> None:
    """Run the capture and beat detection loop forever.

    Side effects:
        Blocks. Writes STATE_FILE on every detected beat and again once the
        signal goes stale (no beat for STALE_THRESHOLD_S).
    """
    logger.info("Starting capture on %s at %d Hz", ALSA_DEVICE, SAMPLE_RATE_HZ)
    proc = start_capture()

    # background-only energy history -- chunks classified as "above threshold"
    # are excluded so a beat's own loudness doesn't drag up the baseline it's
    # compared against
    energy_history: list[float] = []
    beat_times: list[float] = []
    last_beat_time = 0.0
    reported_stale = True
    was_above_threshold = False
    chunks_since_debug_log = 0

    try:
        while True:
            chunk = read_chunk(proc)
            if chunk.size == 0:
                logger.error("arecord produced no data -- is the mic still connected?")
                break

            energy = chunk_energy(chunk)
            now = time.monotonic()

            local_avg = statistics.mean(energy_history) if energy_history else energy
            ratio = energy / local_avg if local_avg > 0 else 0.0
            is_above_threshold = ratio > BEAT_THRESHOLD_MULTIPLIER

            # edge-triggered: only the rising edge counts as a beat, so a
            # click's decaying tail staying above threshold for a couple
            # chunks doesn't register as several beats
            is_beat = (
                is_above_threshold
                and not was_above_threshold
                and now - last_beat_time >= MIN_BEAT_INTERVAL_S
            )
            was_above_threshold = is_above_threshold

            if not is_above_threshold:
                energy_history.append(energy)
                if len(energy_history) > ENERGY_WINDOW_CHUNKS:
                    energy_history.pop(0)

            if is_beat:
                last_beat_time = now
                beat_times.append(now)
                if len(beat_times) > BEAT_HISTORY_COUNT + 1:
                    beat_times.pop(0)

                bpm = estimate_bpm(beat_times)
                if bpm is not None:
                    logger.info("Beat detected (ratio %.1fx) -- BPM estimate: %.1f", ratio, bpm)
                    write_state(bpm)
                    reported_stale = False

            # periodic diagnostic line (~once/s) so the current energy ratio is
            # visible even between beats -- useful for picking a threshold
            chunks_since_debug_log += 1
            if chunks_since_debug_log >= ENERGY_WINDOW_CHUNKS:
                chunks_since_debug_log = 0
                logger.debug("current ratio: %.2fx (threshold %.1fx)", ratio, BEAT_THRESHOLD_MULTIPLIER)

            elif not reported_stale and now - last_beat_time > STALE_THRESHOLD_S:
                logger.info("No beat in %.0fs -- reporting no signal", STALE_THRESHOLD_S)
                write_state(None)
                beat_times.clear()
                reported_stale = True

    finally:
        proc.terminate()


if __name__ == "__main__":
    main()
