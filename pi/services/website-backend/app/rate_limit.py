"""
Shared rate limiter.

Lives in its own module so both `main.py` (which registers it on the app) and
individual routers (which decorate endpoints with it) can import it without a
circular import.
"""

import logging
import socket
import time

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

logger = logging.getLogger(__name__)

# the header cloudflare puts the real visitor IP in. cloudflare overwrites whatever the
# visitor sent, so it can be trusted on requests from the tunnel, and only on those
CLIENT_IP_HEADER = "cf-connecting-ip"

# how often, at most, to look the tunnel container's address up again when a request
# comes from somewhere else. it gets a new address when it's recreated, so this is how
# long the tunnel's visitors can share one rate limit bucket after that
TUNNEL_RESOLVE_MIN_INTERVAL_S = 5.0

# every password login (admin, kiln editor, guest dj) shares this. slows down password
# guessing without getting in the way of someone mistyping
LOGIN_RATE_LIMIT = "5/minute"


class TunnelAddress:
    """
    The cloudflared container's address on the docker network, looked up by name and
    remembered, so telling tunnel requests apart is a string compare.
    """

    def __init__(self, host: str) -> None:
        """
        Args:
            host: The container's name on the docker network.
        """
        self._host = host
        self._ip: str | None = None
        self._resolved_at = float("-inf")

    def _resolve(self) -> None:
        """
        Looks the container up again. When it can't be found (it's down, or the backend
        is running outside docker), nothing counts as the tunnel until it can.

        Side effects:
            Updates the remembered address and when it was looked up.
        """
        self._resolved_at = time.monotonic()
        try:
            ip = socket.gethostbyname(self._host)
        except OSError as err:
            if self._ip is not None:
                logger.warning(f"rate limit: lost the tunnel at {self._host} ({err}), not trusting {CLIENT_IP_HEADER} until it's back")
            self._ip = None
            return
        if ip != self._ip:
            logger.info(f"rate limit: tunnel {self._host} is at {ip}")
        self._ip = ip

    def matches(self, peer_ip: str) -> bool:
        """
        Says whether a request came straight from the tunnel.

        Args:
            peer_ip: The socket address the request came from.

        Returns:
            bool: True if it's the tunnel container's address.
        """
        if peer_ip == self._ip:
            return True
        if time.monotonic() - self._resolved_at >= TUNNEL_RESOLVE_MIN_INTERVAL_S:
            self._resolve()
        return peer_ip == self._ip


tunnel = TunnelAddress(settings.TUNNEL_HOST)


def get_client_ip(request: Request) -> str:
    """
    Resolve the real client IP for rate limiting and vote dedup.

    Requests through the Cloudflare Tunnel all come from the tunnel container, so for
    those the visitor's IP comes from CF-Connecting-IP. Anything else (the LAN, the
    tailnet) is keyed on its own address, and a CF-Connecting-IP it sends is ignored, so
    it can't pose as someone else to get around a limit.

    Args:
        request: Incoming request.

    Returns:
        The client IP string to key rate limits on.
    """
    peer_ip = get_remote_address(request)
    forwarded_ip = request.headers.get(CLIENT_IP_HEADER)
    if forwarded_ip and tunnel.matches(peer_ip):
        return forwarded_ip.strip()
    return peer_ip


# keyed by resolved client IP. routers apply per-endpoint limits with @limiter.limit(...)
limiter = Limiter(key_func=get_client_ip)
