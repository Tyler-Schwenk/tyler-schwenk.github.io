"""
Shared rate limiter.

Lives in its own module so both `main.py` (which registers it on the app) and
individual routers (which decorate endpoints with it) can import it without a
circular import.
"""

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

# headers a trusted proxy sets with the real visitor IP, in order of preference.
# the public API is fronted by a Cloudflare Tunnel, so the raw socket address is
# always the tunnel — CF-Connecting-IP is the actual client. X-Forwarded-For is
# the generic fallback if the fronting proxy ever changes.
CLIENT_IP_HEADERS = ("cf-connecting-ip", "x-forwarded-for")


def get_client_ip(request: Request) -> str:
    """
    Resolve the real client IP for rate limiting.

    Behind the Cloudflare Tunnel the socket peer is the tunnel itself, so fall
    back through the proxy headers before using the raw remote address.

    Args:
        request: Incoming request.

    Returns:
        The client IP string to key rate limits on.
    """
    for header in CLIENT_IP_HEADERS:
        value = request.headers.get(header)
        if value:
            # X-Forwarded-For can be a comma-separated chain; the first is the client
            return value.split(",")[0].strip()
    return get_remote_address(request)


# keyed by resolved client IP. routers apply per-endpoint limits with @limiter.limit(...)
limiter = Limiter(key_func=get_client_ip)
