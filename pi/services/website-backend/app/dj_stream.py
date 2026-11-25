"""
The live dj stream: watches icecast, records each session, and counts who's listening.

butt on the dj laptop sends to icecast (pi/services/dj-stream): Tyler to DJ_STREAM_MOUNT,
each guest dj to their own mount. Icecast only takes one source at a time, so at most one
mount is live. This polls icecast's status every few seconds. When a known mount goes live
it starts ffmpeg copying the stream into an mp3 under DJ_SETS_DIR and adds a dj_sets row
(plus a dj_set_guests row when it's a guest's mount). When the source goes away, ffmpeg
sees the stream end (or gets stopped), and the row gets its end time, length and size.
Sessions shorter than MIN_SET_DURATION_S, like a bump of the mixer tripping butt's auto
start, get thrown away. While a set records, the live meter (app/dj_live_meter.py) measures
its loudness for the site's live trace.

There's one watcher per process (`watcher`), started from main.py's lifespan. The server
runs a single uvicorn worker, so that's one recorder. See pi/docs/services/dj-stream.md.
"""

import asyncio
import logging
import time
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlparse

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.dj_live_meter import LiveMeter
from app.dj_room import live_room
from app.dj_waveform import prepare_waveform
from app.image_utils import delete_photo_files
from app.kiln_firings import utc_now_naive
from app.models import DjGuest, DjSet, DjSetGuest, DjSetImage
from app.schemas import DjStreamStatus

logger = logging.getLogger(__name__)

# how often icecast gets asked whether anyone's on air. sets the lag between butt
# connecting and the site showing live, and between it dropping and the recording ending
POLL_INTERVAL_S = 3.0
STATUS_TIMEOUT_S = 2.0
# shorter than this and it was a test or an accidental auto start, not a set
MIN_SET_DURATION_S = 120
# ffmpeg finishes the file within a second of SIGTERM; past this it gets killed
FFMPEG_STOP_TIMEOUT_S = 10.0
ICECAST_STATUS_PATH = "/status-json.xsl"
ICECAST_START_TIME_FORMAT = "%Y-%m-%dT%H:%M:%S%z"
SET_FILENAME_FORMAT = "%Y-%m-%d_%H-%M-%S.mp3"
# cover images sit next to the recordings, so they're on the same ssd and mount
SET_IMAGES_SUBDIR = "images"
# a meter that died mid-set is started again, but no more often than this, so one that
# can't run doesn't respawn every poll
METER_RETRY_S = 30.0


def guest_mount_path(mount: str) -> str:
    """
    A guest's mount as icecast names it.

    Args:
        mount: The mount as a DjGuest stores it, like "tracepoint".

    Returns:
        str: Like "/tracepoint".
    """
    return f"/{mount}"


def known_mounts() -> dict[str, int | None]:
    """
    Every mount whose stream counts as a set: Tyler's, and each active guest's.

    Returns:
        dict[str, int | None]: Mount path (like "/live") to the guest's id, None for Tyler's.
    """
    with SessionLocal() as db:
        guests = db.query(DjGuest.mount, DjGuest.id).filter(DjGuest.is_active.is_(True)).all()
    mounts: dict[str, int | None] = {guest_mount_path(mount): guest_id for mount, guest_id in guests}
    mounts[settings.DJ_STREAM_MOUNT] = None
    return mounts


def source_mount(source: dict) -> str:
    """
    Which mount a source in icecast's status is on.

    Args:
        source: A source entry from icecast's status.

    Returns:
        str: Its path, like "/live", or "" if icecast didn't say.
    """
    return urlparse(str(source.get("listenurl", ""))).path


def find_live_source(icecast_status: dict, mounts: dict[str, int | None]) -> dict | None:
    """
    Picks the first of our mounts that's on air out of icecast's status json. Anything
    on a mount we don't know is ignored.

    Icecast leaves `source` out when nothing's connected, gives an object for one
    source, and a list for several.

    Args:
        icecast_status: The parsed body of /status-json.xsl.
        mounts: The mounts that count (known_mounts).

    Returns:
        The source entry, or None if none of them are on air.
    """
    sources = icecast_status.get("icestats", {}).get("source")
    if sources is None:
        return None
    if isinstance(sources, dict):
        sources = [sources]
    for source in sources:
        if source_mount(source) in mounts:
            return source
    return None


