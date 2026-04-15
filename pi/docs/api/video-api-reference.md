# Video API Reference

**Base URL:** `https://api.tyler-schwenk.com`

Complete API reference for video hosting and streaming endpoints.

## Data Types

### Video Object

```typescript
interface Video {
  id: number;
  title: string;
  description: string | null;
  slug: string;              // URL-friendly identifier
  filename: string;
  file_path: string;
  thumbnail_path: string | null;
  width: number | null;      // Video width in pixels
  height: number | null;     // Video height in pixels
  duration: number | null;   // Duration in seconds
  file_size: number | null;  // Size in bytes
  mime_type: string | null;  // e.g., "video/mp4"
  is_public: boolean;
  created_at: string;        // ISO 8601 timestamp
}
```

## Endpoints

### List All Videos

Get all public videos.

**Request:**
```http
GET /videos
```

**Query Parameters:**
- `skip` (integer, optional): Number to skip for pagination (default: 0)
- `limit` (integer, optional): Max results to return (default: 100, max: 100)
- `public_only` (boolean, optional): Only show public videos (default: true)

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "title": "Demo Video",
    "description": "Sample video",
    "slug": "demo-video",
    "filename": "demo.mp4",
    "file_path": "/app/videos/demo-video.mp4",
    "thumbnail_path": "/app/videos/thumbnails/demo-video.jpg",
    "width": 1920,
    "height": 1080,
    "duration": 120,
    "file_size": 52428800,
    "mime_type": "video/mp4",
    "is_public": true,
    "created_at": "2026-03-23T10:00:00Z"
  }
]
```

**Example:**
```typescript
const videos = await fetch('https://api.tyler-schwenk.com/videos')
  .then(r => r.json());

console.log(`Found ${videos.length} videos`);
```

---

### Get Video by ID

Get a specific video's metadata.

**Request:**
```http
GET /videos/{video_id}
```

**Path Parameters:**
- `video_id` (integer, required): Video ID

**Response:** `200 OK`
```json
{
  "id": 1,
  "title": "Demo Video",
  "description": "Sample video",
  "slug": "demo-video",
  "filename": "demo.mp4",
  "file_path": "/app/videos/demo-video.mp4",
  "thumbnail_path": "/app/videos/thumbnails/demo-video.jpg",
  "width": 1920,
  "height": 1080,
  "duration": 120,
  "file_size": 52428800,
  "mime_type": "video/mp4",
  "is_public": true,
  "created_at": "2026-03-23T10:00:00Z"
}
```

**Errors:**
- `404 Not Found` - Video does not exist

**Example:**
```typescript
const video = await fetch('https://api.tyler-schwenk.com/videos/1')
  .then(r => r.json());

console.log(`Video: ${video.title} (${video.duration}s)`);
```

---

### Get Video by Slug

Get a video by its URL-friendly slug.

**Request:**
```http
GET /videos/slug/{slug}
```

**Path Parameters:**
- `slug` (string, required): URL-friendly identifier

**Response:** `200 OK` - Same format as Get Video by ID

**Errors:**
- `404 Not Found` - Video does not exist

**Example:**
```typescript
const video = await fetch('https://api.tyler-schwenk.com/videos/slug/demo-video')
  .then(r => r.json());
```

---

### Stream Video

Stream video content with support for range requests (seeking).

**Request:**
```http
GET /videos/{video_id}/stream
```

**Path Parameters:**
- `video_id` (integer, required): Video ID

**Response:** `200 OK`
- Content-Type matches video mime_type
- File download with video data

**Errors:**
- `404 Not Found` - Video or file does not exist

**Example:**
```html
<video controls width="800">
  <source src="https://api.tyler-schwenk.com/videos/1/stream" type="video/mp4">
  Your browser does not support the video tag.
</video>
```

---

### Get Video Thumbnail

Get the video's thumbnail/poster image.

**Request:**
```http
GET /videos/{video_id}/thumbnail
```

**Path Parameters:**
- `video_id` (integer, required): Video ID

**Response:** `200 OK`
- Content-Type: image/jpeg
- Thumbnail image file

**Errors:**
- `404 Not Found` - Video does not exist, thumbnail not available, or thumbnail file not found

**Example:**
```html
<img src="https://api.tyler-schwenk.com/videos/1/thumbnail" alt="Video thumbnail">
```

---

### Upload Video

Upload a new video file.

**Request:**
```http
POST /videos
Content-Type: multipart/form-data
```

**Form Data:**
- `file` (file, required): Video file to upload
- `title` (string, required): Video title
- `slug` (string, required): URL-friendly identifier (must be unique)
- `description` (string, optional): Video description
- `is_public` (boolean, optional): Whether video is publicly accessible (default: true)

**Supported Video Types:**
- `video/mp4` (.mp4)
- `video/webm` (.webm)
- `video/ogg` (.ogv)
- `video/quicktime` (.mov)

**Response:** `201 Created`
```json
{
  "id": 1,
  "title": "Demo Video",
  "description": "Sample video",
  "slug": "demo-video",
  "filename": "demo.mp4",
  "file_path": "/app/videos/demo-video.mp4",
  "thumbnail_path": "/app/videos/thumbnails/demo-video.jpg",
  "width": 1920,
  "height": 1080,
  "duration": 120,
  "file_size": 52428800,
  "mime_type": "video/mp4",
  "is_public": true,
  "created_at": "2026-03-23T10:00:00Z"
}
```

**Errors:**
- `400 Bad Request` - Unsupported video type or slug already exists
- `422 Unprocessable Entity` - Validation error

**Example:**
```typescript
const formData = new FormData();
formData.append('file', videoFile);
formData.append('title', 'My Video');
formData.append('slug', 'my-video');
formData.append('description', 'A great video');
formData.append('is_public', 'true');

