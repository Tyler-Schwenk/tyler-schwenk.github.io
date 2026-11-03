"""
compile_timelapse.py

pulls garden timelapse footage off the camera's memory card into a permanent
archive, then compiles the archive into one MP4 plus a TypeScript timestamps
module for the garden page's date-tracking player.

full workflow, including how to publish the result: website/docs/GARDEN.md

sources, in playback order:
  1. BEFORE_PHOTOS_DIR - JPEGs from before the camera went up, each held for
     STILL_DURATION_S. dates live in BEFORE_PHOTO_DATES.
  2. RAW_DIR - the clip archive. filenames start with the capture time, so
     sorting by name is chronological and dates never depend on file mtimes.

every frame that's kept gets exactly one output frame at OUTPUT_FPS, no matter what
frame rate the camera wrote, so the garden always grows at the same speed. the noisy
frames the camera shoots at dusk get cut from the end of each day.

usage:
    python scripts/timelapse/compile_timelapse.py --card D:\\DCIM\\100TLC3C
    python scripts/timelapse/compile_timelapse.py --card D:\\DCIM\\100TLC3C --pull-only
    python scripts/timelapse/compile_timelapse.py

output:
    data/time lapse/raw/                          clips + SHA256SUMS (new ones added)
    data/garden-timelapse.mp4                     upload to the Pi
    website/app/garden/timelapse-timestamps.ts    commit + push
"""

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).parents[2]
DATA_DIR = REPO_ROOT.parent / "data"
BEFORE_PHOTOS_DIR = DATA_DIR / "time lapse" / "before"
RAW_DIR = DATA_DIR / "time lapse" / "raw"
OUTPUT_VIDEO = DATA_DIR / "garden-timelapse.mp4"
TIMESTAMPS_FILE = REPO_ROOT / "website" / "app" / "garden" / "timelapse-timestamps.ts"

FFMPEG = "ffmpeg"
FFPROBE = "ffprobe"

# EXIF DateTimeOriginal for each before photo. update this if you add more.
BEFORE_PHOTO_DATES: dict[str, str] = {
    "1.jpg": "Mar 8, 2026",
    "2.jpg": "Apr 5, 2026",
    "3.jpg": "Apr 11, 2026",
}

# how long each before photo holds on screen in the compiled video
STILL_DURATION_S: int = 2

# what the camera records. stills match it so the concat never has to reconfigure mid-stream.
SOURCE_WIDTH_PX: int = 1920
SOURCE_HEIGHT_PX: int = 1080

# keep in sync with FRAME_DURATION_S in website/app/garden/TimelapsePlayer.tsx
OUTPUT_FPS: int = 30
OUTPUT_WIDTH_PX: int = 1280
OUTPUT_HEIGHT_PX: int = 720
OUTPUT_CRF: int = 28
OUTPUT_PRESET: str = "slow"
# the player scrubs and jumps days constantly. x264's default (250 frames) means a
# seek can decode 8s of video first, a shorter interval costs a little file size.
KEYFRAME_INTERVAL_FRAMES: int = 60

# the camera cranks its gain as the light goes, and that noise barely compresses, so
# dusk frames jump to 1 MB+ while daylight ones top out around 700 KB. brightness can't
# catch these because the gain keeps them looking bright.
NOISY_FRAME_MIN_BYTES: int = 700 * 1024
# the last couple of frames before the noise starts are already grainy and color-shifted
DUSK_MARGIN_FRAMES: int = 2

# archive filenames start with the capture time, e.g. 2026-06-30_175502_TLC00086.AVI
CAPTURE_TIME_FORMAT: str = "%Y-%m-%d_%H%M%S"
CHECKSUMS_FILENAME: str = "SHA256SUMS"
PARTIAL_SUFFIX: str = ".partial"
HASH_CHUNK_SIZE_BYTES: int = 1024 * 1024

PROBE_WORKERS: int = 8
# decoding one day's clip takes seconds, this only catches a hung ffprobe
PROBE_TIMEOUT_S: int = 300
STILL_TIMEOUT_S: int = 60


