"""
Serving media files with HTTP range support.

Browsers seek in <video> and <audio> by asking for byte ranges, so anything that
plays a file from disk (videos, recorded dj sets) goes through here.
"""

from collections.abc import Iterator
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse, Response, StreamingResponse

STREAM_CHUNK_SIZE_BYTES = 64 * 1024


def parse_byte_range(range_header: str, file_size: int) -> tuple[int, int]:
    """
    Reads a `bytes=start-end` Range header.

    Args:
        range_header: The raw header value.
        file_size: Size of the file being served, in bytes.

    Returns:
        (start, end), both inclusive. An open end (`bytes=100-`) runs to the end of the file,
        a suffix (`bytes=-500`) is the last that many bytes, and an end past the file is
        cut back to its last byte (RFC 9110 says to, and some players ask for more).

    Raises:
        HTTPException: 416 if the header can't be read or falls outside the file.
    """
    last_byte = file_size - 1
    try:
        raw_range = range_header.strip().replace("bytes=", "")
        start_str, end_str = raw_range.split("-")
        if start_str:
            start = int(start_str)
            end = min(int(end_str), last_byte) if end_str else last_byte
        else:
            start = max(file_size - int(end_str), 0)
            end = last_byte
    except (ValueError, AttributeError):
        raise HTTPException(status_code=416, detail="Invalid Range header — expected bytes=start-end") from None

    if start >= file_size or start > end:
        raise HTTPException(
            status_code=416,
            detail=f"Range not satisfiable — file is {file_size} bytes",
        )
    return start, end


def iter_file_range(path: Path, start: int, length: int) -> Iterator[bytes]:
    """
    Reads part of a file in chunks.

    Args:
        path: The file.
        start: Byte offset to start at.
        length: How many bytes to read.

    Yields:
        bytes: Up to STREAM_CHUNK_SIZE_BYTES at a time, until `length` is read or the file ends.
    """
    with open(path, "rb") as f:
        f.seek(start)
        remaining = length
        while remaining > 0:
            data = f.read(min(STREAM_CHUNK_SIZE_BYTES, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data


def ranged_file_response(path: Path, media_type: str, range_header: str | None) -> Response:
    """
    Serves a file whole, or just the range the browser asked for.

    Args:
        path: The file. Callers check it exists first, so they can say what's missing.
        media_type: Its content type, like "video/mp4".
        range_header: The request's Range header, if it sent one.

    Returns:
        A 200 FileResponse without a range, else a 206 StreamingResponse of that range.

    Raises:
        HTTPException: 416 if the range is malformed or outside the file.
    """
    if not range_header:
        return FileResponse(path=str(path), media_type=media_type, headers={"Accept-Ranges": "bytes"})

    file_size = path.stat().st_size
    start, end = parse_byte_range(range_header, file_size)
    length = end - start + 1
    return StreamingResponse(
        iter_file_range(path, start, length),
        status_code=206,
        media_type=media_type,
        headers={
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
        },
    )