const video = await fetch('https://api.tyler-schwenk.com/videos', {
  method: 'POST',
  body: formData
}).then(r => r.json());

console.log(`Uploaded video: ${video.id}`);
```

**Notes:**
- Automatic thumbnail generation at 1 second into the video
- Automatic video metadata extraction (width, height, duration)
- Requires ffmpeg installed on server

---

### Update Video

Update video metadata.

**Request:**
```http
PATCH /videos/{video_id}
Content-Type: application/json
```

**Path Parameters:**
- `video_id` (integer, required): Video ID

**Request Body:**
All fields optional:
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "slug": "updated-slug",
  "is_public": false
}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "title": "Updated Title",
  "description": "Updated description",
  "slug": "updated-slug",
  "filename": "demo.mp4",
  "file_path": "/app/videos/updated-slug.mp4",
  "thumbnail_path": "/app/videos/thumbnails/updated-slug.jpg",
  "width": 1920,
  "height": 1080,
  "duration": 120,
  "file_size": 52428800,
  "mime_type": "video/mp4",
  "is_public": false,
  "created_at": "2026-03-23T10:00:00Z"
}
```

**Errors:**
- `400 Bad Request` - New slug already exists
- `404 Not Found` - Video does not exist
- `422 Unprocessable Entity` - Validation error

**Example:**
```typescript
const updated = await fetch('https://api.tyler-schwenk.com/videos/1', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'New Title' })
}).then(r => r.json());
```

---

### Delete Video

Delete a video and its associated files.

**Request:**
```http
DELETE /videos/{video_id}
```

**Path Parameters:**
- `video_id` (integer, required): Video ID

**Response:** `204 No Content`

**Errors:**
- `404 Not Found` - Video does not exist

**Example:**
```typescript
await fetch('https://api.tyler-schwenk.com/videos/1', {
  method: 'DELETE'
});
```

**Notes:**
- Deletes both video file and thumbnail
- Permanent operation, cannot be undone

---

## Frontend Integration

### Basic Video Player

```html
<!DOCTYPE html>
<html>
<head>
  <title>Video Player</title>
</head>
<body>
  <h1 id="video-title"></h1>
  <video id="video-player" controls width="800" poster="">
    <source src="" type="video/mp4">
    Your browser does not support the video tag.
  </video>

  <script>
    const videoSlug = 'demo-video';
    
    fetch(`https://api.tyler-schwenk.com/videos/slug/${videoSlug}`)
      .then(r => r.json())
      .then(video => {
        document.getElementById('video-title').textContent = video.title;
        
        const player = document.getElementById('video-player');
        player.querySelector('source').src = 
          `https://api.tyler-schwenk.com/videos/${video.id}/stream`;
        player.poster = 
          `https://api.tyler-schwenk.com/videos/${video.id}/thumbnail`;
        player.load();
      });
  </script>
</body>
</html>
```

### Video Gallery

```typescript
async function loadVideoGallery() {
  const videos = await fetch('https://api.tyler-schwenk.com/videos')
    .then(r => r.json());
  
  const gallery = document.getElementById('video-gallery');
  
  videos.forEach(video => {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.innerHTML = `
      <a href="/videos/${video.slug}">
        <img src="https://api.tyler-schwenk.com/videos/${video.id}/thumbnail" 
             alt="${video.title}">
        <h3>${video.title}</h3>
        <p>${video.description || ''}</p>
        <span>${Math.floor(video.duration / 60)}:${String(video.duration % 60).padStart(2, '0')}</span>
      </a>
    `;
    gallery.appendChild(card);
  });
}

loadVideoGallery();
```

## Storage

Videos are stored on the external SSD at:
- **Videos:** `/media/tyler/FE645A9A645A558D/videos/`
- **Thumbnails:** `/media/tyler/FE645A9A645A558D/videos/thumbnails/`

Files are named using the video slug plus the appropriate file extension.

## Requirements

- ffmpeg must be installed in the Docker container for thumbnail generation and metadata extraction
- Sufficient storage space on the external SSD
- Video files should be compressed/optimized before upload for best performance
