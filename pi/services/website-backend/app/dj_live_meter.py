"""
The live set's loudness, measured as it streams, for the Opium Den's live monitor.

A recorded set's waveform (app/dj_waveform.py) is worked out from its mp3 once it ends.
While it's still on, this listens to the icecast stream with its own ffmpeg, the meter,
and has it print the stream's RMS level every LEVEL_INTERVAL_S, measured exactly like the
waveform (same filter, same parsing), so the live trace and the finished set look alike.

The meter is its own ffmpeg on purpose, apart from the recorder: if it fails, the recording
doesn't, and the watcher (app/dj_stream.py) starts it again. Each level is placed by the
stream time ffmpeg stamps on it, plus how far into the set that ffmpeg started, so a
restart leaves a gap where it was down instead of shifting everything after.

Levels are kept in memory for the set that's on (a few hours is tens of thousands of
floats) and dropped when it ends; by then the recording's own waveform takes over. See
pi/docs/services/dj-stream.md.
"""

import asyncio
import logging
import math
import time

from app.dj_waveform import ANALYSIS_SAMPLE_RATE_HZ, normalize_peaks, parse_rms_line, rms_filter

logger = logging.getLogger(__name__)

# one level per second: plenty for a trace a few hundred pixels wide covering hours
LEVEL_INTERVAL_S = 1.0
SAMPLES_PER_LEVEL = int(ANALYSIS_SAMPLE_RATE_HZ * LEVEL_INTERVAL_S)
# the most bars /dj/live/trace sends. a longer set is squeezed, each bar the loudest of its stretch
MAX_TRACE_BARS = 600
# ffmpeg stops within a second of SIGTERM; past this it gets killed
METER_STOP_TIMEOUT_S = 5.0
# printed by ametadata before each level: the chunk's time in the stream, in seconds
PTS_TIME_MARKER = "pts_time:"


def parse_pts_time(line: str) -> float | None:
    """
    Reads the stream time off one of ametadata's "frame:3 pts:24000 pts_time:3" lines.

    Args:
        line: One line of the meter's log.

    Returns:
        float | None: Seconds into the stream, or None when the line hasn't got one.
    """
    start = line.find(PTS_TIME_MARKER)
    if start < 0:
        return None
    raw = line[start + len(PTS_TIME_MARKER):].split()
    try:
        return float(raw[0]) if raw else None
    except ValueError:
        return None


def squeeze_levels(levels: list[float], max_bars: int) -> tuple[list[float], int]:
    """
    Fits the levels into at most max_bars, each the loudest of its stretch.

    Args:
        levels: One level per LEVEL_INTERVAL_S.
        max_bars: The most bars wanted.

    Returns:
        tuple[list[float], int]: The bars, and how many levels went into each.
    """
    per_bar = max(1, math.ceil(len(levels) / max_bars))
    bars = [max(levels[i:i + per_bar]) for i in range(0, len(levels), per_bar)]
    return bars, per_bar