def parse_stream_start(source: dict) -> datetime | None:
    """
    When butt connected, as naive UTC like every other time in the database.

    Args:
        source: A source entry from icecast's status.

    Returns:
        The start time, or None if icecast didn't give a readable one.
    """
    raw = source.get("stream_start_iso8601")
    if not raw:
        return None
    try:
        started = datetime.strptime(raw, ICECAST_START_TIME_FORMAT)
    except ValueError:
        logger.warning(f"dj stream: couldn't read icecast's start time {raw!r}, leaving it blank")
        return None
    return started.astimezone(UTC).replace(tzinfo=None)


def set_images_dir() -> Path:
    """
    Where sets' cover images are kept, a folder per set.

    Returns:
        Path: DJ_SETS_DIR/images.
    """
    return Path(settings.DJ_SETS_DIR) / SET_IMAGES_SUBDIR


def delete_set_image_files(image: DjSetImage | None) -> None:
    """
    Removes a cover image's files from disk. The caller deletes (or replaces) the row.

    Args:
        image: The image, or None when the set hasn't got one (then this does nothing).
    """
    if image is not None:
        delete_photo_files(set_images_dir(), image.file_path, image.thumbnail_path)


def finalize_set(db: Session, dj_set: DjSet, ended_at: datetime) -> bool:
    """
    Finishes a set's row once its recording has stopped, or throws it away if it's too short.

    Args:
        db: Database session. Committed here.
        dj_set: The set that was recording.
        ended_at: When the recording stopped (naive UTC).

    Returns:
        bool: True if the set was kept, False if it was thrown away.

    Side effects:
        Deletes the row, its mp3 and any cover image for a too-short or empty recording.
    """
    path = Path(dj_set.file_path)
    duration_s = int((ended_at - dj_set.started_at).total_seconds())
    size_bytes = path.stat().st_size if path.exists() else 0

    if duration_s < MIN_SET_DURATION_S or size_bytes == 0:
        path.unlink(missing_ok=True)
        delete_set_image_files(dj_set.image)
        db.delete(dj_set)
        db.commit()
        logger.info(f"dj stream: discarded {path.name}, only {duration_s} s / {size_bytes} bytes")
        return False

    dj_set.ended_at = ended_at
    dj_set.duration_s = duration_s
    dj_set.size_bytes = size_bytes
    db.commit()
    logger.info(f"dj stream: saved {path.name}, {duration_s} s, {size_bytes} bytes")
    return True


def finish_interrupted_sets() -> None:
    """
    Finishes sets that were still recording when the backend last stopped.

    ffmpeg dies with the container, so the file just ends wherever it got to. Its
    last-modified time is when that was.

    Side effects:
        Updates or deletes dj_sets rows (and too-short files).
    """
    with SessionLocal() as db:
        interrupted = db.query(DjSet).filter(DjSet.ended_at.is_(None)).all()
        for dj_set in interrupted:
            path = Path(dj_set.file_path)
            if path.exists():
                ended_at = datetime.fromtimestamp(path.stat().st_mtime, UTC).replace(tzinfo=None)
            else:
                ended_at = dj_set.started_at
            logger.info(f"dj stream: finishing {path.name}, cut off by a backend restart")
            finalize_set(db, dj_set, ended_at)


async def log_ffmpeg_output(process: asyncio.subprocess.Process, set_name: str) -> None:
    """
    Logs what ffmpeg prints, and keeps its stderr pipe from filling up and stalling it.

    Info, not warning: every set ends with ffmpeg complaining the stream "ends
    prematurely", since a live stream has no length. That's the normal way out.

    Args:
        process: The recording ffmpeg.
        set_name: The mp3's filename, so the log says which recording.
    """
    if process.stderr is None:
        return
    async for line in process.stderr:
        logger.info(f"dj stream: ffmpeg ({set_name}): {line.decode(errors='replace').rstrip()}")


