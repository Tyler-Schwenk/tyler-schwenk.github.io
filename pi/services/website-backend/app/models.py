"""
SQLAlchemy database models.

Defines database schema for users, posts, comments, galleries, and photos.
"""

from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from fastapi_users.db import SQLAlchemyBaseUserTable
from app.database import Base


class User(SQLAlchemyBaseUserTable[int], Base):
    """
    User model for authentication and profile.
    
    Extends FastAPI-Users base table with additional fields.
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
    
    # Relationships
    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="author", cascade="all, delete-orphan")


class Post(Base):
    """
    Post model representing a forum thread or article.
    
    Attributes:
        id: Unique identifier
        title: Post title
        content: Post body content
        author_id: Foreign key to User
        created_at: Timestamp of creation
        updated_at: Timestamp of last update
        is_published: Whether post is visible to public
    """
    __tablename__ = "posts"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    content = Column(Text, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_published = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    author = relationship("User", back_populates="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")


class Comment(Base):
    """
    Comment model representing a reply to a post.
    
    Attributes:
        id: Unique identifier
        content: Comment text
        post_id: Foreign key to Post
        author_id: Foreign key to User
        created_at: Timestamp of creation
        updated_at: Timestamp of last update
    """
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    post = relationship("Post", back_populates="comments")
    author = relationship("User", back_populates="comments")


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