class LiveMeter:
    """
    Measures the live stream's loudness while a set's on.

    The watcher calls begin_set when a recording starts, start to (re)start the meter's
    ffmpeg, stop to stop it, and end_set when the set's over. The router reads trace.
    """

    def __init__(self) -> None:
        self._levels: list[float] = []
        # when the set began, on the monotonic clock. None between sets
        self._set_origin: float | None = None
        self._process: asyncio.subprocess.Process | None = None
        self._reader: asyncio.Task | None = None
        # monotonic time of the last start, so a meter that keeps failing isn't respawned every poll
        self.last_started: float | None = None

    @property
    def running(self) -> bool:
        """whether the meter's ffmpeg is up."""
        return self._process is not None and self._process.returncode is None

    @property
    def in_set(self) -> bool:
        """whether a set's being measured (begin_set without end_set yet)."""
        return self._set_origin is not None

    def begin_set(self) -> None:
        """
        Starts a fresh trace for a new set.

        Side effects:
            Clears any levels left from before.
        """
        self._levels = []
        self._set_origin = time.monotonic()

    def end_set(self) -> None:
        """
        Drops the trace once the set's over. Its recording's waveform takes over from here.

        Side effects:
            Clears the levels.
        """
        self._levels = []
        self._set_origin = None

    async def start(self, source_url: str) -> None:
        """
        Starts the meter's ffmpeg listening to the stream, if it isn't running already.

        Args:
            source_url: The stream to measure, like the icecast mount.

        Side effects:
            Spawns ffmpeg and a task reading its log. Logs and gives up quietly when ffmpeg
            can't start; the watcher tries again later.
        """
        if self.running or self._set_origin is None:
            return
        self.last_started = time.monotonic()
        # where this ffmpeg's stream time 0 falls in the set, so its levels land in the right place
        offset_s = self.last_started - self._set_origin
        try:
            process = await asyncio.create_subprocess_exec(
                "ffmpeg", "-nostdin", "-hide_banner", "-nostats",
                # info, so ametadata's prints (logged at info) come through on stderr, line by line
                "-loglevel", "info",
                "-i", source_url,
                "-vn", "-ac", "1", "-af", rms_filter(SAMPLES_PER_LEVEL, ""),
                "-f", "null", "-",
                stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )
        except OSError as err:
            logger.error(f"dj meter: couldn't start ffmpeg on {source_url} ({err}). is ffmpeg in the image?")
            return
        self._process = process
        self._reader = asyncio.create_task(self._read_levels(process, offset_s))
        logger.info(f"dj meter: measuring {source_url} from {offset_s:.0f} s into the set")

    async def stop(self) -> None:
        """
        Stops the meter's ffmpeg and waits for its log to be read out. Does nothing when
        it isn't running.
        """
        process, reader = self._process, self._reader
        self._process, self._reader = None, None
        if process is None:
            return
        if process.returncode is None:
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), METER_STOP_TIMEOUT_S)
            except TimeoutError:
                logger.warning(f"dj meter: ffmpeg didn't stop within {METER_STOP_TIMEOUT_S} s, killing it")
                process.kill()
                await process.wait()
        if reader is not None:
            await reader

    def trace(self) -> tuple[float, list[float]]:
        """
        The set so far, for /dj/live/trace.

        Returns:
            tuple[float, list[float]]: How many seconds each bar covers, and the bars, 0 to
                1 (1 is the loudest moment so far), oldest first. No bars between sets or
                before the first level's in.
        """
        bars, per_bar = squeeze_levels(self._levels, MAX_TRACE_BARS)
        return LEVEL_INTERVAL_S * per_bar, normalize_peaks(bars)

    def _record(self, at_s: float, level: float) -> None:
        """
        Puts a level at its moment in the set, filling any gap before it with silence.

        Args:
            at_s: Seconds into the set.
            level: Linear amplitude.
        """
        index = max(0, int(at_s / LEVEL_INTERVAL_S))
        if index >= len(self._levels):
            self._levels.extend([0.0] * (index + 1 - len(self._levels)))
        self._levels[index] = max(self._levels[index], level)

    async def _read_levels(self, process: asyncio.subprocess.Process, offset_s: float) -> None:
        """
        Reads the meter's log until it exits: each "pts_time" line says when the next level
        is from, and each level line is recorded there. Anything else ffmpeg says is logged.

        Args:
            process: The meter's ffmpeg.
            offset_s: How far into the set its stream time 0 is.
        """
        if process.stderr is None:
            return
        pts_s = 0.0
        async for raw in process.stderr:
            line = raw.decode(errors="replace").rstrip()
            pts = parse_pts_time(line)
            if pts is not None:
                pts_s = pts
                continue
            level = parse_rms_line(line)
            if level is not None:
                if self._set_origin is not None:
                    self._record(offset_s + pts_s, level)
                continue
            # the input's details on startup, and "ends prematurely" when the set ends
            logger.debug(f"dj meter: ffmpeg: {line}")
        await process.wait()
        if process.returncode not in (0, None):
            logger.info(f"dj meter: ffmpeg exited with {process.returncode}")
