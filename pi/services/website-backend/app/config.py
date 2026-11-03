"""
Configuration settings for Website Backend API.

Loads environment variables and provides typed configuration objects.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    # Database
    DATABASE_URL: str = "sqlite:///data/website_backend.db"
    
    # JWT Authentication
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 43200  # 30 days

    # Public Square — salt mixed into visitor IPs before hashing for anonymous
    # vote/spam dedup. Raw IPs are never stored. Generate like JWT_SECRET,
    # e.g. `openssl rand -hex 32`.
    IP_HASH_SALT: str

    # Display kiosk remote control -- shared secret the surfcam agent on
    # displaytop sends (X-Kiosk-Token) to pick up remote presses and push its
    # key log. Empty turns those endpoints off. Generate with
    # `openssl rand -hex 32`; the same value goes in ~/surfcam-agent/kiosk-token
    # on displaytop (see pi/docs/services/display-kiosk.md).
    KIOSK_TOKEN: str = ""

    # Kiln logger -- shared secret the logger on castpi sends (X-Kiln-Token) to
    # store readings. Empty turns that endpoint off. Generate with
    # `openssl rand -hex 32`; the same value goes in /etc/kiln-logger/token on
    # castpi (see pi/docs/services/kiln-logger.md).
    KILN_TOKEN: str = ""

    # CORS
    CORS_ORIGINS: str = ""
    
    # Photo Storage
    PHOTOS_DIR: str = "/app/photos"
    THUMBNAIL_MAX_WIDTH: int = 400
    THUMBNAIL_MAX_HEIGHT: int = 400
    THUMBNAIL_QUALITY: int = 85
    # quality for re-encoding HEIC/rotated uploads to JPEG (distinct from
    # THUMBNAIL_QUALITY -- this one is the full-size image, so it's higher)
    UPLOAD_JPEG_QUALITY: int = 90
    
    # Video Storage
    VIDEOS_DIR: str = "/app/videos"
    VIDEO_THUMBNAIL_WIDTH: int = 1280

    # Recipe Photo Storage
    RECIPE_PHOTOS_DIR: str = "/app/recipe_photos"

    # Entrance song: its mp3 and rendered wav (see pi/docs/services/entrance-song.md)
    ENTRANCE_DIR: str = "/app/entrance"

    # Speaker agent on displaytop, which plays everything on the big speakers
    # (see pi/docs/services/speaker-agent.md)
    SPEAKER_AGENT_URL: str = "http://192.168.1.192:8771"

    # Pac-Tyler data (written by pac-tyler-updater, mounted as a volume)
    PAC_TYLER_DATA_DIR: str = "/app/pac-tyler"
    
    # API Metadata
    API_TITLE: str = "Website Backend API"
    API_VERSION: str = "1.0.0"
    API_DESCRIPTION: str = "Backend API for Public Square (forum) and photo galleries"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        if not self.CORS_ORIGINS:
            return []
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


# Global settings instance
settings = Settings()
