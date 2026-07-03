"""
Pydantic schemas for request/response validation.

Defines data structures for API endpoints including users, posts, comments,
galleries, and photos with comprehensive validation rules.
"""

from pydantic import BaseModel, Field, ConfigDict, EmailStr, field_validator
from datetime import datetime
from typing import Optional, Literal
import re


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


# Public Square Schemas
#
# Posts and comments are anonymous -- there's no author FK, just an
# optional free-text nickname. Length limits keep the SQLite file and the
# UI sane; they're not a security control (that's the rate limiter's job).
MAX_POST_TITLE_LENGTH = 200
MAX_POST_CONTENT_LENGTH = 10000
MAX_COMMENT_CONTENT_LENGTH = 5000
MAX_NICKNAME_LENGTH = 50


class PostBase(BaseModel):
    """Base post fields for creation."""
    title: str = Field(..., min_length=1, max_length=MAX_POST_TITLE_LENGTH, description="Post title")
    content: str = Field(..., min_length=1, max_length=MAX_POST_CONTENT_LENGTH, description="Post content")
    nickname: Optional[str] = Field(None, max_length=MAX_NICKNAME_LENGTH, description="Optional display name")


class PostCreate(PostBase):
    """Schema for creating a new post. No auth -- anyone can post."""
    pass


class PostRead(PostBase):
    """Post data returned in API responses."""
    id: int
    score: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


PostSortLiteral = Literal["top", "new"]


class PostList(BaseModel):
    """Paginated list of posts."""
    posts: list[PostRead]
    total: int
    page: int
    page_size: int
    total_pages: int


class CommentBase(BaseModel):
    """Base comment fields for creation."""
    content: str = Field(..., min_length=1, max_length=MAX_COMMENT_CONTENT_LENGTH, description="Comment content")
    nickname: Optional[str] = Field(None, max_length=MAX_NICKNAME_LENGTH, description="Optional display name")


class CommentCreate(CommentBase):
    """Schema for creating a new comment. No auth -- anyone can comment."""
    pass


class CommentRead(CommentBase):
    """Comment data returned in API responses."""
    id: int
    post_id: int
    score: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class VoteRequest(BaseModel):
    """Schema for casting a vote on a post or comment."""
    value: Literal[1, -1] = Field(..., description="1 to upvote, -1 to downvote")


class VoteResult(BaseModel):
    """Schema returned after a vote is applied."""
    score: int = Field(..., description="Updated net score after this vote")
    your_vote: Literal[1, -1, 0] = Field(..., description="This visitor's current vote state; 0 means no vote (retracted)")


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
    display_order: Optional[int] = None


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
    display_order: int = 0
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


# Event RSVP Schemas

# a contact is reachable by exactly one of these
CONTACT_TYPE_PHONE = "phone"
CONTACT_TYPE_EMAIL = "email"

# phone: digits only after stripping common separators, 7-15 digits per E.164
MIN_PHONE_DIGITS = 7
MAX_PHONE_DIGITS = 15
PHONE_SEPARATORS_PATTERN = re.compile(r"[\s\-\(\)\.]")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# keep friend counts sane so the form can't be used to spam huge numbers
MAX_FRIENDS_COUNT = 50


class RsvpCreate(BaseModel):
    """Schema for submitting an RSVP from the public event page."""
    event_slug: str = Field(..., min_length=1, max_length=200, description="Event slug being RSVP'd to")
    name: Optional[str] = Field(None, max_length=200, description="Submitter's name")
    contact_type: Literal["phone", "email"] = Field(..., description="Whether contact_value is a phone or email")
    contact_value: str = Field(..., min_length=1, max_length=255, description="Phone number or email address")
    friends_count: int = Field(default=0, ge=0, le=MAX_FRIENDS_COUNT, description="Extra people they're bringing")
    wants_address: bool = Field(default=False, description="Wants the exact address sent the day before")
    wants_reminder: bool = Field(default=False, description="Ok with a reminder a week or two ahead")

    @field_validator("contact_value")
    @classmethod
    def _strip_contact(cls, v: str) -> str:
        """Trim whitespace so validation and storage use a clean value."""
        return v.strip()

    def validate_contact(self) -> None:
        """
        Check contact_value matches contact_type.

        Pydantic validates each field in isolation, so this cross-field check
        runs in the router after parsing. Raises ValueError with a fixable
        message when the value doesn't look like the chosen type.
        """
        if self.contact_type == CONTACT_TYPE_EMAIL:
            if not EMAIL_PATTERN.match(self.contact_value):
                raise ValueError("that doesn't look like a valid email — check for typos")
            return
        digits = PHONE_SEPARATORS_PATTERN.sub("", self.contact_value).lstrip("+")
        if not digits.isdigit() or not (MIN_PHONE_DIGITS <= len(digits) <= MAX_PHONE_DIGITS):
            raise ValueError("that doesn't look like a valid phone number — include the area code")


class RsvpRead(BaseModel):
    """RSVP data returned to the admin panel."""
    id: int
    event_slug: str
    name: Optional[str] = None
    contact_type: str
    contact_value: str
    friends_count: int
    wants_address: bool
    wants_reminder: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


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


# Recipe Schemas
#
# Recipes are submitted anonymously from a public form (no author FK, same
# pattern as Public Square) -- every field is optional so the form can be
# filled out quickly from a phone. Create is public + rate-limited; edit and
# delete require admin auth (see recipes.py).
MAX_RECIPE_NAME_LENGTH = 200
MAX_RECIPE_DESCRIPTION_LENGTH = 10000
MAX_TAG_NAME_LENGTH = 50
MAX_TAGS_PER_RECIPE = 20
MAX_PHOTOS_PER_RECIPE = 12


class TagRead(BaseModel):
    """Tag data returned in API responses."""
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class TagWithCount(TagRead):
    """Tag data with how many recipes currently use it, for the filter UI."""
    recipe_count: int = Field(..., description="Number of recipes tagged with this tag")


class RecipePhotoRead(BaseModel):
    """Recipe photo data returned in API responses."""
    id: int
    recipe_id: int
    filename: str
    width: Optional[int] = None
    height: Optional[int] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    display_order: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RecipeRead(BaseModel):
    """Recipe data returned in API responses, including tags and photos."""
    id: int
    name: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    tags: list[TagRead] = []
    photos: list[RecipePhotoRead] = []

    model_config = ConfigDict(from_attributes=True)


class RecipeUpdate(BaseModel):
    """
    Schema for editing an existing recipe. Admin-only.

    `tags`, when provided, is a full replacement of the recipe's tag list
    (not a merge) -- the router diffs it against the current tags.
    """
    name: Optional[str] = Field(None, max_length=MAX_RECIPE_NAME_LENGTH)
    description: Optional[str] = Field(None, max_length=MAX_RECIPE_DESCRIPTION_LENGTH)
    tags: Optional[list[str]] = Field(
        None, max_length=MAX_TAGS_PER_RECIPE, description="Full replacement tag list"
    )

