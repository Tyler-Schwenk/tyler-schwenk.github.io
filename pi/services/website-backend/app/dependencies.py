"""FastAPI dependencies for auth.

Two kinds of token, both JWTs signed with JWT_SECRET (see app/routers/auth.py):

- admin (tyler): no `scope` claim. Passes everything.
- kiln editor (jude): `scope` is KILN_EDITOR_SCOPE. Only passes the kiln journal's
  write endpoints, and lets reads include private notes and photos.

Tokens are checked against the secret only, no DB lookup.
"""

from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import settings

# the scope claim on kiln editor tokens. admin tokens have no scope at all
KILN_EDITOR_SCOPE = "kiln"

bearer_scheme = HTTPBearer()
# same, but a missing header isn't an error, for endpoints anyone can read
optional_bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    """
    Builds the 401 every bad token gets.

    Args:
        detail: What was wrong and what to do about it.

    Returns:
        HTTPException: A 401 with the bearer challenge header.
    """
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def decode_token(token: str) -> dict:
    """
    Verifies a JWT and returns its claims.

    Args:
        token: The raw JWT.

    Returns:
        dict: The token's claims. Always has a `sub`.

    Raises:
        HTTPException: 401 if the token is invalid, expired, or has no subject.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise _unauthorized("invalid or expired token -- log in again") from None
    if payload.get("sub") is None:
        raise _unauthorized("invalid token -- no subject claim, log in again")
    return payload


def _can_edit_kiln(payload: dict) -> bool:
    """
    Says whether a token's claims allow writing kiln notes and photos.

    Args:
        payload: Verified token claims.

    Returns:
        bool: True for admin tokens (no scope) and kiln editor tokens.
    """
    return payload.get("scope") in (None, KILN_EDITOR_SCOPE)


def require_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> None:
    """
    Lets only the admin through. A scoped token, like the kiln editor's, is turned away.

    Args:
        credentials: HTTP Authorization header parsed by HTTPBearer.

    Raises:
        HTTPException: 401 if the token is invalid or expired, 403 if it's a scoped token.
    """
    payload = decode_token(credentials.credentials)
    if payload.get("scope") is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"this login is only for {payload['scope']} -- log in as the admin for this",
        )


def require_kiln_editor(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> None:
    """
    Lets the kiln editor or the admin through.

    Args:
        credentials: HTTP Authorization header parsed by HTTPBearer.

    Raises:
        HTTPException: 401 if the token is invalid or expired, 403 if it's scoped to
            something other than the kiln.
    """
    payload = decode_token(credentials.credentials)
    if not _can_edit_kiln(payload):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="this login can't edit the kiln page -- log in with the kiln login",
        )


def is_kiln_editor(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_bearer_scheme),
) -> bool:
    """
    Says whether a request to a public endpoint comes from the kiln editor or admin.

    A bad or expired token just means the public view rather than an error, so a stale
    login never breaks the page for its viewer.

    Args:
        credentials: The Authorization header, if one was sent.

    Returns:
        bool: True if a valid kiln editor or admin token was sent.
    """
    if credentials is None:
        return False
    try:
        payload = decode_token(credentials.credentials)
    except HTTPException:
        return False
    return _can_edit_kiln(payload)
