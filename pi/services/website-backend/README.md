# Website Backend API

Backend API providing forum (Public Square), photo galleries, and video hosting services.

## Overview

The Website Backend API is a unified RESTful API providing:

- **Public Square Forum**: User authentication, posts, comments, and discussions
- **Photo Galleries**: Album management with automatic thumbnail generation and image serving
- **Video Hosting**: Video upload, streaming, and automatic thumbnail generation
- **Single Database**: SQLite file with all tables (users, posts, comments, galleries, photos, videos)
- **Rate limiting**: Protection against abuse
- **JWT Authentication**: Secure token-based auth

This service powers the backend for tyler-schwenk.com.

## Architecture

**One Service, Multiple Features:**
- Forum functionality (Public Square)
- Photo gallery management
- Video hosting and streaming
- User authentication shared across features

**Single Database:**
- File: `website_backend.db`
- Contains all tables: users, posts, comments, galleries, gallery_photos, videos
- SQLite (lightweight, file-based, single file)

**Separate from:**
- Immich (future): Personal photo management, not part of website backend

## Technology Stack

- **FastAPI**: Modern Python web framework
- **SQLAlchemy**: SQL ORM for database operations
- **SQLite**: Lightweight database (single file)
- **FastAPI-Users**: Authentication and user management
- **Pydantic**: Data validation
- **SlowAPI**: Rate limiting
- **JWT**: Token-based authentication
- **Pillow**: Image processing and thumbnail generation
- **ffmpeg**: Video processing and thumbnail generation

## Database Schema

### Users
- Authentication and profile information
- Email, username, verification status
- Relationships to posts and comments

### Posts
- Forum threads/articles
- Title, content, publish status
- Author relationship, timestamps

### Comments
- Replies to posts
- Content, author, timestamps

### Galleries
- Photo album collections
- Name, description, URL slug, visibility
- Relationships to photos

### GalleryPhotos
- Individual photos within galleries
- File paths, thumbnails, dimensions
- Title, description, display order
- Automatic metadata extraction

### Videos
- Hosted video files
- File paths, thumbnails, metadata (width, height, duration)
- Title, description, URL slug, visibility
- Automatic thumbnail generation at 1 second
- Automatic metadata extraction via ffmpeg

## Prerequisites

- Docker and Docker Compose
- NetBird deployed (for Bird Wide Web access)

## Configuration

### Step 1: Environment Variables

```bash
cp .env.example .env
nano .env
```

Generate a secure JWT secret:
```bash
openssl rand -hex 32
```

Update `.env`:
```env
JWT_SECRET=<your-generated-secret>
CORS_ORIGINS=https://yourusername.github.io
```

Note: UpdateCreate Storage Directory

### Step 3: Build and Deploy

```bash
# Build the Docker image
docker compose build

# Start the service
docker compose up -d

# View logs
docker compose logs -f
```

### Step 4ectory on external SSD for photo storage:

```bash
sudo mkdir -p /mnt/external-ssd/public-gallery
sudo chown tyler:tyler /mnt/external-ssd/public-gallery
```

### Step 2: Build and Deploy

```bash4: Verify Deployment

```bash
# Check service health
curl http://localhost:8000/health

# View API docs
# Visit: http://localhost:8000/docs
```

### Step 5: Set Up Public Access

For public internet access, set up Cloudflare Tunnel:
- See: `docs/services/cloudflare-tunnel.md`
- Provides free SSL and public URL
- No port forwarding required

Or use NetBird for private access only (already configured).

## Photo Gallery Features

### Automatic Thumbnail Generation
- Thumbnails created automatically on upload
- Max dimensions: 400x400 pixels (configurable in config.py)
- Maintains aspect ratio
- Optimized quality: 85%

### Image Metadata Extraction
- Width and height automatically detected
- File size stored
- MIME type validation
- Original filename preserved

### Storage Structure
```
/media/tyler/FE645A9A645A558D/public-gallery/
├── gallery_1/
│   ├── abc123.jpg          # Original image
│   ├── def456.png
│   └── thumbnails/
│       ├── abc123.jpg      # Thumbnail
│       └── def456.png
└── gallery_2/
    └── ...
