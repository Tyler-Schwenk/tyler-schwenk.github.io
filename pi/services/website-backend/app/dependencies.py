"""FastAPI dependencies for auth.

Three kinds of token, all JWTs signed with JWT_SECRET (see app/routers/auth.py):

- admin (tyler): no `scope` claim. Passes everything.
- kiln editor (jude): `scope` is KILN_EDITOR_SCOPE. Only passes the kiln journal's
  write endpoints, and lets reads include private notes and photos.
- guest dj: `scope` is DJ_GUEST_SCOPE, `sub` is "dj-guest:<id>". Only passes their own
  profile, their own sets, and live alerts while they're on air.

Public endpoints that show more to some logins (is_admin, is_kiln_editor) treat a bad
token as no token, so a stale login never breaks the public page.

Admin tokens are checked against the secret only. Kiln editor and guest dj tokens also
look their login up, so removing a kiln login (scripts/create_kiln_editor.py --remove) or
turning a guest off (scripts/create_dj_guest.py --disable) works straight away.
"""

from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import DjGuest, KilnEditor

# the scope claim on kiln editor tokens, and how their subject starts (the username
# follows). admin tokens have no scope at all
KILN_EDITOR_SCOPE = "kiln"
KILN_EDITOR_SUBJECT_PREFIX = "kiln-editor:"
# the scope claim on guest dj tokens, and how their subject starts (the guest's id follows)
DJ_GUEST_SCOPE = "dj"
DJ_GUEST_SUBJECT_PREFIX = "dj-guest:"

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


def kiln_editor_subject(username: str) -> str:
    """
    The `sub` claim for a kiln editor's token.

    Args:
        username: The editor's username, lowercase.

    Returns:
        str: Like "kiln-editor:jude".
    """
    return f"{KILN_EDITOR_SUBJECT_PREFIX}{username}"


def _kiln_editor_exists(db: Session, payload: dict) -> bool:
    """
    Says whether the kiln login a token belongs to is still there, so removing it with
    scripts/create_kiln_editor.py --remove turns its tokens off straight away.

    Args:
        db: Database session.
        payload: Verified token claims with the kiln scope.

    Returns:
        bool: True if the subject names a kiln editor that still exists.
    """
    subject = str(payload["sub"])
    username = subject.removeprefix(KILN_EDITOR_SUBJECT_PREFIX)
    if subject == username:
        return False
    return db.query(KilnEditor.id).filter(KilnEditor.username == username).first() is not None


def _can_edit_kiln(db: Session, payload: dict) -> bool:
    """
    Says whether a token's claims allow writing kiln notes and photos.

    Args:
        db: Database session, for looking the kiln login up.
        payload: Verified token claims.

    Returns:
        bool: True for admin tokens (no scope), and kiln editor tokens whose login still exists.
    """
    scope = payload.get("scope")
    if scope is None:
        return True
    return scope == KILN_EDITOR_SCOPE and _kiln_editor_exists(db, payload)


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
    db: Session = Depends(get_db),
) -> None:
    """
    Lets the kiln editor or the admin through.

    Args:
        credentials: HTTP Authorization header parsed by HTTPBearer.
        db: Database session, for looking the kiln login up.

    Raises:
        HTTPException: 401 if the token is invalid or expired, or its kiln login's been
            removed, 403 if it's scoped to something other than the kiln.
    """
    payload = decode_token(credentials.credentials)
    scope = payload.get("scope")
    if scope is None:
        return
    if scope == KILN_EDITOR_SCOPE:
        if not _kiln_editor_exists(db, payload):
            raise _unauthorized("this kiln login's been removed -- ask Tyler if that's a mistake")
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="this login can't edit the kiln page -- log in with the kiln login",
    )


def is_admin(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_bearer_scheme),
) -> bool:
    """
    Says whether a request to a public endpoint comes from the admin, so it can see
    private things (hidden galleries and videos).

    A bad or expired token just means the public view, same as is_kiln_editor.

    Args:
        credentials: The Authorization header, if one was sent.

    Returns:
        bool: True if a valid admin token (no scope) was sent.
    """
    if credentials is None:
        return False
    try:
        payload = decode_token(credentials.credentials)
    except HTTPException:
        return False
    return payload.get("scope") is None


def is_kiln_editor(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_bearer_scheme),
    db: Session = Depends(get_db),
) -> bool:
    """
    Says whether a request to a public endpoint comes from the kiln editor or admin.

    A bad or expired token just means the public view rather than an error, so a stale
    login never breaks the page for its viewer.

    Args:
        credentials: The Authorization header, if one was sent.
        db: Database session, for looking the kiln login up.

    Returns:
        bool: True if a valid admin token, or a kiln editor token whose login still
            exists, was sent.
    """
    if credentials is None:
        return False
    try:
        payload = decode_token(credentials.credentials)
    except HTTPException:
        return False
    return _can_edit_kiln(db, payload)


@dataclass(frozen=True)
class DjActor:
    """
    Who's making a request to an endpoint the admin and guest djs share.

    Attributes:
        guest: The guest dj, or None when it's the admin.
    """
    guest: DjGuest | None

    @property
    def is_admin(self) -> bool:
        """true for the admin, who can touch every set."""
        return self.guest is None


def dj_guest_subject(guest_id: int) -> str:
    """
    The `sub` claim for a guest dj's token.

    Args:
        guest_id: The guest's id.

    Returns:
        str: Like "dj-guest:3".
    """
    return f"{DJ_GUEST_SUBJECT_PREFIX}{guest_id}"


def _active_guest(db: Session, payload: dict) -> DjGuest:
    """
    Looks up the guest dj a token belongs to, checking their login's still on.

    Args:
        db: Database session.
        payload: Verified token claims with the dj scope.

    Returns:
        DjGuest: The guest.

    Raises:
        HTTPException: 401 if the subject's malformed, the guest's gone, or their login's off.
    """
    subject = str(payload["sub"])
    guest_id = subject.removeprefix(DJ_GUEST_SUBJECT_PREFIX)
    if subject == guest_id or not guest_id.isdigit():
        raise _unauthorized("invalid guest dj token -- log in again")
    guest = db.get(DjGuest, int(guest_id))
    if guest is None or not guest.is_active:
        raise _unauthorized("this dj login's been turned off -- ask Tyler if that's a mistake")
    return guest


def require_dj_or_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> DjActor:
    """
    Lets the admin or an active guest dj through, and says which. Endpoints that take
    this check what a guest's allowed to touch themselves (their own sets, say).

    Args:
        credentials: HTTP Authorization header parsed by HTTPBearer.
        db: Database session, for the guest lookup.

    Returns:
        DjActor: The guest, or None for the admin.

    Raises:
        HTTPException: 401 if the token is invalid, expired or its guest is off, 403 if
            it's scoped to something else (the kiln).
    """
    payload = decode_token(credentials.credentials)
    scope = payload.get("scope")
    if scope is None:
        return DjActor(guest=None)
    if scope != DJ_GUEST_SCOPE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"this login is only for {scope} -- log in as a dj or the admin for this",
        )
    return DjActor(guest=_active_guest(db, payload))


def require_dj_guest(actor: DjActor = Depends(require_dj_or_admin)) -> DjGuest:
    """
    Lets only a guest dj through, for their own profile. The admin has no profile.

    Args:
        actor: Who's asking.

    Returns:
        DjGuest: The guest.

    Raises:
        HTTPException: 403 for the admin, plus whatever require_dj_or_admin raises.
    """
    if actor.guest is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="this is a guest dj's own profile -- log in with their dj login",
        )
    return actor.guest
