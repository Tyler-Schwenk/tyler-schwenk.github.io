"""
Mallard router -- proxies the external mallard count API server-side.

The count lives on a separate site (api.traderoutes.cards) that doesn't send
CORS headers, so browsers can't fetch it directly from tyler-schwenk.com.
This endpoint re-fetches it from the backend instead, where browser CORS
rules don't apply, and hands the count back through our own API.
"""

import logging

import httpx
from fastapi import APIRouter, HTTPException

from app.schemas import MallardCount

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mallard-count", tags=["Mallard"])

COUNT_API_URL = "https://api.traderoutes.cards/api/mallard-counter/count/"
REQUEST_TIMEOUT_S = 10


@router.get("", response_model=MallardCount)
async def get_mallard_count() -> MallardCount:
    """
    Fetch the current mallard count from the external counter API.

    Returns:
        MallardCount: The current count.

    Raises:
        HTTPException: 502 if the external API is unreachable or returns an
            unexpected response.
    """
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_S) as client:
            response = await client.get(COUNT_API_URL)
            response.raise_for_status()
            data = response.json()
        return MallardCount(count=int(data["count"]))
    except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
        logger.warning(f"could not fetch mallard count from {COUNT_API_URL}: {exc}")
        raise HTTPException(
            status_code=502,
            detail="Could not reach the mallard count API. Try again shortly.",
        )
