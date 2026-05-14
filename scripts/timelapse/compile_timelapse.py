"""
compile_timelapse.py

Compiles the garden timelapse into a single MP4 and writes a TypeScript timestamps
module for the garden page's date-tracking video player.

Re-run this every time you pull new footage from the camera's memory card.
Full workflow documented in website/docs/GARDEN.md.

Sources (in order):
  1. BEFORE_PHOTOS_DIR — JPEGs taken before the timelapse camera was set up.
     Each is converted to a STILL_DURATION_S-second still clip.
     Dates come from EXIF DateTimeOriginal — hardcoded in BEFORE_PHOTO_DATES since
     the file mtimes change when copying between machines.
  2. TIMELAPSE_DIR     — Daily AVI clips from the timelapse camera. Should always
     point to the most recent complete card pull (all days from the start).
     Sorted by filename. Dates from file mtime.

All clips are normalized to TARGET_WIDTH x TARGET_HEIGHT. JPEGs are pillarboxed
to fit if they're a different aspect ratio (e.g. portrait phone photos).

When pulling new footage:
  1. Copy new card data to a new numbered folder (e.g. data/time lapse/3/)
  2. Update TIMELAPSE_DIR below to point to the new folder
  3. Run this script
  4. Re-upload garden-timelapse.mp4 to the Pi (delete old, upload new, same slug)
  5. git push to deploy the new timestamps

Usage:
    python scripts/timelapse/compile_timelapse.py

Output:
    - C:/Users/tyler/.../data/garden-timelapse.mp4       (upload to Pi)
    - website/app/garden/timelapse-timestamps.ts          (commit + push)
"""

