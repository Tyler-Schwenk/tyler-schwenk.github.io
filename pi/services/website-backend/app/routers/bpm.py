"""
BPM router -- serves the live BPM estimate from the mic-based beat detector.

pi/services/bpm-detector runs as a separate process on the host (it needs
direct ALSA access to the USB mic, so it isn't Dockerized). It writes its
current estimate to a state file, and that directory is mounted read-only
into this container so the API can serve the same state without the two
processes talking to each other directly.
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter

from app.config import settings
from app.schemas import BpmState

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bpm", tags=["BPM"])

STATE_FILENAME = "bpm_state.json"

# if the state file hasn't been touched in this long, treat it as no signal
# rather than trust a stale number -- the detector already blanks its own
# bpm after a few seconds of silence, this is a second line of defense in
# case the detector process itself has died
STALE_THRESHOLD_S = 10


@router.get("", response_model=BpmState)
async def get_bpm() -> BpmState:
    """
    Return the current BPM estimate.

    Returns:
        BpmState: bpm is None if there's no recent beat, the state file is
            missing (detector not running), or it's stale (detector died).
    """
    path = Path(settings.BPM_STATE_DIR) / STATE_FILENAME
    try:
        data = json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        logger.debug("bpm state unavailable: %s", exc)
        return BpmState(bpm=None, updated_at=None)

    updated_at = datetime.fromtimestamp(data["updated_at"], tz=timezone.utc)
    age_s = (datetime.now(timezone.utc) - updated_at).total_seconds()
    if age_s > STALE_THRESHOLD_S:
        return BpmState(bpm=None, updated_at=updated_at)

    return BpmState(bpm=data.get("bpm"), updated_at=updated_at)
