"""
mattbot_tts.py — CLI script to request TTS audio from mattbot and save as WAV.

The mattbot TTS API currently returns audio embedded as a JSON byte array
inside an error response from fish-speech. This script extracts those bytes
and writes them to a WAV file.

Usage:
    python mattbot_tts.py "Your text here" [--output filename.wav]

Arguments:
    text            The text to synthesize.
    --output        Output WAV filename (default: output.wav in cwd).
    --ip            Mattbot NetBird IP (default: 100.124.81.6).
    --voice         Voice name (default: matt).
    --port          TTS port (default: 7003).
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

MATTBOT_IP_DEFAULT = "100.124.81.6"
MATTBOT_TTS_PORT = 7003
DEFAULT_VOICE = "matt"
WAV_HEADER_MAGIC = b"RIFF"


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments.

    Returns:
        Parsed argument namespace.
    """
    parser = argparse.ArgumentParser(description="Request TTS audio from mattbot.")
    parser.add_argument("text", help="Text to synthesize.")
    parser.add_argument("--output", default="output.wav", help="Output WAV file path.")
    parser.add_argument("--ip", default=MATTBOT_IP_DEFAULT, help="Mattbot NetBird IP.")
    parser.add_argument("--voice", default=DEFAULT_VOICE, help="Voice name.")
    parser.add_argument("--port", type=int, default=MATTBOT_TTS_PORT, help="TTS port.")
    return parser.parse_args()


def fetch_raw_response(ip: str, port: int, text: str, voice: str) -> bytes:
    """Send a TTS request to mattbot and return the raw response bytes.

    Args:
        ip: Mattbot NetBird IP address.
        port: TTS service port.
        text: Text to synthesize.
        voice: Voice name to use.

    Returns:
        Raw HTTP response body as bytes.

    Raises:
        RuntimeError: If curl fails or returns a non-zero exit code.
    """
    url = f"http://{ip}:{port}/api/v1/tts"
    payload = json.dumps({"text": text, "voice_name": voice, "output_filename": "out"})

    result = subprocess.run(
        ["curl.exe", "-s", "-X", "POST", url, "-H", "Content-Type: application/json", "-d", payload],
        capture_output=True,
    )

    if result.returncode != 0:
        raise RuntimeError(f"curl failed: {result.stderr.decode(errors='replace')}")

    return result.stdout


def extract_wav_bytes(raw: bytes) -> bytes:
    """Extract WAV audio bytes from the mattbot TTS response.

    The API currently embeds raw WAV bytes as a JSON integer array inside
    a fish-speech 422 error response. This function unwraps that structure
    and returns the raw WAV bytes.

    Args:
        raw: Raw HTTP response body.

    Returns:
        WAV audio as bytes.

    Raises:
        ValueError: If the response does not contain expected audio data.
    """
    try:
        outer = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Response is not JSON: {exc}") from exc

    # Happy path: the API returns audio directly as binary
    if isinstance(outer, (bytes, bytearray)):
        return bytes(outer)

    # Current behavior: audio is embedded in a fish-speech 422 error detail
    detail = outer.get("detail", "")
    prefix = "fish-speech returned 422: "
    if prefix in detail:
        inner_json = detail[detail.index(prefix) + len(prefix):]
        inner = json.loads(inner_json)
        for item in inner:
            if isinstance(item.get("input"), list):
                audio_bytes = bytes(item["input"])
                if audio_bytes[:4] == WAV_HEADER_MAGIC:
                    return audio_bytes

    raise ValueError(
        f"Could not locate WAV audio in response. Keys: {list(outer.keys()) if isinstance(outer, dict) else type(outer)}"
    )


def save_wav(audio_bytes: bytes, output_path: str) -> Path:
    """Write audio bytes to a WAV file.

    Args:
        audio_bytes: Raw WAV bytes starting with RIFF header.
        output_path: Destination file path.

    Returns:
        Resolved Path of the written file.
    """
    path = Path(output_path).resolve()
    path.write_bytes(audio_bytes)
    return path


def main() -> None:
    """Entry point: fetch TTS audio from mattbot and save as WAV."""
    args = parse_args()

    print(f"Requesting TTS from {args.ip}:{args.port} ...")
    raw = fetch_raw_response(args.ip, args.port, args.text, args.voice)
    print(f"Received {len(raw):,} bytes.")

    audio = extract_wav_bytes(raw)
    print(f"Extracted {len(audio):,} WAV bytes.")

    out = save_wav(audio, args.output)
    print(f"Saved to: {out}")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
