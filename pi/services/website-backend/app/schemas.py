"""
Pydantic schemas for request/response validation.

Defines data structures for API endpoints including users, posts, comments,
galleries, and photos with comprehensive validation rules.
"""

from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional


# User Schemas
class UserRead(BaseModel):
    """User data returned in API responses."""
    id: int
    email: str
    username: Optional[str] = None
    is_active: bool
    is_verified: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class UserPublic(BaseModel):
    """Limited user data for public display (e.g., in posts/comments)."""
    id: int
    username: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


# Post Schemas
class PostBase(BaseModel):
    """Base post fields for creation and updates."""
    title: str = Field(..., min_length=1, max_length=200, description="Post title")
    content: str = Field(..., min_length=1, max_length=50000, description="Post content")
    is_published: bool = Field(default=True, description="Whether post is visible")


class PostCreate(PostBase):
    """Schema for creating a new post."""
    pass


class PostUpdate(BaseModel):
    """Schema for updating an existing post. All fields optional."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = Field(None, min_length=1, max_length=50000)
    is_published: Optional[bool] = None


class PostRead(PostBase):
    """Post data returned in API responses."""
    id: int
    author_id: int
    author: UserPublic
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


class PostList(BaseModel):
    """Paginated list of posts."""
    posts: list[PostRead]
    total: int
    page: int
    page_size: int
    total_pages: int


# Comment Schemas
class CommentBase(BaseModel):
    """Base comment fields for creation and updates."""
    content: str = Field(..., min_length=1, max_length=10000, description="Comment content")


class CommentCreate(CommentBase):
    """Schema for creating a new comment."""
    pass


class CommentUpdate(BaseModel):
    """Schema for updating an existing comment."""
    content: str = Field(..., min_length=1, max_length=10000)


class CommentRead(CommentBase):
    """Comment data returned in API responses."""
    id: int
    post_id: int
    author_id: int
    author: UserPublic
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


# Gallery Schemas
class GalleryBase(BaseModel):
    """Base gallery fields for creation and updates."""
    name: str = Field(..., min_length=1, max_length=200, description="Gallery name")
    description: Optional[str] = Field(None, max_length=5000, description="Gallery description")
    slug: str = Field(..., min_length=1, max_length=200, description="URL-friendly identifier")
    is_public: bool = Field(default=True, description="Whether gallery is publicly visible")


class GalleryCreate(GalleryBase):
    """Schema for creating a new gallery."""
    pass


class GalleryUpdate(BaseModel):
    """Schema for updating an existing gallery. All fields optional."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    slug: Optional[str] = Field(None, min_length=1, max_length=200)
    is_public: Optional[bool] = None


class GalleryPhotoBase(BaseModel):
    """Base gallery photo fields."""
    title: Optional[str] = Field(None, max_length=200, description="Photo title")
    description: Optional[str] = Field(None, max_length=5000, description="Photo description")
    display_order: int = Field(default=0, description="Display order in gallery")


class GalleryPhotoCreate(GalleryPhotoBase):
    """Schema for creating a new photo (metadata only, file uploaded separately)."""
    gallery_id: int


class GalleryPhotoUpdate(BaseModel):
    """Schema for updating photo metadata."""
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    display_order: Optional[int] = None


class GalleryPhotoRead(GalleryPhotoBase):
    """Gallery photo data returned in API responses."""
    id: int
    gallery_id: int
    filename: str
    file_path: str
    thumbnail_path: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class GalleryRead(GalleryBase):
    """Gallery data returned in API responses."""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    photo_count: Optional[int] = Field(None, description="Number of photos in gallery")
    
    model_config = ConfigDict(from_attributes=True)


class GalleryWithPhotos(GalleryRead):
    """Gallery with all photos included."""
    photos: list[GalleryPhotoRead] = []
    
    model_config = ConfigDict(from_attributes=True)


# Health Check Schema
class HealthCheck(BaseModel):
    """Health check response schema."""
    status: str
    version: str
    timestamp: datetime


# Video Schemas
class VideoBase(BaseModel):
    """Base video fields for creation and updates."""
    title: str = Field(..., min_length=1, max_length=200, description="Video title")
    description: Optional[str] = Field(None, max_length=5000, description="Video description")
    slug: str = Field(..., min_length=1, max_length=200, description="URL-friendly identifier")
    is_public: bool = Field(default=True, description="Whether video is publicly accessible")


class VideoCreate(VideoBase):
    """Schema for creating a new video."""
    pass


class VideoUpdate(BaseModel):
    """Schema for updating an existing video. All fields optional."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    slug: Optional[str] = Field(None, min_length=1, max_length=200)
    is_public: Optional[bool] = None


class VideoRead(VideoBase):
    """Video data returned in API responses."""
    id: int
    filename: str
    file_path: str
    thumbnail_path: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[int] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

