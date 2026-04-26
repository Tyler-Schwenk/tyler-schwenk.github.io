"""Auth router — handles login and returns a JWT.

Single-user admin auth. No registration endpoint — use scripts/create_admin.py
to create your account. Token lasts 30 days.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/auth", tags=["Auth"])

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _verify_password(plain: str, hashed: str) -> bool:
    """Check a plain-text password against its bcrypt hash."""
    return _pwd_context.verify(plain, hashed)


def _create_access_token(email: str) -> str:
    """
    Create a signed JWT for the given email.

    Args:
        email: User email to embed in the token subject.

    Returns:
        Signed JWT string valid for JWT_EXPIRATION_MINUTES.
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.JWT_EXPIRATION_MINUTES
    )
    payload = {"sub": email, "exp": expire}
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
    if not user or not _verify_password(form_data.password, user.hashed_password):
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

    token = _create_access_token(user.email)
    return {"access_token": token, "token_type": "bearer"}