import json
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def _expand_windows_path() -> None:
    """
    Read PATH from the Windows registry and apply it to the current process.

    Necessary when ffmpeg was just installed and the current shell session
    predates the install (so PATH hasn't been refreshed yet).
    Does nothing on non-Windows or if the registry read fails.
    """
    try:
        import winreg
        paths: list[str] = []
        for hive, subkey in [
            (winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment"),
            (winreg.HKEY_CURRENT_USER, r"Environment"),
        ]:
            try:
                with winreg.OpenKey(hive, subkey) as key:
                    paths.append(winreg.QueryValueEx(key, "PATH")[0])
            except FileNotFoundError:
                pass
        if paths:
            os.environ["PATH"] = ";".join(paths)
    except Exception:
        pass


_expand_windows_path()


BEFORE_PHOTOS_DIR = Path(r"C:\Users\tyler\important\projects\WebDev\Tylers Website\data\time lapse\before")
TIMELAPSE_DIR = Path(r"C:\Users\tyler\important\projects\WebDev\Tylers Website\data\time lapse\2")
OUTPUT_VIDEO = Path(r"C:\Users\tyler\important\projects\WebDev\Tylers Website\data\garden-timelapse.mp4")
TIMESTAMPS_FILE = Path(__file__).parents[2] / "website" / "app" / "garden" / "timelapse-timestamps.ts"

FFMPEG = "ffmpeg"
FFPROBE = "ffprobe"

# EXIF DateTimeOriginal for each before photo (read via System.Drawing on Windows).
# update this if you add more before photos.
BEFORE_PHOTO_DATES: dict[str, str] = {
    "1.jpg": "Mar 8, 2026",
    "2.jpg": "Apr 5, 2026",
    "3.jpg": "Apr 11, 2026",
}

# how long each before photo holds on screen in the compiled video
STILL_DURATION_S: int = 3

# native AVI clip resolution — all clips are normalized to this
TARGET_WIDTH: int = 1920
TARGET_HEIGHT: int = 1080


def get_clip_duration(clip_path: Path) -> float:
    """
    Get the duration of a video clip in seconds using ffprobe.

    Args:
        clip_path: Path to the video file.

    Returns:
        Duration in seconds as a float.

    Raises:
        RuntimeError: If ffprobe fails or returns no duration.
    """
    result = subprocess.run(
        [FFPROBE, "-v", "quiet", "-print_format", "json", "-show_format", str(clip_path)],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed for {clip_path.name}: {result.stderr.strip()}")

    data = json.loads(result.stdout)
    return float(data["format"]["duration"])


def jpeg_to_clip(jpeg_path: Path, output_path: Path, duration_s: int) -> None:
    """
    Convert a JPEG still into a short MJPEG AVI clip.

    Output format matches the timelapse AVI clips (MJPEG, 1920x1080, 30fps) so
    all inputs to the concat demuxer share the same codec. Scales the image to
    fit TARGET_WIDTH x TARGET_HEIGHT, padding with black bars for portrait photos.

    Args:
        jpeg_path: Source JPEG file.
        output_path: Destination .avi clip path.
        duration_s: How many seconds the still should hold.

    Raises:
        RuntimeError: If ffmpeg exits non-zero.
    """
    scale_filter = (
        f"scale={TARGET_WIDTH}:{TARGET_HEIGHT}:force_original_aspect_ratio=decrease,"
        f"pad={TARGET_WIDTH}:{TARGET_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black"
    )
    cmd = [
        FFMPEG, "-y",
        "-loop", "1",
        "-i", str(jpeg_path),
        "-t", str(duration_s),
        "-vf", scale_filter,
        "-r", "30",
        "-c:v", "mjpeg", "-q:v", "3",  # mjpeg matches the timelapse AVI codec
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg failed converting {jpeg_path.name}: {result.stderr.decode(errors='replace').strip()}"
        )


def build_timestamps(
    before_photos: list[tuple[Path, str]],
    avi_clips: list[Path],
) -> list[dict]:
    """
    Build timestamp entries mapping video playback seconds to calendar dates.

    Before photos use hardcoded EXIF dates. AVI clips use file mtime. Duplicate
    dates are collapsed — only the first clip for each date gets an entry.

    Args:
        before_photos: Ordered list of (jpeg_path, date_label) tuples.
        avi_clips: Ordered list of AVI clip paths.

    Returns:
        List of dicts with 'startSeconds' (float) and 'date' (str) keys.
    """
    timestamps = []
    cumulative_s = 0.0
    seen_dates: set[str] = set()

    for _, date_label in before_photos:
        if date_label not in seen_dates:
            timestamps.append({"startSeconds": round(cumulative_s, 3), "date": date_label})
            seen_dates.add(date_label)
        cumulative_s += STILL_DURATION_S
        print(f"  (still)  {date_label:>14}  {STILL_DURATION_S}s  (total so far: {cumulative_s:.3f}s)")

    for path in avi_clips:
        dt = datetime.fromtimestamp(path.stat().st_mtime)
        date_label = f"{dt.strftime('%b')} {dt.day}, {dt.year}"
        duration = get_clip_duration(path)

        if date_label not in seen_dates:
            timestamps.append({"startSeconds": round(cumulative_s, 3), "date": date_label})
            seen_dates.add(date_label)

        cumulative_s += duration
        print(f"  {path.name}  {date_label:>14}  {duration:.3f}s  (total so far: {cumulative_s:.3f}s)")

    return timestamps


def compile_video(
    before_photos: list[tuple[Path, str]],
    avi_clips: list[Path],
    output_path: Path,
) -> None:
    """
    Compile all sources into a single H.264 MP4.

    JPEGs are first converted to temp clips at TARGET_WIDTH x TARGET_HEIGHT,
    then everything is concatenated via the ffmpeg concat demuxer.
    Temp files are cleaned up regardless of success or failure.

    Args:
        before_photos: Ordered (jpeg_path, date_label) tuples to prepend.
        avi_clips: Ordered AVI clips to append.
        output_path: Destination .mp4 path.

    Raises:
        RuntimeError: If any ffmpeg step fails.
    """
    temp_dir = output_path.parent
    temp_clips: list[Path] = []

    try:
        for i, (jpeg_path, date_label) in enumerate(before_photos):
            temp_clip = temp_dir / f"_temp_still_{i}.avi"  # .avi matches timelapse codec
            print(f"  converting {jpeg_path.name} ({date_label}) → {temp_clip.name}")
            jpeg_to_clip(jpeg_path, temp_clip, STILL_DURATION_S)
            temp_clips.append(temp_clip)

        concat_file = temp_dir / "_timelapse_concat_list.txt"
        all_clips = temp_clips + list(avi_clips)

        with concat_file.open("w", encoding="utf-8") as f:
            for path in all_clips:
                f.write(f"file '{path.as_posix()}'\n")

        cmd = [
            FFMPEG, "-y",
            "-f", "concat", "-safe", "0",
            "-i", str(concat_file),
            "-c:v", "libx264", "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            str(output_path),
        ]
        result = subprocess.run(cmd, timeout=600)
        if result.returncode != 0:
            raise RuntimeError("ffmpeg compilation failed. check the output above for details.")

    finally:
        for temp in temp_clips:
            temp.unlink(missing_ok=True)
        concat_path = temp_dir / "_timelapse_concat_list.txt"
        concat_path.unlink(missing_ok=True)


def write_timestamps_ts(timestamps: list[dict], out_path: Path) -> None:
    """
    Write the timestamps as a TypeScript module importable by the garden page.

    Args:
        timestamps: List of timestamp entries from build_timestamps().
        out_path: Destination .ts file path (will be overwritten).
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

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {len(timestamps)} timestamp entries to {out_path}")


def main() -> None:
    """
    Discover all sources, compile the video, and write the timestamps module.
    """
    for tool in (FFMPEG, FFPROBE):
        if not shutil.which(tool):
            print(f"error: '{tool}' not found on PATH.", file=sys.stderr)
            print("  install: winget install Gyan.FFmpeg", file=sys.stderr)
            print("  if just installed, restart your shell and try again", file=sys.stderr)
            sys.exit(1)

    before_photos_sorted = sorted(BEFORE_PHOTOS_DIR.glob("*.jpg"))
    before_photos: list[tuple[Path, str]] = []
    for path in before_photos_sorted:
        date_label = BEFORE_PHOTO_DATES.get(path.name)
        if date_label is None:
            print(f"warning: {path.name} has no entry in BEFORE_PHOTO_DATES — skipping", file=sys.stderr)
            continue
        before_photos.append((path, date_label))

    avi_clips = sorted(TIMELAPSE_DIR.glob("*.AVI"))
    if not avi_clips:
        print(f"error: no AVI files found in {TIMELAPSE_DIR}", file=sys.stderr)
        sys.exit(1)

    print(f"found {len(before_photos)} before photos + {len(avi_clips)} timelapse clips\n")

    print("building timestamps...")
    timestamps = build_timestamps(before_photos, avi_clips)

    print(f"\ncompiling video → {OUTPUT_VIDEO}")
    compile_video(before_photos, avi_clips, OUTPUT_VIDEO)

    print(f"\nwriting timestamps module → {TIMESTAMPS_FILE}")
    write_timestamps_ts(timestamps, TIMESTAMPS_FILE)

    print("\ndone!")
    print(f"  video:      {OUTPUT_VIDEO}")
    print(f"  timestamps: {TIMESTAMPS_FILE}")
    print()
    print("next steps:")
    print("  1. upload garden-timelapse.mp4 to the Pi via the admin upload page")
    print("     slug: garden-timelapse")
    print("  2. git push to deploy the updated timestamps to the website")


if __name__ == "__main__":
    main()