@dataclass(frozen=True)
class Segment:
    """one source clip in the final video: where it is, its date, how many frames it adds, and where to stop reading it."""

    path: Path
    date_label: str
    frame_count: int
    outpoint_s: float | None = None


def capture_time_from_card(clip: Path) -> datetime:
    """
    work out the camera's wall clock time for a clip sitting on the card.

    FAT32 stores local time with no zone. windows turns that into UTC using today's
    offset, not the offset on the file's date, so mtimes shift an hour depending on
    whether you pull during daylight time. undoing it with today's offset gets back
    exactly what the camera wrote. only valid for files still on the FAT32 card.

    Args:
        clip: clip on the memory card.

    Returns:
        naive datetime holding the camera's wall clock time.
    """
    written_utc = datetime.fromtimestamp(clip.stat().st_mtime, tz=UTC)
    return (written_utc + datetime.now().astimezone().utcoffset()).replace(tzinfo=None)


def sha256_of(path: Path) -> str:
    """
    hash a file without loading it all into memory.

    Args:
        path: file to hash.

    Returns:
        lowercase hex SHA-256 digest.
    """
    digest = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(HASH_CHUNK_SIZE_BYTES):
            digest.update(chunk)
    return digest.hexdigest()


def read_checksums(raw_dir: Path) -> dict[str, str]:
    """
    load the archive's checksum file (sha256sum format, so `sha256sum -c` works on it too).

    Args:
        raw_dir: the clip archive.

    Returns:
        dict of filename to hex digest, empty if there's no checksum file yet.
    """
    checksum_path = raw_dir / CHECKSUMS_FILENAME
    if not checksum_path.exists():
        return {}
    checksums: dict[str, str] = {}
    for line in checksum_path.read_text(encoding="utf-8").splitlines():
        digest, name = line.split(" *", 1)
        checksums[name] = digest
    return checksums


def write_checksums(raw_dir: Path, checksums: dict[str, str]) -> None:
    """
    atomically rewrite the archive's checksum file, sorted by filename.

    Args:
        raw_dir: the clip archive.
        checksums: dict of filename to hex digest.
    """
    checksum_path = raw_dir / CHECKSUMS_FILENAME
    partial_path = checksum_path.with_name(checksum_path.name + PARTIAL_SUFFIX)
    lines = [f"{checksums[name]} *{name}\n" for name in sorted(checksums)]
    partial_path.write_text("".join(lines), encoding="utf-8", newline="\n")
    partial_path.replace(checksum_path)


def pull_clip(clip: Path, raw_dir: Path) -> tuple[str, str, bool]:
    """
    copy one clip into the archive and prove the copy matches the card.

    the copy lands under a partial name and only gets its real name once its hash
    checks out, so an interrupted pull can't leave a bad clip that looks finished.

    Args:
        clip: clip on the memory card.
        raw_dir: the clip archive.

    Returns:
        tuple of archive filename, hex digest, and whether it was newly copied.

    Raises:
        RuntimeError: if the copy doesn't match, or the archive already holds
            different bytes under this name.
    """
    target = raw_dir / f"{capture_time_from_card(clip).strftime(CAPTURE_TIME_FORMAT)}_{clip.name}"
    card_digest = sha256_of(clip)

    if target.exists():
        if sha256_of(target) == card_digest:
            return target.name, card_digest, False
        raise RuntimeError(
            f"{target} doesn't match {clip}, so either the archive or the card is damaged. "
            f"nothing was overwritten. compare the two by hand before pulling again."
        )

    partial = target.with_name(target.name + PARTIAL_SUFFIX)
    shutil.copy2(clip, partial)
    if sha256_of(partial) != card_digest:
        partial.unlink()
        raise RuntimeError(
            f"copy of {clip} doesn't match the original, the card or reader may be failing. "
            f"reseat the card and run the pull again."
        )
    partial.replace(target)
    return target.name, card_digest, True


