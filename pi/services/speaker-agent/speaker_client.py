"""plays clips on the big speakers from fart-pi's services, through the speaker agent on displaytop.

clips upload themselves the first time they're played, so services keep their audio files
wherever they like. see pi/docs/services/speaker-agent.md.
"""

import hashlib
import json
import urllib.error
import urllib.request
from pathlib import Path

SPEAKER_AGENT_URL = "http://192.168.1.192:8771"
HTTP_NOT_FOUND = 404
HTTP_CONFLICT = 409
REQUEST_TIMEOUT_S = 5
UPLOAD_TIMEOUT_S = 60
# how long to hold a request open waiting on a clip. the wifi dropping mid-clip shows up
# as this running out, so it's only a bit longer than the longest clip we'd wait on
PLAY_WAIT_TIMEOUT_S = 120

# (size, mtime) of each clip when it was hashed, so a replaced file gets rehashed
_clip_ids: dict[Path, tuple[tuple[int, int], str]] = {}


class SpeakersBusyError(Exception):
    """something else is playing on the speakers."""


class SpeakerAgentError(Exception):
    """the speaker agent couldn't be reached or couldn't play it. the message says why."""


class _ClipMissingError(Exception):
    """the agent doesn't have this clip yet."""


def _clip_id(path: Path) -> str:
    """works out a clip's sha256, the name the agent knows it by.

    args:
        path: the wav.

    returns:
        hex sha256 of the file.
    """
    stat = path.stat()
    version = (stat.st_size, stat.st_mtime_ns)
    cached = _clip_ids.get(path)
    if cached and cached[0] == version:
        return cached[1]
    clip = hashlib.sha256(path.read_bytes()).hexdigest()
    _clip_ids[path] = (version, clip)
    return clip


def _request(method: str, route: str, timeout_s: float, body: bytes | None = None) -> None:
    """sends one request to the agent.

    args:
        method: http method.
        route: path on the agent.
        timeout_s: how long to wait for an answer.
        body: request body, if any.

    raises:
        _ClipMissingError: it answered 404.
        SpeakersBusyError: it answered 409.
        SpeakerAgentError: anything else went wrong.
    """
    request = urllib.request.Request(f"{SPEAKER_AGENT_URL}{route}", data=body, method=method)
    try:
        urllib.request.urlopen(request, timeout=timeout_s).close()
    except urllib.error.HTTPError as exc:
        reason = _error_reason(exc)
        if exc.code == HTTP_NOT_FOUND:
            raise _ClipMissingError(reason) from exc
        if exc.code == HTTP_CONFLICT:
            raise SpeakersBusyError(reason) from exc
        raise SpeakerAgentError(f"speaker agent answered {exc.code} to {method} {route}: {reason}") from exc
    except OSError as exc:
        raise SpeakerAgentError(
            f"couldn't reach the speaker agent at {SPEAKER_AGENT_URL} ({exc}): is displaytop on? "
            "check `systemctl status speaker-agent` there"
        ) from exc


def _error_reason(error: urllib.error.HTTPError) -> str:
    """pulls the agent's reason out of an error response.

    args:
        error: the failed response.

    returns:
        its "error" field, or the status text if the body isn't what's expected.
    """
    try:
        return json.load(error)["error"]
    except (ValueError, KeyError, TypeError):
        return str(error.reason)


def play_clip(path: Path, owner: str) -> None:
    """plays a wav on the big speakers, blocking until it's finished or stopped.

    args:
        path: the wav.
        owner: which service this is, lowercase and dashes. only it can stop the clip.

    raises:
        SpeakersBusyError: something else is playing.
        SpeakerAgentError: it couldn't be played.
    """
    clip = _clip_id(path)
    route = f"/play/{owner}/{clip}?wait=1"
    try:
        _request("POST", route, PLAY_WAIT_TIMEOUT_S)
    except _ClipMissingError:
        _request("PUT", f"/clips/{clip}", UPLOAD_TIMEOUT_S, body=path.read_bytes())
        _request("POST", route, PLAY_WAIT_TIMEOUT_S)


def stop_clip(owner: str) -> None:
    """stops this service's clip, if one's playing. anyone else's keeps going.

    args:
        owner: which service this is.

    raises:
        SpeakerAgentError: the agent couldn't be reached.
    """
    _request("POST", f"/stop/{owner}", REQUEST_TIMEOUT_S)
