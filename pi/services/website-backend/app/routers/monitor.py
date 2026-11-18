"""
Monitor router -- each house machine's storage, memory, cpu and temperature.

Two sides, two kinds of auth (see app/monitor.py):

- agents (X-Monitor-Token, monitor-agent.service on each machine): push their latest report
- anyone: read every machine's stats, rate limited per IP (the monitor page is public)

See pi/docs/services/monitor-agent.md.
"""

import hmac
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from app.config import settings
from app.monitor import store
from app.rate_limit import limiter
from app.schemas import MonitorReport, MonitorState

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/monitor", tags=["Monitor"])

# the page and both kiosk screens poll every 30 s; this leaves plenty of headroom
PUBLIC_READ_RATE_LIMIT = "60/minute"


def require_monitor_agent(x_monitor_token: str = Header(default="")) -> None:
    """
    Checks the shared secret the monitor agents send.

    Args:
        x_monitor_token: The X-Monitor-Token header.

    Raises:
        HTTPException: 503 if MONITOR_TOKEN isn't configured, 401 if the token is wrong.
    """
    if not settings.MONITOR_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="the monitor is off -- set MONITOR_TOKEN in the backend's .env and restart it",
        )
    if not hmac.compare_digest(x_monitor_token.encode(), settings.MONITOR_TOKEN.encode()):
        logger.warning("monitor: agent request with a wrong X-Monitor-Token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="wrong monitor token -- it must match MONITOR_TOKEN in the backend's .env",
        )


@router.get("", response_model=MonitorState)
@limiter.limit(PUBLIC_READ_RATE_LIMIT)
async def get_monitor(request: Request) -> dict:
    """
    Every machine's latest stats.

    Args:
        request: Incoming request, used by the rate limiter.

    Returns:
        dict: Each machine's last report, when it came in and whether it's online (MonitorState).
    """
    return store.state()


@router.put("/report", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_monitor_agent)])
async def put_report(report: MonitorReport) -> None:
    """
    Store a machine's latest report, pushed every 30 s by its agent.

    Args:
        report: The machine's stats.
    """
    store.set_report(report.model_dump())
