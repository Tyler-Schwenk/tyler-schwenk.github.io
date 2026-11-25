"""
Videos router for video hosting and streaming.

Provides endpoints for uploading videos, managing metadata, and streaming
video content with support for range requests (seeking).

Private videos (is_public false) only show up for the admin in the list and when read by
id or slug. The stream and thumbnail are still served by id to anyone, since <video> and
<img> tags can't send the admin token.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pathlib import Path
import subprocess
import json
import logging

from app.database import get_db
from app.dependencies import is_admin, require_admin
from app.file_streaming import ranged_file_response
from app.image_utils import save_upload_file
from app.models import Video
from app.schemas import VideoCreate, VideoUpdate, VideoRead
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/videos", tags=["Videos"])

SUPPORTED_VIDEO_TYPES = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/ogg": ".ogv",
    "video/quicktime": ".mov"
}

# ffprobe/ffmpeg can hang on a corrupt file, so cap how long we wait
FFMPEG_TIMEOUT_S = 30

VIDEO_NOT_FOUND = "Video not found"


def visible_video(video: Optional[Video], admin: bool) -> Video:
    """
    Hands back a video this viewer may see, or 404s. Private ones get the same 404 as a
    missing one for anyone but the admin, so they don't show they exist.

    Args:
        video: The video looked up, or None if there wasn't one.
        admin: Whether the admin's asking.

    Returns:
        Video: The video.

    Raises:
        HTTPException: 404 if it's missing, or private and this isn't the admin.
    """
    if video is None or not (video.is_public or admin):
        raise HTTPException(status_code=404, detail=VIDEO_NOT_FOUND)
    return video


def extract_video_metadata(video_path: Path) -> dict:
    """
    Extract video metadata using ffprobe.
    
    Args:
        video_path: Path to video file
        
    Returns:
        Dictionary containing width, height, and duration
    """
    try:
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            str(video_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT_S)

        if result.returncode != 0:
            logger.warning(
                "ffprobe exited %s for %s: %s",
                result.returncode, video_path.name, result.stderr.strip(),
            )
            return {}

        data = json.loads(result.stdout)
        video_stream = next(
            (s for s in data.get("streams", []) if s.get("codec_type") == "video"),
            None
        )

        if not video_stream:
            return {}

        return {
            "width": video_stream.get("width"),
            "height": video_stream.get("height"),
            "duration": int(float(data.get("format", {}).get("duration", 0)))
        }
    except Exception as e:
        logger.warning("ffprobe failed for %s: %s", video_path.name, e)
        return {}


def generate_video_thumbnail(video_path: Path, thumbnail_path: Path, time_offset: int = 1) -> bool:
    """
    Generate a thumbnail from video at specified time offset.
    
    Args:
        video_path: Path to source video
        thumbnail_path: Path where thumbnail should be saved
        time_offset: Time in seconds to capture thumbnail
        
    Returns:
        True if successful, False otherwise
    """
    try:
        thumbnail_path.parent.mkdir(parents=True, exist_ok=True)
        cmd = [
            "ffmpeg",
            "-ss", str(time_offset),
            "-i", str(video_path),
            "-vframes", "1",
            "-vf", f"scale={settings.VIDEO_THUMBNAIL_WIDTH}:-1",
            "-y",
            str(thumbnail_path)
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=FFMPEG_TIMEOUT_S)
        return result.returncode == 0
    except Exception as e:
        logger.warning("thumbnail generation failed for %s: %s", video_path.name, e)
        return False


@router.get("", response_model=List[VideoRead])
async def list_videos(
    skip: int = 0,
    limit: int = 100,
    public_only: bool = True,
    db: Session = Depends(get_db),
    admin: bool = Depends(is_admin),
):
    """
    List all videos.

    Args:
        skip: Number of videos to skip (pagination)
        limit: Maximum number of videos to return
        public_only: If True, only return public videos. Only the admin can turn it
            off; anyone else always gets just the public ones.
        db: Database session
        admin: Whether the admin's asking.

    Returns:
        List of videos
    """
    query = db.query(Video)
    if public_only or not admin:
        query = query.filter(Video.is_public == True)

    videos = query.offset(skip).limit(limit).all()
    return videos


@router.get("/{video_id}", response_model=VideoRead)
async def get_video(video_id: int, db: Session = Depends(get_db), admin: bool = Depends(is_admin)):
    """
    Get a specific video by ID.

    Args:
        video_id: Video ID
        db: Database session
        admin: Whether the admin's asking.

    Returns:
        Video metadata

    Raises:
        HTTPException: 404 if it's missing, or private and this isn't the admin.
    """
    video = db.query(Video).filter(Video.id == video_id).first()
    return visible_video(video, admin)


@router.get("/slug/{slug}", response_model=VideoRead)
async def get_video_by_slug(slug: str, db: Session = Depends(get_db), admin: bool = Depends(is_admin)):
    """
    Get a video by its URL slug.

    Args:
        slug: Video slug
        db: Database session
        admin: Whether the admin's asking.

    Returns:
        Video metadata

    Raises:
        HTTPException: 404 if it's missing, or private and this isn't the admin.
    """
    video = db.query(Video).filter(Video.slug == slug).first()
    return visible_video(video, admin)


@router.post("", response_model=VideoRead, status_code=status.HTTP_201_CREATED)
async def upload_video(
    file: UploadFile = File(...),
    title: str = Form(...),
    slug: str = Form(...),
    description: Optional[str] = Form(None),
    is_public: bool = Form(True),
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Upload a new video file.
    
    Args:
        file: Video file to upload
        title: Video title
        slug: URL-friendly identifier
        description: Video description
        is_public: Whether video is publicly accessible
        db: Database session
        
    Returns:
        Created video metadata
    """
    if file.content_type not in SUPPORTED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video type. Supported types: {', '.join(SUPPORTED_VIDEO_TYPES.keys())}"
        )
    
    existing = db.query(Video).filter(Video.slug == slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Video with this slug already exists")
    
    videos_dir = Path(settings.VIDEOS_DIR)
    videos_dir.mkdir(parents=True, exist_ok=True)
    
    file_extension = SUPPORTED_VIDEO_TYPES.get(file.content_type, ".mp4")
    file_path = videos_dir / f"{slug}{file_extension}"
    
    save_upload_file(file, file_path)
    
    file_size = file_path.stat().st_size
    
    metadata = extract_video_metadata(file_path)
    
    thumbnail_path = videos_dir / "thumbnails" / f"{slug}.jpg"
    thumbnail_generated = generate_video_thumbnail(file_path, thumbnail_path)
    
    db_video = Video(
        filename=file.filename,
        file_path=str(file_path),
        thumbnail_path=str(thumbnail_path) if thumbnail_generated else None,
        title=title,
        description=description,
        slug=slug,
        is_public=is_public,
        width=metadata.get("width"),
        height=metadata.get("height"),
        duration=metadata.get("duration"),
        file_size=file_size,
        mime_type=file.content_type
    )
    
    db.add(db_video)
    db.commit()
    db.refresh(db_video)
    
    return db_video


@router.patch("/{video_id}", response_model=VideoRead)
async def update_video(
    video_id: int,
    video_update: VideoUpdate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Update video metadata.
    
    Args:
        video_id: Video ID
        video_update: Fields to update
        db: Database session
        
    Returns:
        Updated video
    """
    db_video = db.query(Video).filter(Video.id == video_id).first()
    if not db_video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    update_data = video_update.model_dump(exclude_unset=True)
    
    if "slug" in update_data and update_data["slug"] != db_video.slug:
        existing = db.query(Video).filter(Video.slug == update_data["slug"]).first()
        if existing:
            raise HTTPException(status_code=400, detail="Video with this slug already exists")
    
    for field, value in update_data.items():
        setattr(db_video, field, value)
    
    db.commit()
    db.refresh(db_video)
    
    return db_video


@router.delete("/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(
    video_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Delete a video and its files.
    
    Args:
        video_id: Video ID
        db: Database session
    """
    db_video = db.query(Video).filter(Video.id == video_id).first()
    if not db_video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    video_path = Path(db_video.file_path)
    if video_path.exists():
        video_path.unlink()
    
    if db_video.thumbnail_path:
        thumbnail_path = Path(db_video.thumbnail_path)
        if thumbnail_path.exists():
            thumbnail_path.unlink()
    
    db.delete(db_video)
    db.commit()


@router.get("/{video_id}/stream")
async def stream_video(video_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Stream video content with proper HTTP range request support for seeking.

    Handles the Range header so browsers can seek without downloading the whole file.
    Returns 206 Partial Content for range requests, 200 for full requests.

    Args:
        video_id: Video ID
        request: Incoming HTTP request (needed to read Range header)
        db: Database session

    Returns:
        StreamingResponse with 206 for range requests, FileResponse for full requests.
    """
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    video_path = Path(video.file_path)
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")

    return ranged_file_response(video_path, video.mime_type or "video/mp4", request.headers.get("range"))


@router.get("/{video_id}/thumbnail")
async def get_video_thumbnail(video_id: int, db: Session = Depends(get_db)):
    """
    Get video thumbnail image.
    
    Args:
        video_id: Video ID
        db: Database session
        
    Returns:
        Thumbnail image file
    """
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if not video.thumbnail_path:
        raise HTTPException(status_code=404, detail="Thumbnail not available")
    
    thumbnail_path = Path(video.thumbnail_path)
    if not thumbnail_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail file not found")
    
    return FileResponse(
        path=str(thumbnail_path),
        media_type="image/jpeg"
    )
