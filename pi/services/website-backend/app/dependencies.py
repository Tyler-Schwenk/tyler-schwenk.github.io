"""FastAPI dependencies for auth.

Provides `require_admin` — a dependency for protecting write endpoints.
JWT is validated against the app's secret key, no DB lookup needed.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from app.config import settings

bearer_scheme = HTTPBearer()


def require_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> None:
    """
    Validates a Bearer JWT token.

    Raises 401 if the token is missing, expired, or invalid. There's only
    one admin (tyler), so we just verify the token is legit — no user lookup.

    Args:
        credentials: HTTP Authorization header parsed by HTTPBearer.

    Raises:
        HTTPException: 401 if the token is invalid or expired.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("sub") is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid token — no subject claim",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or expired token — log in again",
            headers={"WWW-Authenticate": "Bearer"},
        )
