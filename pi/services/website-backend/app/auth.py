"""
Authentication configuration using FastAPI-Users.

Provides user authentication, registration, and JWT token management.
"""

from fastapi_users import FastAPIUsers
from fastapi_users.authentication import AuthenticationBackend, BearerTransport, JWTStrategy
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import User
from app.config import settings


bearer_transport = BearerTransport(tokenUrl="auth/login")


def get_jwt_strategy() -> JWTStrategy:
    """
    Create JWT authentication strategy.
    
    Returns:
        JWTStrategy configured with secret key and token lifetime
    """
    return JWTStrategy(
        secret=settings.JWT_SECRET,
        lifetime_seconds=settings.JWT_EXPIRATION_MINUTES * 60,
        algorithm=settings.JWT_ALGORITHM
    )


auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)


async def get_user_db(session: AsyncSession):
    """
    Dependency to get user database adapter.
    
    Args:
        session: Async database session
        
    Yields:
        SQLAlchemyUserDatabase: User database adapter
    """
    yield SQLAlchemyUserDatabase(session, User)


fastapi_users = FastAPIUsers[User, int](
    get_user_db,
    [auth_backend],
)

# Dependency to get current active user
current_active_user = fastapi_users.current_user(active=True)

# Dependency to get current user (optional, for public endpoints)
current_user_optional = fastapi_users.current_user(optional=True)
