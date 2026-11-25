"""
Website Backend API - Main application entry point.

Backend API providing forum (Public Square), photo gallery, and recipe box
(The Kitchen) services, plus the relay that lets the admin page remote
control the display kiosk, the kiln logger's readings and firings with
Jude's notes and photos on them, the entrance song on the big speakers,
who's home, the house fly kill count, each house machine's storage and
memory for the monitor page, and the live dj stream with its recorded sets, room chat
and the emails telling people it's live.
"""

import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone

from app import dj_stream
from app.config import settings
from app.database import init_db
from app.rate_limit import limiter
from app.schemas import HealthCheck
from app.routers import gallery, videos, auth, pac_tyler, rsvp, public_square, recipes, mallard, display_control, kiln, kiln_journal, entrance, presence, fly_kills, dj, dj_chat, dj_room, dj_alerts, dj_guests, monitor


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Initializes the database and starts the dj stream watcher on startup, and stops the
    watcher on shutdown (which finishes any set it's recording).
    """
    init_db()
    dj_watcher_task = asyncio.create_task(dj_stream.watcher.run())
    yield
    dj_watcher_task.cancel()
    with suppress(asyncio.CancelledError):
        await dj_watcher_task


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
        timestamp=datetime.now(timezone.utc)
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
app.include_router(pac_tyler.router)
app.include_router(rsvp.router)
app.include_router(public_square.router)
app.include_router(recipes.router)
app.include_router(mallard.router)
app.include_router(display_control.router)
app.include_router(kiln.router)
app.include_router(kiln_journal.router)
app.include_router(entrance.router)
app.include_router(presence.router)
app.include_router(fly_kills.router)
app.include_router(dj.router)
app.include_router(dj_chat.router)
app.include_router(dj_room.router)
app.include_router(dj_alerts.router)
app.include_router(dj_guests.router)
app.include_router(monitor.router)
