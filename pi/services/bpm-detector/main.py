"""
BPM detector service.

Runs on fart-pi as a systemd service. Continuously listens to a USB mic and
estimates the tempo (BPM) of ambient music, writing the current estimate to
a state file that website-backend reads and serves to the BPM visualizer
display panel.

Uses librosa: a rolling audio buffer is periodically analyzed with a
bass-focused onset strength envelope (the kick/bass carries the beat far
more reliably than broadband energy, which picks up hi-hats/vocals/cymbals
at the wrong rate) and librosa's autocorrelation-based tempo estimator.
Each estimate's tempo prior is centered on the previous accepted BPM, which
gives continuity between windows and damps octave errors (locking onto 2x
or 0.5x the real tempo) -- a known hard problem in all beat trackers, not
something any single technique eliminates outright.

We tried a from-scratch energy-threshold detector first (too easily
confused by room echo and non-bass transients) and aubio before that
(doesn't build against any numpy/gcc combination on Python 3.13). This
replaces both.
"""

import json
import logging
import subprocess
import time
import warnings
from pathlib import Path

import librosa
import librosa.feature.rhythm as rhythm
import numpy as np

# librosa warns about empty mel filter bins at our narrow bass-only
# frequency range -- expected and harmless, we don't use the full-spectrum
# bins it's warning about
warnings.filterwarnings("ignore", message="Empty filters detected")

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S"
)
logger = logging.getLogger(__name__)


# ---- audio capture ----

# USB mic on fart-pi (TI PCM2902 codec) -- card index can shift if other USB
# audio devices are added/removed, verify with `arecord -l`
ALSA_DEVICE = "plughw:3,0"
SAMPLE_RATE_HZ = 44100
CHUNK_SAMPLES = 4096  # read size from arecord's pipe -- just I/O granularity
BYTES_PER_SAMPLE = 2  # S16_LE


# ---- rolling buffer + analysis cadence ----

# how much recent audio each tempo estimate is based on -- long enough to
# span several beats at typical tempos, matches librosa's own
# autocorrelation window default (ac_size)
BUFFER_DURATION_S = 8.0
BUFFER_SAMPLES = int(BUFFER_DURATION_S * SAMPLE_RATE_HZ)

# how often to re-run tempo analysis on the current buffer
ANALYSIS_INTERVAL_S = 2.0

# below this RMS (int16 scale), treat the room as silent rather than report
# a meaningless tempo guess off the noise floor -- a starting point, likely
# needs tuning against the real room/speaker volume
SILENCE_RMS_THRESHOLD = 800


# ---- bass-focused onset detection ----
#
# the beat is far more reliably carried by the kick/bass than by broadband
# energy, which picks up hi-hats, vocals, and cymbals at the wrong rate.
# Restricting onset detection to a narrow low mel range isolates it.
ONSET_FMIN_HZ = 20
ONSET_FMAX_HZ = 150
ONSET_N_MELS = 16


# ---- tempo estimation ----

# librosa's tempo prior is a log-normal centered on start_bpm with this std
# (in BPM). Feeding the previous estimate back in as start_bpm gives
# continuity between analysis windows and damps octave jumps, without
# locking so tight (a small std) that a genuine tempo change can't move it
DEFAULT_START_BPM = 120.0
TEMPO_PRIOR_STD_BPM = 2.0
MAX_TEMPO_BPM = 200.0


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


def estimate_bpm(buffer: np.ndarray, previous_bpm: float | None) -> float | None:
    """Estimate BPM from a buffer of recent audio.

    Args:
        buffer: int16 samples, up to BUFFER_SAMPLES long.
        previous_bpm: The last accepted estimate, used as this call's tempo
            prior center for continuity. None on the very first call.

    Returns:
        Estimated BPM, or None if the buffer is too quiet to mean anything.
    """
    rms = float(np.sqrt(np.mean(buffer.astype(np.float64) ** 2)))
    if rms < SILENCE_RMS_THRESHOLD:
        return None

    y = buffer.astype(np.float32) / 32768.0
    onset_env = librosa.onset.onset_strength(
        y=y, sr=SAMPLE_RATE_HZ, fmin=ONSET_FMIN_HZ, fmax=ONSET_FMAX_HZ, n_mels=ONSET_N_MELS
    )
    start_bpm = previous_bpm if previous_bpm is not None else DEFAULT_START_BPM
    tempo = rhythm.tempo(
        onset_envelope=onset_env,
        sr=SAMPLE_RATE_HZ,
        start_bpm=start_bpm,
        std_bpm=TEMPO_PRIOR_STD_BPM,
        max_tempo=MAX_TEMPO_BPM,
    )
    return float(tempo[0])


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
    """Run the capture and periodic tempo analysis loop forever.

    Side effects:
        Blocks. Writes STATE_FILE roughly every ANALYSIS_INTERVAL_S seconds.
    """
    logger.info("Starting capture on %s at %d Hz", ALSA_DEVICE, SAMPLE_RATE_HZ)
    proc = start_capture()

    buffer = np.zeros(0, dtype=np.int16)
    previous_bpm: float | None = None
    last_analysis_time = 0.0

    try:
        while True:
            chunk = read_chunk(proc)
            if chunk.size == 0:
                logger.error("arecord produced no data -- is the mic still connected?")
                break

            buffer = np.concatenate([buffer, chunk])[-BUFFER_SAMPLES:]

            now = time.monotonic()
            enough_buffered = buffer.size >= BUFFER_SAMPLES // 2
            if now - last_analysis_time < ANALYSIS_INTERVAL_S or not enough_buffered:
                continue
            last_analysis_time = now

            bpm = estimate_bpm(buffer, previous_bpm)
            if bpm is None:
                if previous_bpm is not None:
                    logger.info("No signal -- reporting no signal")
                write_state(None)
                previous_bpm = None
                continue

            logger.info("BPM estimate: %.1f", bpm)
            write_state(bpm)
            previous_bpm = bpm

    finally:
        proc.terminate()


if __name__ == "__main__":
    main()
