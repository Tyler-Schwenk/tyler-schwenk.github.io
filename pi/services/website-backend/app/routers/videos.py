"""
Videos router for video hosting and streaming.

Provides endpoints for uploading videos, managing metadata, and streaming
video content with support for range requests (seeking).
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pathlib import Path
import shutil
import subprocess
import json
import uuid

from app.database import get_db
from app.dependencies import require_admin
from app.models import Video
from app.schemas import VideoCreate, VideoUpdate, VideoRead
from app.config import settings


router = APIRouter(prefix="/videos", tags=["Videos"])

SUPPORTED_VIDEO_TYPES = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/ogg": ".ogv",
    "video/quicktime": ".mov"
}

# temp storage for in-progress chunked uploads — cleaned up on complete/failure
TEMP_UPLOADS_DIR = Path("/tmp/video_uploads")


def save_upload_file(upload_file: UploadFile, destination: Path) -> None:
    """
    Save uploaded file to destination path.
    
    Args:
        upload_file: The uploaded file object
        destination: Path where file should be saved
    """
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)


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
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
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
    except Exception:
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
        result = subprocess.run(cmd, capture_output=True, timeout=30)
        return result.returncode == 0
    except Exception:
        return False


@router.post("/upload/initiate")
async def initiate_chunked_upload(
    filename: str = Form(...),
    total_chunks: int = Form(...),
    mime_type: str = Form(...),
    _: None = Depends(require_admin),
):
    """
    Start a chunked video upload session.

    Creates a temp directory for chunk storage and returns an upload_id to
    reference in subsequent chunk and complete requests.

    Args:
        filename: Original filename of the video.
        total_chunks: Total number of chunks that will be sent.
        mime_type: MIME type of the video (must be a supported type).

    Returns:
        Dict with upload_id string.
    """
    if mime_type not in SUPPORTED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video type. Supported: {', '.join(SUPPORTED_VIDEO_TYPES.keys())}"
        )

    upload_id = str(uuid.uuid4())
    upload_dir = TEMP_UPLOADS_DIR / upload_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    meta = {"filename": filename, "total_chunks": total_chunks, "mime_type": mime_type}
    (upload_dir / "metadata.json").write_text(json.dumps(meta))

    return {"upload_id": upload_id}


@router.post("/upload/chunk")
async def upload_chunk(
    upload_id: str = Form(...),
    chunk_index: int = Form(...),
    file: UploadFile = File(...),
    _: None = Depends(require_admin),
):
    """
    Upload a single chunk of a chunked video upload.

    Chunks can arrive in any order and are stored by index. Call
    /upload/complete once all chunks are sent.

    Args:
        upload_id: Upload session ID returned by /upload/initiate.
        chunk_index: Zero-based index of this chunk.
        file: The chunk data.

    Returns:
        Dict with received_chunks and total_chunks counts.
    """
    upload_dir = TEMP_UPLOADS_DIR / upload_id

    # prevent path traversal
    if not str(upload_dir.resolve()).startswith(str(TEMP_UPLOADS_DIR.resolve())):
        raise HTTPException(status_code=400, detail="Invalid upload ID.")

    if not upload_dir.exists():
        raise HTTPException(status_code=404, detail="Upload session not found. Start a new upload.")

    meta = json.loads((upload_dir / "metadata.json").read_text())
    total_chunks = meta["total_chunks"]

    if chunk_index < 0 or chunk_index >= total_chunks:
        raise HTTPException(status_code=400, detail=f"chunk_index must be 0-{total_chunks - 1}.")

    chunk_path = upload_dir / f"{chunk_index}.chunk"
    save_upload_file(file, chunk_path)

    received = len(list(upload_dir.glob("*.chunk")))
    return {"received_chunks": received, "total_chunks": total_chunks}


@router.post("/upload/complete", response_model=VideoRead, status_code=status.HTTP_201_CREATED)
async def complete_chunked_upload(
    upload_id: str = Form(...),
    title: str = Form(...),
    slug: str = Form(...),
    description: Optional[str] = Form(None),
    is_public: bool = Form(True),
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Finalize a chunked upload by assembling all chunks into the final video file.

    Verifies all expected chunks are present, concatenates them in order,
    runs ffprobe/ffmpeg for metadata and thumbnail, then registers in the DB.
    Cleans up temp chunk storage on success or failure.

    Args:
        upload_id: Upload session ID from /upload/initiate.
        title: Video title.
        slug: URL-friendly identifier (must be unique).
        description: Optional description.
        is_public: Whether the video is publicly accessible.
        db: Database session.

    Returns:
        Created video metadata.
    """
    upload_dir = TEMP_UPLOADS_DIR / upload_id

    if not str(upload_dir.resolve()).startswith(str(TEMP_UPLOADS_DIR.resolve())):
        raise HTTPException(status_code=400, detail="Invalid upload ID.")

    if not upload_dir.exists():
        raise HTTPException(status_code=404, detail="Upload session not found. Start a new upload.")

    meta = json.loads((upload_dir / "metadata.json").read_text())
    total_chunks = meta["total_chunks"]
    mime_type = meta["mime_type"]
    original_filename = meta["filename"]

    missing = [i for i in range(total_chunks) if not (upload_dir / f"{i}.chunk").exists()]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing chunks: {missing}. Re-upload them or start over.")

    existing = db.query(Video).filter(Video.slug == slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Video with this slug already exists.")

    videos_dir = Path(settings.VIDEOS_DIR)
    videos_dir.mkdir(parents=True, exist_ok=True)

    file_extension = SUPPORTED_VIDEO_TYPES.get(mime_type, ".mp4")
    file_path = videos_dir / f"{slug}{file_extension}"

    try:
        with file_path.open("wb") as out:
            for i in range(total_chunks):
                with (upload_dir / f"{i}.chunk").open("rb") as chunk:
                    shutil.copyfileobj(chunk, out)
    finally:
        shutil.rmtree(upload_dir, ignore_errors=True)

    file_size = file_path.stat().st_size
    video_metadata = extract_video_metadata(file_path)

    thumbnail_path = videos_dir / "thumbnails" / f"{slug}.jpg"
    thumbnail_generated = generate_video_thumbnail(file_path, thumbnail_path)

    db_video = Video(
        filename=original_filename,
        file_path=str(file_path),
        thumbnail_path=str(thumbnail_path) if thumbnail_generated else None,
        title=title,
        description=description,
        slug=slug,
        is_public=is_public,
        width=video_metadata.get("width"),
        height=video_metadata.get("height"),
        duration=video_metadata.get("duration"),
        file_size=file_size,
        mime_type=mime_type,
    )

    db.add(db_video)
    db.commit()
    db.refresh(db_video)

    return db_video


@router.get("", response_model=List[VideoRead])
async def list_videos(
    skip: int = 0,
    limit: int = 100,
    public_only: bool = True,
    db: Session = Depends(get_db)
):
    """
    List all videos.
    
    Args:
        skip: Number of videos to skip (pagination)
        limit: Maximum number of videos to return
        public_only: If True, only return public videos
        db: Database session
        
    Returns:
        List of videos
    """
    query = db.query(Video)
    if public_only:
        query = query.filter(Video.is_public == True)
    
    videos = query.offset(skip).limit(limit).all()
    return videos


@router.get("/{video_id}", response_model=VideoRead)
async def get_video(video_id: int, db: Session = Depends(get_db)):
    """
    Get a specific video by ID.
    
    Args:
        video_id: Video ID
        db: Database session
        
    Returns:
        Video metadata
    """
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    return video


@router.get("/slug/{slug}", response_model=VideoRead)
async def get_video_by_slug(slug: str, db: Session = Depends(get_db)):
    """
    Get a video by its URL slug.
    
    Args:
        slug: Video slug
        db: Database session
        
    Returns:
        Video metadata
    """
    video = db.query(Video).filter(Video.slug == slug).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    return video


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
async def stream_video(video_id: int, db: Session = Depends(get_db)):
    """
    Stream video content with range request support for seeking.
    
    Args:
        video_id: Video ID
        db: Database session
        
    Returns:
        Video file stream
    """
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    video_path = Path(video.file_path)
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")
    
    return FileResponse(
        path=str(video_path),
        media_type=video.mime_type,
        filename=video.filename
    )


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
