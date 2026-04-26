"""
Website Backend API - Main application entry point.

Backend API providing forum (Public Square) and photo gallery services.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager
from datetime import datetime

from app.config import settings
from app.database import init_db
from app.schemas import HealthCheck
from app.routers import gallery, videos, auth


# Rate limiter instance
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    
    Initializes database on startup.
    """
    # Startup: Initialize database
    init_db()
    yield
    # Shutdown: cleanup if needed


# Create FastAPI application
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description=settings.API_DESCRIPTION,
    lifespan=lifespan
)

# Add rate limiter state to app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/health", response_model=HealthCheck, tags=["System"])
async def health_check():
    """
    Health check endpoint for monitoring.
    
    Returns:
        HealthCheck: System status and version information
    """
    return HealthCheck(
        status="healthy",
        version=settings.API_VERSION,
        timestamp=datetime.utcnow()
    )


# Root endpoint
@app.get("/", tags=["System"])
async def root():
    """
    Root endpoint with API information.
    
    Returns:
        dict: API name and version
    """
    return {
        "name": settings.API_TITLE,
        "version": settings.API_VERSION,
        "docs": "/docs",
        "health": "/health"
    }


# Include routers
app.include_router(auth.router)
app.include_router(gallery.router)
app.include_router(videos.router)