```

### Gallery Management
- Create multiple galleries with URL-friendly slugs
- Set galleries as public or private
- Reorder photos with display_order
- Add titles and descriptions to photos
- Delete galleries cascade deletes all photos

## API Usage Examples

### Create a Gallery

```bash
curl -X POST http://localhost:8000/galleries \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summer 2026",
    "description": "Photos from summer vacation",
    "slug": "summer-2026",
    "is_public": true
  }'
```

### Upload a Photo

```bash
curl -X POST http://localhost:8000/galleries/1/photos \
  -F "file=@photo.jpg" \
  -F "title=Beach Sunset" \
  -F "description=Beautiful sunset at the beach" \
  -F "display_order=0"
```

### Get Gallery with Photos

```bash
curl http://localhost:8000/galleries/slug/summer-2026
```

### Display Photo in HTML

```html
<!-- Thumbnail -->
<img src="https://api.yoursite.com/galleries/photos/1/file?thumbnail=true">

<!-- Full size -->
<img src="https://api.yoursite.com/galleries/photos/1/file">
```

## Development
### Step 4: Expose Publicly (Optional)

Use Tailscale Funnel to make the API publicly accessible:

```bash
# Enable Funnel for port 8000
docker exec tailscale tailscale funnel 8000

# API will be available at:
# https://fart-pi.your-tailnet.ts.net:8000
```

## API Endpoints

### System
- `GET /` - API information
- `GET /health` - Health check
- `GET /docs` - Interactive API documentation (Swagger UI)
- `GET /redoc` - Alternative API documentation (ReDoc)

### Galleries (Implemented)
- `GET /galleries` - List all galleries
- `GET /galleries/{id}` - Get gallery by ID with all photos
- `GET /galleries/slug/{slug}` - Get gallery by URL slug
- `POST /galleries` - Create new gallery
- `PATCH /galleries/{id}` - Update gallery
- `DELETE /galleries/{id}` - Delete gallery and all photos
- `POST /galleries/{id}/photos` - Upload photo to gallery
- `GET /galleries/{id}/photos` - List photos in gallery
- `GET /galleries/photos/{id}` - Get photo metadata
- `GET /galleries/photos/{id}/file` - Get photo file (original or thumbnail)
- `PATCH /galleries/photos/{id}` - Update photo metadata
- `DELETE /galleries/photos/{id}` - Delete photo

### Authentication (TODO: Implement routers)
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login and get JWT token
- `POST /auth/logout` - Logout
- `GET /auth/me` - Get current user info

### Posts (TODO: Implement routers)
- `GET /posts` - List all posts (public)
- `GET /posts/{id}` - Get single post
- `POST /posts` - Create post (authenticated)
- `PUT /posts/{id}` - Update post (authenticated, must be author)
- `DELETE /posts/{id}` - Delete post (authenticated, must be author)

### Comments (TODO: Implement routers)
- `GET /posts/{id}/comments` - List comments for a post
- `POST /posts/{id}/comments` - Add comment (authenticated)
- `PUT /comments/{id}` - Update comment (authenticated, must be author)
- `DELETE /comments/{id}` - Delete comment (authenticated, must be author)
- `POST /posts` - Create new post (authenticated)
- `GET /posts/{id}` - Get single post (public)
- `PUT /posts/{id}` - Update post (author only)
- `DELETE /posts/{id}` - Delete post (author only)

### Comments (TODO: Implement routers)
- `GET /posts/{id}/comments` - List comments on a post (public)
- `POST /posts/{id}/comments` - Add comment (authenticated)
- `PUT /comments/{id}` - Update comment (author only)
- `DELETE /comments/{id}` - Delete comment (author only)

## Database

### Location
- File: `./data/website_backend.db`
- Type: SQLite (single file database)

### Schema

**Users Table:**
- id, email, hashed_password, username
- is_active, is_verified, is_superuser
- created_at

**Posts Table (Public Square Forum):**
- id, title, content, author_id
- created_at, updated_at, is_published

**Comments Table (Public Square Forum):**
- id, content, post_id, author_id
- created_at, updated_at

**Galleries Table:**
- id, name, description, slug, is_public, user_id
- created_at, updated_at

**Gallery_Photos Table:**
- id, gallery_id, filename, file_path, thumbnail_path
- title, description, width, height, file_size, mime_type
- display_order, created_at

### Backup

Simply copy the database file:
```bash
cp data/website_backend.db data/website_backend.db.backup
```

## Security Features

### Implemented
- JWT token authentication
- Password hashing (bcrypt)
- CORS configuration
- Rate limiting (SlowAPI)
- Input validation (Pydantic)
- SQL injection protection (SQLAlchemy ORM)

### Rate Limits (TODO: Configure in routers)
- Login: 5 attempts/minute
- Register: 3 attempts/hour
- Create post: 10/minute
- Create comment: 20/minute

## Development

### Local Development

For local development without Docker:

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Project Structure

```
website-backend/
├── app/
│   ├── main.py           # FastAPI application entry point
│   ├── config.py         # Configuration and settings
│   ├── database.py       # Database connection and session
│   ├── models.py         # SQLAlchemy ORM models
│   ├── schemas.py        # Pydantic validation schemas
│   ├── auth.py           # Authentication setup
│   └── routers/          # API route handlers
│       ├── __init__.py
│       ├── gallery.py    # Gallery/photo endpoints (implemented)
│       ├── auth.py       # Auth endpoints (TODO)
│       ├── posts.py      # Post endpoints (TODO)
│       └── comments.py   # Comment endpoints (TODO)
├── scripts/
│   └── migrate_photos.py # Photo migration utility
├── data/                 # SQLite database (not in Git)
│   └── website_backend.db
├── docker-compose.yml    # Container orchestration
├── Dockerfile            # Container image definition
├── requirements.txt      # Python dependencies
└── README.md             # This file
```

## Monitoring

### Check Status

```bash
# Container status
docker compose ps

