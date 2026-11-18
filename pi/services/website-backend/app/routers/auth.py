"""Auth router — handles login and returns a JWT.

Single-user admin auth. No registration endpoint — use scripts/create_admin.py
to create your account. Token lasts 30 days. The kiln editor has its own login
(app/routers/kiln_journal.py) that reuses the helpers here.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
import bcrypt
from jose import jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/auth", tags=["Auth"])


def verify_password(plain: str, hashed: str) -> bool:
    """
    Check a plain-text password against its bcrypt hash.

    Args:
        plain: The password as typed.
        hashed: The stored bcrypt hash.

    Returns:
        True if they match.
    """
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(subject: str, scope: Optional[str] = None) -> str:
    """
    Create a signed JWT for a login.

    Args:
        subject: Who it's for, embedded as the `sub` claim.
        scope: Limits what the token can do (see app/dependencies.py). None for the
            admin, whose tokens can do everything.

    Returns:
        Signed JWT string valid for JWT_EXPIRATION_MINUTES.
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.JWT_EXPIRATION_MINUTES
    )
    payload = {"sub": subject, "exp": expire}
    if scope is not None:
        payload["scope"] = scope
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Login endpoint — validates email/password and returns a 30-day JWT.

    Uses the OAuth2 password form convention where `username` = email.

    Args:
        form_data: Form with username (email) and password fields.
        db: Database session.

    Returns:
        Dict with access_token and token_type.

    Raises:
        HTTPException: 401 if credentials are wrong, 403 if account is disabled.
    """
    user = db.query(User).filter(User.email == form_data.username).first()

    # deliberately vague — don't leak whether the email exists
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="account is disabled",
        )

    token = create_access_token(user.email)
    return {"access_token": token, "token_type": "bearer"}
