"""
Waveforms for recorded dj sets, the soundcloud-style bars the set page draws.

ffmpeg does all the number crunching: it decodes the mp3 to low-rate mono, cuts it into
WAVEFORM_BUCKETS equal chunks and prints each chunk's RMS level (astats). Python just
reads those levels, turns them from dB into amplitudes and scales them so the loudest
chunk is 1. A two hour set takes a few seconds on the pi, so the result is cached as json
next to the mp3 (`<set>.waveform.json`) and only worked out once per set: when the set
finishes recording, or the first time someone asks for it.

The live meter (app/dj_live_meter.py) measures the stream the same way while it's on, with
rms_filter and parse_rms_line, so the live trace and the finished waveform look alike.
"""

import asyncio
import json
import logging
import math
from pathlib import Path

logger = logging.getLogger(__name__)

# how many bars the whole set gets. plenty for a wide screen, small enough to send in one go
WAVEFORM_BUCKETS = 1000
# loudness doesn't need full quality, and decoding to a low rate keeps it quick
ANALYSIS_SAMPLE_RATE_HZ = 8000
WAVEFORM_SUFFIX = ".waveform.json"
RMS_METADATA_KEY = "lavfi.astats.Overall.RMS_level"
DB_PER_AMPLITUDE_DECADE = 20
# three decimals is more detail than a few-pixel bar can show
PEAK_DECIMALS = 3

# one analysis at a time: a set page opened by several people at once shouldn't start
# several ffmpegs on the same file
_analysis_lock = asyncio.Lock()


class WaveformError(Exception):
    """ffmpeg couldn't read the set's mp3, so there's no waveform for it."""


def waveform_path(audio_path: Path) -> Path:
    """
    Where a set's cached waveform lives.

    Args:
        audio_path: The set's mp3.

    Returns:
        Path: Next to it, like 2026-11-18_20-55-00.waveform.json.
    """
    return audio_path.with_suffix(WAVEFORM_SUFFIX)


def rms_filter(samples_per_chunk: int, print_target: str) -> str:
    """
    The ffmpeg audio filter that cuts mono audio into equal chunks and prints each one's
    RMS level.

    Args:
        samples_per_chunk: How many samples (at ANALYSIS_SAMPLE_RATE_HZ) go in a chunk.
        print_target: ametadata's print options after the key, like ":file=-" to print to
            stdout, or "" to print to ffmpeg's log (stderr).

    Returns:
        str: The -af filter chain.
    """
    return (
        f"aresample={ANALYSIS_SAMPLE_RATE_HZ},"
        f"asetnsamples=n={samples_per_chunk},"
        "astats=metadata=1:reset=1:measure_overall=RMS_level:measure_perchannel=none,"
        f"ametadata=print:key={RMS_METADATA_KEY}{print_target}"
    )


def parse_rms_line(line: str) -> float | None:
    """
    Reads one chunk's RMS level from a line ffmpeg's ametadata printed.

    Args:
        line: One line of output. The level can be anywhere in it, since printed to the
            log it comes after a "[Parsed_ametadata_3 @ 0x...]" prefix.

    Returns:
        float | None: The level as a linear amplitude (0 for silence), or None when the
            line isn't a level.
    """
    prefix = f"{RMS_METADATA_KEY}="
    start = line.find(prefix)
    if start < 0:
        return None
    try:
        db = float(line[start + len(prefix):].strip())  # "-inf" parses to -inf, which comes out as 0
    except ValueError:
        return None
    return 10 ** (db / DB_PER_AMPLITUDE_DECADE) if math.isfinite(db) else 0.0


def parse_rms_levels(ffmpeg_output: str) -> list[float]:
    """
    Pulls the per-chunk RMS levels out of ffmpeg's ametadata print.

    Args:
        ffmpeg_output: What ffmpeg printed, alternating "frame:..." lines and
            "lavfi.astats.Overall.RMS_level=-23.4" lines.

    Returns:
        list[float]: Each chunk's level as a linear amplitude (0 for silence), in order.
    """
    levels = (parse_rms_line(line) for line in ffmpeg_output.splitlines())
    return [level for level in levels if level is not None]


def normalize_peaks(levels: list[float]) -> list[float]:
    """
    Scales the levels so the loudest is 1.

    Args:
        levels: Linear amplitudes.

    Returns:
        list[float]: Each between 0 and 1, rounded. All zeros for a silent set.
    """
    loudest = max(levels, default=0.0)
    if loudest <= 0:
        return [0.0 for _ in levels]
    return [round(level / loudest, PEAK_DECIMALS) for level in levels]


async def analyze(audio_path: Path, duration_s: int) -> list[float]:
    """
    Runs ffmpeg over the mp3 and works out its waveform.

    Args:
        audio_path: The set's mp3.
        duration_s: Its length, to size the chunks so there are about WAVEFORM_BUCKETS.

    Returns:
        list[float]: The peaks, 0 to 1, evenly spread over the set.

    Raises:
        WaveformError: ffmpeg failed or printed no levels.
    """
    samples_per_bucket = max(1, math.ceil(duration_s * ANALYSIS_SAMPLE_RATE_HZ / WAVEFORM_BUCKETS))
    audio_filter = rms_filter(samples_per_bucket, ":file=-")
    process = await asyncio.create_subprocess_exec(
        "ffmpeg", "-nostdin", "-loglevel", "error",
        "-i", str(audio_path),
        "-ac", "1", "-af", audio_filter, "-f", "null", "-",
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()
    levels = parse_rms_levels(stdout.decode(errors="replace"))
    if process.returncode != 0 or not levels:
        detail = stderr.decode(errors="replace").strip() or "no levels printed"
        raise WaveformError(f"ffmpeg couldn't analyze {audio_path.name} (exit {process.returncode}): {detail}")
    return normalize_peaks(levels)


async def get_waveform(audio_path: Path, duration_s: int) -> list[float]:
    """
    A set's waveform, from the cache, or worked out and cached now.

    Args:
        audio_path: The set's mp3.
        duration_s: Its length in seconds.

    Returns:
        list[float]: The peaks, 0 to 1, evenly spread over the set.

    Raises:
        WaveformError: ffmpeg couldn't read the mp3.

    Side effects:
        Writes `<set>.waveform.json` next to the mp3 the first time.
    """
    cache = waveform_path(audio_path)
    async with _analysis_lock:
        # whoever held the lock may have just written it
        if cache.exists():
            try:
                return json.loads(cache.read_text())
            except (OSError, ValueError) as err:
                logger.warning(f"dj waveform: {cache.name} is unreadable ({err}), working it out again")
        peaks = await analyze(audio_path, duration_s)
        cache.write_text(json.dumps(peaks))
        logger.info(f"dj waveform: analyzed {audio_path.name}, {len(peaks)} bars")
        return peaks


async def prepare_waveform(audio_path: Path, duration_s: int) -> None:
    """
    Works out a freshly finished set's waveform ahead of time, so its first listener
    doesn't wait. Failing is fine: the set page asks again and gets a proper error.

    Args:
        audio_path: The set's mp3.
        duration_s: Its length in seconds.
    """
    try:
        await get_waveform(audio_path, duration_s)
    except (WaveformError, OSError) as err:
        logger.warning(f"dj waveform: couldn't prepare {audio_path.name} ahead of time ({err}), it'll be tried on request")