def pull_card(card_dir: Path, raw_dir: Path) -> None:
    """
    copy everything on the card that the archive doesn't have yet. safe to re-run,
    and never touches the card or removes anything from the archive.

    Args:
        card_dir: the card's clip folder, e.g. D:\\DCIM\\100TLC3C.
        raw_dir: the clip archive.

    Raises:
        RuntimeError: if the card has no clips or any clip fails to copy cleanly.
    """
    clips = sorted(card_dir.glob("*.AVI"))
    if not clips:
        raise RuntimeError(f"no AVI files in {card_dir}. check the card is mounted and the path is right.")

    raw_dir.mkdir(parents=True, exist_ok=True)
    checksums = read_checksums(raw_dir)
    copied_count = 0
    try:
        for clip in clips:
            name, digest, was_copied = pull_clip(clip, raw_dir)
            checksums[name] = digest
            copied_count += was_copied
            print(f"  {'copied  ' if was_copied else 'verified'}  {name}")
    finally:
        write_checksums(raw_dir, checksums)

    print(f"pulled {copied_count} new clips, {len(clips) - copied_count} already archived and verified")


def date_label_for_clip(clip: Path) -> str:
    """
    read a clip's calendar date out of its archive filename.

    Args:
        clip: archived clip named with the capture time prefix.

    Returns:
        date label like "Apr 13, 2026".

    Raises:
        RuntimeError: if the filename has no capture time prefix.
    """
    prefix = clip.name.rsplit("_", 1)[0]
    try:
        captured = datetime.strptime(prefix, CAPTURE_TIME_FORMAT)
    except ValueError as err:
        raise RuntimeError(
            f"{clip} has no capture time in its name. only add clips to the archive with --card."
        ) from err
    return f"{captured.strftime('%b')} {captured.day}, {captured.year}"


