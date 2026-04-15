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
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        if not self.CORS_ORIGINS:
            return []
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
