"""
SQLAlchemy database models.

Defines database schema for users, Public Square posts/comments/votes,
galleries, photos, and recipes.
"""

from sqlalchemy import Boolean, Column, Integer, String, Table, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from fastapi_users.db import SQLAlchemyBaseUserTable
from app.database import Base


class User(SQLAlchemyBaseUserTable[int], Base):
    """
    User model for authentication and profile.

    Extends FastAPI-Users base table with additional fields. In practice the
    only account that ever gets created is the single site admin (see
    auth.py) -- Public Square posts/comments are anonymous and don't link
    back to this table.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)

    # Custom fields
    username = Column(String(50), unique=True, index=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Post(Base):
    """
    Post model representing a Public Square forum thread.

    Anonymous by design -- no author FK. Anyone can post; an optional
    free-text nickname is stored for display only (not verified, not
    unique).

    Attributes:
        id: Unique identifier
        title: Post title
        content: Post body content
        nickname: Optional free-text display name chosen by the poster
        score: Denormalized net vote count (upvotes minus downvotes), kept
            in sync by the public_square router whenever a PostVote changes
        created_at: Timestamp of creation
        updated_at: Timestamp of last update
        is_published: Whether post is visible to public
    """
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    content = Column(Text, nullable=False)
    nickname = Column(String(50), nullable=True)
    score = Column(Integer, default=0, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_published = Column(Boolean, default=True, nullable=False)

    # Relationships
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    votes = relationship("PostVote", back_populates="post", cascade="all, delete-orphan")


class Comment(Base):
    """
    Comment model representing a reply to a Public Square post.

    Flat/top-level only in v1 -- comments reply to a post, not to each
    other. Anonymous by design, same as Post.

    Attributes:
        id: Unique identifier
        content: Comment text
        post_id: Foreign key to Post
        nickname: Optional free-text display name chosen by the commenter
        score: Denormalized net vote count, kept in sync by the
            public_square router whenever a CommentVote changes
        created_at: Timestamp of creation
        updated_at: Timestamp of last update
    """
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    nickname = Column(String(50), nullable=True)
    score = Column(Integer, default=0, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    post = relationship("Post", back_populates="comments")
    votes = relationship("CommentVote", back_populates="comment", cascade="all, delete-orphan")


class PostVote(Base):
    """
    One anonymous vote on a Post, keyed by hashed visitor IP.

    Raw IPs are never stored -- ip_hash is sha256(ip + IP_HASH_SALT). The
    unique constraint on (post_id, ip_hash) is what makes one IP = one vote
    per post, and lets the router detect "voting again" as a toggle/flip
    instead of a duplicate.

    Attributes:
        id: Unique identifier
        post_id: Foreign key to Post
        ip_hash: Hashed visitor IP this vote belongs to
        value: 1 for upvote, -1 for downvote
        created_at: Timestamp of the (most recent) vote
    """
    __tablename__ = "post_votes"
    __table_args__ = (UniqueConstraint("post_id", "ip_hash", name="uq_post_votes_post_ip"),)

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False, index=True)
    ip_hash = Column(String(64), nullable=False, index=True)
    value = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    post = relationship("Post", back_populates="votes")


class CommentVote(Base):
    """
    One anonymous vote on a Comment, keyed by hashed visitor IP.

    Same shape and semantics as PostVote -- see that docstring for details
    on the IP hashing and unique-constraint-based toggle behavior.

    Attributes:
        id: Unique identifier
        comment_id: Foreign key to Comment
        ip_hash: Hashed visitor IP this vote belongs to
        value: 1 for upvote, -1 for downvote
        created_at: Timestamp of the (most recent) vote
    """
    __tablename__ = "comment_votes"
    __table_args__ = (UniqueConstraint("comment_id", "ip_hash", name="uq_comment_votes_comment_ip"),)

    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(Integer, ForeignKey("comments.id"), nullable=False, index=True)
    ip_hash = Column(String(64), nullable=False, index=True)
    value = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    comment = relationship("Comment", back_populates="votes")


class Gallery(Base):
    """
    Gallery model representing a photo album or collection.
    
    Attributes:
        id: Unique identifier
        name: Gallery name
        description: Gallery description
        slug: URL-friendly identifier
        is_public: Whether gallery is visible to public
        display_order: Sort order — higher values shown first; new galleries auto-get max+10
        created_at: Timestamp of creation
        updated_at: Timestamp of last update
    """
    __tablename__ = "galleries"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    slug = Column(String(200), unique=True, nullable=False, index=True)
    is_public = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    photos = relationship("GalleryPhoto", back_populates="gallery", cascade="all, delete-orphan")


class GalleryPhoto(Base):
    """
    GalleryPhoto model representing a photo within a gallery.
    
    Attributes:
        id: Unique identifier
        gallery_id: Foreign key to Gallery
        filename: Original uploaded filename
        file_path: Path to stored file on disk
        thumbnail_path: Path to thumbnail file
        title: Photo title
        description: Photo description
        width: Image width in pixels
        height: Image height in pixels
        file_size: File size in bytes
        mime_type: File MIME type
        display_order: Order of photo in gallery
        created_at: Timestamp of upload
    """
    __tablename__ = "gallery_photos"
    
    id = Column(Integer, primary_key=True, index=True)
    gallery_id = Column(Integer, ForeignKey("galleries.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    thumbnail_path = Column(String(500), nullable=True)
    title = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    display_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    gallery = relationship("Gallery", back_populates="photos")


class EventRsvp(Base):
    """
    RSVP submission for an event.

    Captures one contact (phone or email), how many friends they're bringing,
    and which follow-ups they opted into. Public-facing form writes these;
    admin panel reads them back.

    Attributes:
        id: Unique identifier
        event_slug: Slug of the event this RSVP is for (matches frontend EVENTS data)
        name: Optional name they provided
        contact_type: Either "phone" or "email" — tells you how to reach them
        contact_value: The phone number or email address itself
        friends_count: How many extra people they're bringing (0 = just them)
        wants_address: They want the exact address sent the day before
        wants_reminder: They're ok getting a reminder a week or two ahead
        created_at: Timestamp of submission
    """
    __tablename__ = "event_rsvps"

    id = Column(Integer, primary_key=True, index=True)
    event_slug = Column(String(200), nullable=False, index=True)
    name = Column(String(200), nullable=True)
    contact_type = Column(String(10), nullable=False)
    contact_value = Column(String(255), nullable=False)
    friends_count = Column(Integer, default=0, nullable=False)
    wants_address = Column(Boolean, default=False, nullable=False)
    wants_reminder = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Video(Base):
    """
    Video model representing a hosted video file.
    
    Attributes:
        id: Unique identifier
        filename: Original uploaded filename
        file_path: Path to stored video file on disk
        thumbnail_path: Path to video thumbnail/poster image
        title: Video title
        description: Video description
        width: Video width in pixels
        height: Video height in pixels
        duration: Video duration in seconds
        file_size: File size in bytes
        mime_type: Video MIME type (e.g., video/mp4)
        is_public: Whether video is publicly accessible
        slug: URL-friendly identifier for the video
        created_at: Timestamp of upload
    """
    __tablename__ = "videos"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    thumbnail_path = Column(String(500), nullable=True)
    title = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration = Column(Integer, nullable=True)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    is_public = Column(Boolean, default=True, nullable=False)
    slug = Column(String(200), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# Many-to-many join between recipes and tags. A plain association table (no
# extra columns needed) rather than a mapped class, per SQLAlchemy convention.
recipe_tags = Table(
    "recipe_tags",
    Base.metadata,
    Column("recipe_id", Integer, ForeignKey("recipes.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id"), primary_key=True),
)


class Recipe(Base):
    """
    Recipe model for The Kitchen recipe box.

    Submitted from the public "add a recipe" form -- every field but the
    id/timestamps is optional, since the form is meant to be filled out
    quickly from a phone. Anonymous by design (no author FK), same as
    Public Square posts; only admin can edit/delete via the JWT-gated
    endpoints.

    Attributes:
        id: Unique identifier
        name: Recipe name
        description: Recipe description/instructions
        created_at: Timestamp of submission
        updated_at: Timestamp of last edit
    """
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=True, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    photos = relationship(
        "RecipePhoto", back_populates="recipe", cascade="all, delete-orphan",
        order_by="RecipePhoto.display_order",
    )
    tags = relationship("Tag", secondary=recipe_tags, back_populates="recipes")


class Tag(Base):
    """
    Freeform tag usable across recipes (e.g. "breakfast", "quick", "vegan").

    Created on the fly when a recipe is submitted with a tag name that
    doesn't exist yet -- see recipes.py's `_get_or_create_tags`.

    Attributes:
        id: Unique identifier
        name: Tag label, unique (case-insensitive matching handled by the router)
        created_at: Timestamp the tag was first created
    """
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    recipes = relationship("Recipe", secondary=recipe_tags, back_populates="tags")


class RecipePhoto(Base):
    """
    RecipePhoto model representing a photo attached to a recipe.

    Same shape as GalleryPhoto -- see that model's docstring for field
    semantics. Stored under settings.RECIPE_PHOTOS_DIR instead of
    settings.PHOTOS_DIR so recipe photos don't mix into the gallery's
    directory tree.

    Attributes:
        id: Unique identifier
        recipe_id: Foreign key to Recipe
        filename: Original uploaded filename
        file_path: Path to stored file on disk (relative to RECIPE_PHOTOS_DIR)
        thumbnail_path: Path to thumbnail file (relative to RECIPE_PHOTOS_DIR)
        width: Image width in pixels
        height: Image height in pixels
        file_size: File size in bytes
        mime_type: File MIME type
        display_order: Order of photo within the recipe
        created_at: Timestamp of upload
    """
    __tablename__ = "recipe_photos"

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    thumbnail_path = Column(String(500), nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    display_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    recipe = relationship("Recipe", back_populates="photos")