def count_decodable_frames(clip: Path) -> int:
    """
    count the frames ffmpeg can actually decode. headers can't be trusted here: the
    camera sometimes writes a clip whose header claims a second of frames that are all
    undecodable, which would otherwise show up as a freeze in the final video.

    Args:
        clip: video file to check.

    Returns:
        decodable frame count, 0 if none are.

    Raises:
        RuntimeError: if ffprobe itself fails.
    """
    result = subprocess.run(
        [
            FFPROBE, "-v", "quiet",
            "-count_frames",
            "-select_streams", "v:0",
            "-show_entries", "stream=nb_read_frames",
            "-print_format", "json",
            str(clip),
        ],
        capture_output=True,
        text=True,
        timeout=PROBE_TIMEOUT_S,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed for {clip.name}, can't tell if it's usable: {result.stderr.strip()}")

    streams = json.loads(result.stdout).get("streams", [])
    frame_count = streams[0].get("nb_read_frames", "") if streams else ""
    return int(frame_count) if frame_count.isdigit() else 0


def find_dusk_cut(clip: Path) -> tuple[int, float | None]:
    """
    find where a clip's noisy dusk frames start. only the unbroken run of oversized
    frames at the very end counts, so a busy frame in the middle of the day is safe.

    Args:
        clip: video file to check.

    Returns:
        tuple of how many frames to drop off the end and the time to stop reading at,
        (0, None) if the clip has no dusk noise. the time is None too if nothing's left.

    Raises:
        RuntimeError: if ffprobe fails.
    """
    result = subprocess.run(
        [
            FFPROBE, "-v", "quiet",
            "-select_streams", "v:0",
            "-show_entries", "packet=size,pts_time",
            "-print_format", "json",
            str(clip),
        ],
        capture_output=True,
        text=True,
        timeout=PROBE_TIMEOUT_S,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed for {clip.name}, can't look for dusk frames: {result.stderr.strip()}")

    packets = json.loads(result.stdout).get("packets", [])
    noise_start = len(packets)
    while noise_start > 0 and int(packets[noise_start - 1]["size"]) >= NOISY_FRAME_MIN_BYTES:
        noise_start -= 1
    if noise_start == len(packets):
        return 0, None

    keep_count = max(noise_start - DUSK_MARGIN_FRAMES, 0)
    if keep_count == 0:
        return len(packets), None
    # stop halfway between two frames, since ffprobe's rounded times could land on either side of one
    last_kept_s = float(packets[keep_count - 1]["pts_time"])
    first_cut_s = float(packets[keep_count]["pts_time"])
    return len(packets) - keep_count, (last_kept_s + first_cut_s) / 2


def build_clip_segment(clip: Path) -> Segment | None:
    """
    work out what one archived clip contributes to the video.

    Args:
        clip: archived clip.

    Returns:
        the clip's segment, or None if it has no usable frames.
    """
    frame_count = count_decodable_frames(clip)
    if frame_count == 0:
        print(f"  skipping {clip.name}: no decodable frames", file=sys.stderr)
        return None

    cut_count, outpoint_s = find_dusk_cut(clip)
    if cut_count >= frame_count:
        print(f"  skipping {clip.name}: all {frame_count} frames are dusk noise", file=sys.stderr)
        return None
    return Segment(clip, date_label_for_clip(clip), frame_count - cut_count, outpoint_s)


def load_archive_segments(raw_dir: Path) -> list[Segment]:
    """
    turn the archive into timeline segments, leaving out clips with nothing usable.

    Args:
        raw_dir: the clip archive.

    Returns:
        segments in chronological order.

    Raises:
        RuntimeError: if the archive has no usable clips.
    """
    clips = sorted(raw_dir.glob("*.AVI"))
    if not clips:
        raise RuntimeError(f"no clips in {raw_dir}. pull some first with --card.")

    with ThreadPoolExecutor(max_workers=PROBE_WORKERS) as pool:
        segments = [segment for segment in pool.map(build_clip_segment, clips) if segment is not None]

    if not segments:
        raise RuntimeError(f"none of the {len(clips)} clips in {raw_dir} have usable frames.")
    return segments


def jpeg_to_clip(jpeg_path: Path, output_path: Path, frame_count: int) -> None:
    """
    render a JPEG as a short MJPEG clip that matches the camera's format, padding
    with black bars if it's a different aspect ratio (e.g. a portrait phone photo).

    Args:
        jpeg_path: source JPEG.
        output_path: destination .avi path.
        frame_count: how many frames the still should hold for.

    Raises:
        RuntimeError: if ffmpeg exits non-zero.
    """
    fit_filter = (
        f"scale={SOURCE_WIDTH_PX}:{SOURCE_HEIGHT_PX}:force_original_aspect_ratio=decrease,"
        f"pad={SOURCE_WIDTH_PX}:{SOURCE_HEIGHT_PX}:(ow-iw)/2:(oh-ih)/2:black"
    )
    cmd = [
        FFMPEG, "-y", "-v", "error",
        "-framerate", str(OUTPUT_FPS),
        "-loop", "1",
        "-i", str(jpeg_path),
        "-frames:v", str(frame_count),
        "-vf", fit_filter,
        "-c:v", "mjpeg", "-q:v", "3",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=STILL_TIMEOUT_S, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg couldn't convert {jpeg_path.name} to a clip: {result.stderr.strip()}")


def build_still_segments(temp_dir: Path) -> list[Segment]:
    """
    render the before photos into temp clips, one segment each.

    Args:
        temp_dir: where the temp clips go.

    Returns:
        segments in filename order.

    Raises:
        RuntimeError: if a photo has no date, since dropping it silently would
            leave a hole at the start of the video.
    """
    frame_count = STILL_DURATION_S * OUTPUT_FPS
    segments: list[Segment] = []
    for jpeg_path in sorted(BEFORE_PHOTOS_DIR.glob("*.jpg")):
        date_label = BEFORE_PHOTO_DATES.get(jpeg_path.name)
        if date_label is None:
            raise RuntimeError(f"{jpeg_path} has no date. add it to BEFORE_PHOTO_DATES in this script.")
        still_clip = temp_dir / f"still_{jpeg_path.stem}.avi"
        jpeg_to_clip(jpeg_path, still_clip, frame_count)
        segments.append(Segment(still_clip, date_label, frame_count))
    return segments


def build_timestamps(segments: list[Segment]) -> list[dict]:
    """
    map playback seconds to calendar dates, keeping only the first segment of each date.

    Args:
        segments: every segment in playback order.

    Returns:
        list of dicts with 'startSeconds' (float) and 'date' (str) keys.
    """
    timestamps: list[dict] = []
    seen_dates: set[str] = set()
    frames_so_far = 0
    for segment in segments:
        if segment.date_label not in seen_dates:
            timestamps.append({"startSeconds": round(frames_so_far / OUTPUT_FPS, 3), "date": segment.date_label})
            seen_dates.add(segment.date_label)
        frames_so_far += segment.frame_count
    return timestamps


def count_output_frames(video_path: Path) -> int:
    """
    count the frames in an encoded video.

    Args:
        video_path: video to check.

    Returns:
        number of video packets, which is one per frame for our H.264 output.

    Raises:
        RuntimeError: if ffprobe fails.
    """
    result = subprocess.run(
        [
            FFPROBE, "-v", "error",
            "-count_packets",
            "-select_streams", "v:0",
            "-show_entries", "stream=nb_read_packets",
            "-print_format", "json",
            str(video_path),
        ],
        capture_output=True,
        text=True,
        timeout=PROBE_TIMEOUT_S,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe couldn't read the encoded video {video_path}: {result.stderr.strip()}")
    return int(json.loads(result.stdout)["streams"][0]["nb_read_packets"])


def encode_video(segments: list[Segment], temp_dir: Path, output_path: Path) -> None:
    """
    encode every segment into one H.264 MP4 and check it before replacing the old one.

    a failed run leaves the previous video untouched, and the frame count check makes
    sure the timestamps module can't ship out of step with the video.

    Args:
        segments: every segment in playback order.
        temp_dir: scratch directory on the same drive as output_path.
        output_path: destination .mp4 path.

    Raises:
        RuntimeError: if ffmpeg fails or the frame count isn't what was expected.
    """
    concat_file = temp_dir / "concat.txt"
    with concat_file.open("w", encoding="utf-8", newline="\n") as f:
        for segment in segments:
            escaped_path = segment.path.as_posix().replace("'", r"'\''")
            f.write(f"file '{escaped_path}'\n")
            if segment.outpoint_s is not None:
                f.write(f"outpoint {segment.outpoint_s:.6f}\n")

    fit_filter = (
        f"scale={OUTPUT_WIDTH_PX}:{OUTPUT_HEIGHT_PX}:force_original_aspect_ratio=decrease,"
        f"pad={OUTPUT_WIDTH_PX}:{OUTPUT_HEIGHT_PX}:(ow-iw)/2:(oh-ih)/2:black,setsar=1"
    )
    encoded_path = temp_dir / output_path.name
    cmd = [
        FFMPEG, "-y", "-hide_banner", "-loglevel", "warning", "-stats",
        # -r before the input throws out the clips' own timing, this is what makes
        # every frame the same length even if the camera wrote a different frame rate
        "-r", str(OUTPUT_FPS),
        "-f", "concat", "-safe", "0",
        "-i", str(concat_file),
        "-vf", fit_filter,
        "-c:v", "libx264", "-preset", OUTPUT_PRESET, "-crf", str(OUTPUT_CRF),
        "-g", str(KEYFRAME_INTERVAL_FRAMES),
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an",
        str(encoded_path),
    ]
    # no timeout on purpose: encode time grows with the footage, and a timeout here
    # would just kill a healthy run hours in. ffmpeg's stats line shows it's alive.
    result = subprocess.run(cmd, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg exited {result.returncode} while encoding, see its output above.")

    expected_frames = sum(segment.frame_count for segment in segments)
    actual_frames = count_output_frames(encoded_path)
    if actual_frames != expected_frames:
        raise RuntimeError(
            f"encoded video has {actual_frames} frames but the timestamps expect {expected_frames}, "
            f"so the player's dates would drift. kept the previous video. look for a damaged clip "
            f"in the ffmpeg warnings above."
        )
    encoded_path.replace(output_path)


def write_timestamps_ts(timestamps: list[dict], out_path: Path) -> None:
    """
    write the timestamps as a TypeScript module the garden page can import.

    Args:
        timestamps: entries from build_timestamps().
        out_path: destination .ts path, gets overwritten.
    """
    lines = [
        "// auto-generated by scripts/timelapse/compile_timelapse.py — do not edit manually",
        "",
        "export interface TimestampEntry {",
        "  startSeconds: number;",
        "  date: string;",
        "}",
        "",
        "export const TIMELAPSE_TIMESTAMPS: TimestampEntry[] = [",
    ]
    for entry in timestamps:
        lines.append(f'  {{ startSeconds: {entry["startSeconds"]}, date: "{entry["date"]}" }},')
    lines += ["];", ""]

    out_path.write_text("\n".join(lines), encoding="utf-8", newline="\n")


def compile_archive() -> None:
    """
    compile the before photos and archive into the final video and timestamps module.

    the timestamps only get written once the video has passed its checks.

    Raises:
        RuntimeError: if any step fails.
    """
    print("checking clips (this decodes all of them, takes a couple minutes)...")
    clip_segments = load_archive_segments(RAW_DIR)

    # temp dir sits next to the output so the finished video can be moved into place atomically
    with tempfile.TemporaryDirectory(dir=OUTPUT_VIDEO.parent, prefix="_timelapse_") as temp_name:
        temp_dir = Path(temp_name)
        segments = build_still_segments(temp_dir) + clip_segments
        timestamps = build_timestamps(segments)

        total_frames = sum(segment.frame_count for segment in segments)
        print(
            f"\nencoding {len(segments)} segments, {total_frames} frames, "
            f"{total_frames / OUTPUT_FPS:.1f}s, {timestamps[0]['date']} to {timestamps[-1]['date']}"
        )
        encode_video(segments, temp_dir, OUTPUT_VIDEO)

    write_timestamps_ts(timestamps, TIMESTAMPS_FILE)

    print("\ndone!")
    print(f"  video:      {OUTPUT_VIDEO} ({OUTPUT_VIDEO.stat().st_size / 1e6:.0f} MB)")
    print(f"  timestamps: {TIMESTAMPS_FILE} ({len(timestamps)} dates)")
    print("\nnext: publish both, see 'Adding New Footage' in website/docs/GARDEN.md")


def parse_args() -> argparse.Namespace:
    """
    parse the command line.

    Returns:
        parsed arguments with `card` (Path or None) and `pull_only` (bool).
    """
    parser = argparse.ArgumentParser(description="pull garden timelapse footage and compile it.")
    parser.add_argument("--card", type=Path, help=r"card's clip folder to pull from first, e.g. D:\DCIM\100TLC3C")
    parser.add_argument("--pull-only", action="store_true", help="stop after the pull, don't compile")
    args = parser.parse_args()
    if args.pull_only and args.card is None:
        parser.error("--pull-only needs --card to know what to pull")
    return args


def main() -> int:
    """
    run the pull and/or compile, reporting failures as a readable message.

    Returns:
        process exit code.
    """
    args = parse_args()
    for tool in (FFMPEG, FFPROBE):
        if not shutil.which(tool):
            print(f"error: '{tool}' isn't on PATH. install it with `winget install Gyan.FFmpeg`, "
                  f"then open a new shell.", file=sys.stderr)
            return 1

    try:
        if args.card is not None:
            print(f"pulling {args.card} -> {RAW_DIR}")
            pull_card(args.card, RAW_DIR)
        if not args.pull_only:
            compile_archive()
    except (RuntimeError, OSError, subprocess.TimeoutExpired) as err:
        print(f"error: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