class DjStreamWatcher:
    """
    Keeps track of whether the stream is live, and records it while it is.

    Attributes:
        live: Whether icecast had one of our mounts on air at the last poll.
        mount: Which mount that was, like "/live", None when not live.
        guest_id: The guest dj whose mount it is, None for Tyler's (or when not live).
        started_at: When butt connected (naive UTC), None when not live.
        listeners: How many people the public relay (/dj/live) is serving.
        meter: The live set's loudness, for /dj/live/trace.
    """

    def __init__(self) -> None:
        self.live = False
        self.mount: str | None = None
        self.guest_id: int | None = None
        self.started_at: datetime | None = None
        self.listeners = 0
        self._recorder: asyncio.subprocess.Process | None = None
        # the mount being recorded, so a hand-over to another dj between polls is caught
        self._recording_mount: str | None = None
        self._recorder_output: asyncio.Task | None = None
        self._set_id: int | None = None
        self._icecast_unreachable = False
        # held so the finished set's waveform analysis isn't garbage collected mid-run
        self._waveform_task: asyncio.Task | None = None
        self.meter = LiveMeter()

    def stream_url(self) -> str:
        """
        Where the live mount is on the docker network.

        Returns:
            str: Like http://dj-stream-icecast:8000/live. Tyler's mount when nothing's live.
        """
        return f"{settings.ICECAST_URL}{self.mount or settings.DJ_STREAM_MOUNT}"

    @property
    def recording_set_id(self) -> int | None:
        """the dj_sets row being recorded right now, None when nothing is."""
        return self._set_id if self._recorder is not None else None

    def status(self) -> DjStreamStatus:
        """
        What /dj/status reports, less the cover image (the router looks that up).

        Returns:
            DjStreamStatus: live, since when, how many are listening, and the set being recorded.
        """
        return DjStreamStatus(
            live=self.live,
            started_at=self.started_at,
            listeners=self.listeners,
            set_id=self.recording_set_id,
        )

    async def run(self) -> None:
        """
        Polls icecast until cancelled (on shutdown), then finishes any recording in progress.

        Side effects:
            Starts and stops ffmpeg, writes dj_sets rows and files under DJ_SETS_DIR.
        """
        Path(settings.DJ_SETS_DIR).mkdir(parents=True, exist_ok=True)
        finish_interrupted_sets()
        async with httpx.AsyncClient(timeout=STATUS_TIMEOUT_S) as client:
            try:
                while True:
                    try:
                        await self._tick(client)
                    except Exception:
                        logger.exception("dj stream: poll failed, trying again next round")
                    await asyncio.sleep(POLL_INTERVAL_S)
            finally:
                await self._stop_recording()

    async def _tick(self, client: httpx.AsyncClient) -> None:
        """
        One poll: refresh live state, then start, stop or finish the recording to match.

        Args:
            client: Shared http client for icecast.
        """
        mounts = known_mounts()
        source = await self._fetch_source(client, mounts)
        self.live = source is not None
        self.mount = source_mount(source) if source else None
        self.guest_id = mounts.get(self.mount) if self.mount else None
        self.started_at = parse_stream_start(source) if source else None

        # ffmpeg exits on its own when icecast ends the stream
        if self._recorder is not None and self._recorder.returncode is not None:
            await self._finish_recording()
        # one dj stopped and the next started between polls: that's two sets
        if self._recorder is not None and self.live and self.mount != self._recording_mount:
            logger.info(f"dj stream: {self._recording_mount} handed over to {self.mount}, starting a new set")
            await self._stop_recording()

        if self.live and self._recorder is None:
            await self._start_recording()
        elif not self.live and self._recorder is not None:
            await self._stop_recording()
        elif self._recorder is not None:
            await self._restart_meter_if_down()

    async def _restart_meter_if_down(self) -> None:
        """
        Starts the live meter again if it's died mid-set, at most every METER_RETRY_S.

        Side effects:
            May spawn the meter's ffmpeg.
        """
        if self.meter.running or not self.meter.in_set:
            return
        last = self.meter.last_started
        if last is not None and time.monotonic() - last < METER_RETRY_S:
            return
        logger.info("dj stream: the live meter stopped mid-set, starting it again")
        await self.meter.start(self.stream_url())

    async def _fetch_source(self, client: httpx.AsyncClient, mounts: dict[str, int | None]) -> dict | None:
        """
        Asks icecast whether one of our mounts is on air.

        Logs once when icecast becomes unreachable and once when it's back, not every poll.

        Args:
            client: Shared http client for icecast.
            mounts: The mounts that count (known_mounts).

        Returns:
            The live mount's source entry, or None if it's off air or icecast can't be reached.
        """
        url = f"{settings.ICECAST_URL}{ICECAST_STATUS_PATH}"
        try:
            response = await client.get(url)
            response.raise_for_status()
            icecast_status = response.json()
        except (httpx.HTTPError, ValueError) as err:
            if not self._icecast_unreachable:
                logger.warning(
                    f"dj stream: can't read icecast status at {url} ({err}). treating the stream "
                    "as off air. is the dj-stream container up? (pi/services/dj-stream)"
                )
                self._icecast_unreachable = True
            return None

        if self._icecast_unreachable:
            logger.info("dj stream: icecast is reachable again")
            self._icecast_unreachable = False
        return find_live_source(icecast_status, mounts)

    async def _start_recording(self) -> None:
        """
        Starts ffmpeg copying the live stream to a new mp3, and adds its dj_sets row (and
        its dj_set_guests row, when it's a guest's set).

        Side effects:
            Spawns ffmpeg, creates a file under DJ_SETS_DIR, inserts the rows.
        """
        started_at = utc_now_naive()
        path = Path(settings.DJ_SETS_DIR) / started_at.strftime(SET_FILENAME_FORMAT)
        try:
            process = await asyncio.create_subprocess_exec(
                "ffmpeg", "-nostdin", "-loglevel", "error", "-n",
                "-i", self.stream_url(),
                # straight copy: the stream is already mp3, so no re-encode and next to no cpu
                "-c", "copy", "-f", "mp3", str(path),
                stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )
        except OSError as err:
            logger.error(f"dj stream: couldn't start ffmpeg to record {path.name} ({err}). is ffmpeg in the image?")
            return

        with SessionLocal() as db:
            dj_set = DjSet(started_at=started_at, file_path=str(path))
            if self.guest_id is not None:
                dj_set.guest_link = DjSetGuest(guest_id=self.guest_id)
            db.add(dj_set)
            db.commit()
            self._set_id = dj_set.id

        self._recorder = process
        self._recording_mount = self.mount
        self._recorder_output = asyncio.create_task(log_ffmpeg_output(process, path.name))
        logger.info(f"dj stream: {self.mount} is live, recording to {path.name}")
        self.meter.begin_set()
        await self.meter.start(self.stream_url())

    async def _stop_recording(self) -> None:
        """
        Stops ffmpeg (it finishes the file on SIGTERM) and finishes the set.

        Does nothing when nothing's recording.
        """
        process = self._recorder
        if process is None:
            return
        if process.returncode is None:
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), FFMPEG_STOP_TIMEOUT_S)
            except TimeoutError:
                logger.warning(f"dj stream: ffmpeg didn't stop within {FFMPEG_STOP_TIMEOUT_S} s, killing it")
                process.kill()
                await process.wait()
        await self._finish_recording()

    async def _finish_recording(self) -> None:
        """
        Wraps up after ffmpeg has exited: saves or discards the set and clears the recorder.

        Side effects:
            Stops the live meter and drops its trace, empties the live room, updates or deletes the dj_sets row
            (and the file, if discarded), and starts working out a kept set's waveform in
            the background.
        """
        await self.meter.stop()
        self.meter.end_set()
        live_room.clear()
        set_id = self._set_id
        if self._recorder_output is not None:
            await self._recorder_output
        self._recorder = None
        self._recording_mount = None
        self._recorder_output = None
        self._set_id = None
        if set_id is None:
            return

        with SessionLocal() as db:
            dj_set = db.get(DjSet, set_id)
            if dj_set is None:
                logger.warning(f"dj stream: set {set_id} vanished while recording, nothing to finish")
                return
            if not finalize_set(db, dj_set, utc_now_naive()):
                return
            audio_path, duration_s = Path(dj_set.file_path), dj_set.duration_s
        # in the background: polling (and spotting the next set) shouldn't wait on ffmpeg
        self._waveform_task = asyncio.create_task(prepare_waveform(audio_path, duration_s))


# the one watcher for this process; main.py runs it, the router reads it
watcher = DjStreamWatcher()