# View logs
docker compose logs -f

# Check health
curl http://localhost:8000/health
```

### Database Size

```bash
du -h data/website_backend.db
```

## Photo Migration

### Migrating Existing Photos

If you have existing photo folders to migrate into the gallery system:

**Step 1: Copy photos to external SSD**
```bash
# From your local machine
scp -r /path/to/photos/* tyler@192.168.1.116:/media/tyler/FE645A9A645A558D/public-gallery/
```

**Step 2: Verify folder structure**
```bash
# On the Pi
ls /media/tyler/FE645A9A645A558D/public-gallery/
# Should show: jordan/, durango/, friends/, etc.
```

**Step 3: Run migration script**
```bash
cd ~/tyler-schwenk.github.io/pi/services/website-backend
docker exec website-backend-api python scripts/migrate_photos.py
```

The script will:
- Scan all subdirectories in `/app/photos` (mapped to public-gallery)
- Create a gallery for each folder
- Upload all images with automatic thumbnails
- Preserve folder-based organization
- Skip already-migrated galleries

**Customize gallery metadata:**
Edit `scripts/migrate_photos.py` and update the `GALLERY_CONFIG` dictionary with proper titles and descriptions for your trips/categories.

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs

# Rebuild image
docker compose build --no-cache
docker compose up -d
```

### Database Issues

```bash
# Stop service
docker compose down

# Backup current database
cp data/website_backend.db data/website_backend.db.backup

# Remove database and recreate
rm data/website_backend.db
docker compose up -d
```

### Permission Errors

```bash
# Fix data directory permissions
sudo chown -R $USER:$USER data/
```

## Next Steps

1. Implement router modules (auth, posts, comments)
2. Add rate limiting to endpoints
3. Test authentication flow
4. Connect frontend to API
5. Access via NetBird network

## References

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [FastAPI-Users](https://fastapi-users.github.io/fastapi-users/)
- [SQLAlchemy](https://docs.sqlalchemy.org/)
- [Pydantic](https://docs.pydantic.dev/)
