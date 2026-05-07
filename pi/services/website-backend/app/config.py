"""
Configuration settings for Website Backend API.

Loads environment variables and provides typed configuration objects.
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database
    DATABASE_URL: str = "sqlite:///data/website_backend.db"
    
    # JWT Authentication
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 43200  # 30 days
    
    # CORS
    CORS_ORIGINS: str = ""
    
    # Photo Storage
    PHOTOS_DIR: str = "/app/photos"
    THUMBNAIL_MAX_WIDTH: int = 400
    THUMBNAIL_MAX_HEIGHT: int = 400
    THUMBNAIL_QUALITY: int = 85
    
    # Video Storage
    VIDEOS_DIR: str = "/app/videos"
    VIDEO_THUMBNAIL_WIDTH: int = 1280
    
    # API Metadata
    API_TITLE: str = "Website Backend API"
    API_VERSION: str = "1.0.0"
    API_DESCRIPTION: str = "Backend API for forum (Public Square) and photo galleries"

    # Data directory (where SQLite and state files live inside the container)
    DATA_DIR: str = "/app/data"

    # Twilio SMS credentials
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""  # E.164, e.g. +15551234567

    # Trash reminders
    ROOMMATE_PHONES: str = ""  # comma-separated E.164 numbers
    TRASH_REMINDER_HOUR: int = 18  # 6 PM local time
    TRASH_TIMEZONE: str = "America/Los_Angeles"
    TRASH_QUIET_START_HOUR: int = 22  # no texts from 10 PM ...
    TRASH_QUIET_END_HOUR: int = 8    # ... to 8 AM
    TRASH_INITIAL_MESSAGE: str = (
        "Hey! Don't forget to take out the trash tonight. "
        "Reply 'done' when it's out."
    )
    TRASH_FOLLOWUP_MESSAGE: str = (
        "Reminder: trash still needs to go out! "
        "Reply 'done' when it's taken care of."
    )
    # exact public URL Twilio POSTs to — must match what's configured in the Twilio console
    TRASH_WEBHOOK_URL: str = "https://api.tyler-schwenk.com/trash/reply"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        if not self.CORS_ORIGINS:
            return []
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def roommate_phones_list(self) -> List[str]:
        """Parse roommate phone numbers from comma-separated string."""
        if not self.ROOMMATE_PHONES:
            return []
        return [p.strip() for p in self.ROOMMATE_PHONES.split(",")]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
