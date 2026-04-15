# Website Integration Guide

How tyler-schwenk.github.io integrates with the Website Backend API on fart-pi.

## Current Status

**Domain:** tyler-schwenk.com (custom domain configured)
**API:** https://api.tyler-schwenk.com
**API Migration:** Completed (255 photos across 16 galleries)
**Frontend Integration:** Pending (frontend still using static files)

## Architecture Overview

### Hybrid Static + Dynamic Model

**Static Frontend (GitHub Pages):**
- Repository: tyler-schwenk.github.io/website/ (monorepo, website/ subdirectory)
- Hosting: GitHub Pages CDN
- Framework: Next.js (static export)
- Domain: https://tyler-schwenk.com

**Dynamic Backend (Raspberry Pi):**
- Repository: pi/services/website-backend/
- Hosting: fart-pi (home server)
- Framework: FastAPI + SQLite
- Access: Via Cloudflare Tunnel (public) or NetBird (private)

### Content Distribution

**Served from GitHub Pages (Fast CDN):**
- Homepage hero images
- Navigation icons and logos
- Background images
- About page photos
- Any images in `/public/images/` (except gallery/)
- All static HTML/CSS/JS

**Served from Pi API (Dynamic):**
- Photo gallery images (frequently updated)
- Forum posts and comments (Public Square)
- User authentication
- Any user-generated content

## Photo Gallery Migration

### Before: All Static

**Current setup:**
```
tyler-schwenk.github.io/public/images/gallery/
├── jordan/
│   ├── photo1.jpg
│   └── photo2.jpg
├── durango/
└── friends/
```

**Frontend code:**
```typescript
// Loads at build time from filesystem
const photos = fs.readdirSync('/public/images/gallery/jordan');
```

### After: API-Driven

**Storage:**
```
fart-pi:/media/tyler/FE645A9A645A558D/public-gallery/
├── jordan/
│   ├── photo1.jpg        # Original
│   └── thumbnails/
│       └── photo1.jpg    # Auto-generated 400x400px
├── durango/
└── friends/
```

**Database:** SQLite with galleries and gallery_photos tables

**Frontend code:**
```typescript
// Fetches at runtime from API
const response = await fetch('https://api.tyler-schwenk.com/galleries/slug/jordan');
const gallery = await response.json();

// Render images
gallery.photos.map(photo => (
  <img src={`https://api.tyler-schwenk.com/galleries/photos/${photo.id}/file`} />
))
```

## Migration Steps

**Status:** Steps 1-2 completed. Photos migrated and registered in database.

### Step 1: Copy Photos to Pi (COMPLETED)

From your local machine with the website repo:

```bash
scp -r "C:\path\to\tyler-schwenk.github.io\public\images\gallery\*" tyler@192.168.1.116:/media/tyler/FE645A9A645A558D/public-gallery/
```

This preserves your folder structure (jordan/, durango/, friends/, etc.).

### Step 2: Register Photos in Database (COMPLETED)

On the Pi:

```bash
cd ~/tyler-schwenk.github.io/pi/services/website-backend
docker exec website-backend-api python scripts/migrate_photos.py
```

The script will:
- Scan all folders in `/media/tyler/FE645A9A645A558D/public-gallery/`
- Create a gallery for each folder
- Upload each image (generates thumbnails automatically)
- Preserve organization

**Customize gallery metadata:**
Edit `services/website-backend/scripts/migrate_photos.py` and update `GALLERY_CONFIG` with proper titles and descriptions.

### Step 3: Update Frontend Code

In your website repo:

**Before:**
```typescript
// app/gallery/page.tsx
const tripConfig = {
  jordan: {
    title: "Jordan",
    folderPath: "/images/gallery/jordan"  // Static files
  }
};

// Load photos from filesystem
const photos = getImagesFromFolder(config.folderPath);
```

**After:**
```typescript
// app/gallery/page.tsx
async function getGalleryData(slug: string) {
  const response = await fetch(`${API_URL}/galleries/slug/${slug}`);
  return response.json();
}

// Use API data
const gallery = await getGalleryData('jordan');
const photos = gallery.photos.map(photo => ({
  src: `${API_URL}/galleries/photos/${photo.id}/file`,
  thumbnail: `${API_URL}/galleries/photos/${photo.id}/file?thumbnail=true`,
  alt: photo.title
}));
```

### Step 4: Remove Gallery Photos from GitHub

After verifying API works:

```bash
# In website repo
rm -rf public/images/gallery/*
git add -A
git commit -m "Remove gallery photos, now served from API"
git push
```

**Keep non-gallery images:**
- Homepage images
- Icons/logos
- Background images
- Any static assets

### Step 5: Configure CORS

Ensure your domain is in API CORS settings:

```bash
# On Pi
cd ~/tyler-schwenk.github.io/pi/services/website-backend
nano .env
```

```env
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,https://tyler-schwenk.com,https://www.tyler-schwenk.com
```

Restart API:
```bash
docker compose restart
```

## API Integration Examples

### Fetch All Galleries

```typescript
// Get list of all public galleries
const response = await fetch('https://api.yoursite.com/galleries');
const galleries = await response.json();

// Render gallery cards
galleries.map(gallery => (
  <Card
    title={gallery.name}
    description={gallery.description}
    href={`/gallery/${gallery.slug}`}
    imageUrl={`https://api.yoursite.com/galleries/photos/${gallery.photos[0].id}/file?thumbnail=true`}
  />
))
```

### Display Gallery Photos

```typescript
// Get gallery with all photos
const response = await fetch(`https://api.yoursite.com/galleries/slug/${slug}`);
const gallery = await response.json();

// Display in modal or page
<div className="grid grid-cols-3 gap-4">
  {gallery.photos.map(photo => (
    <img
      key={photo.id}
      src={`https://api.yoursite.com/galleries/photos/${photo.id}/file?thumbnail=true`}
      alt={photo.title}
      onClick={() => openFullSize(photo.id)}
    />
  ))}
</div>

// Full-size image
<img src={`https://api.yoursite.com/galleries/photos/${photoId}/file`} />
```

### Preload Images

```typescript
// Preload next/previous images for smooth navigation
const preloadImage = (photoId: number) => {
  const img = new Image();
  img.src = `https://api.yoursite.com/galleries/photos/${photoId}/file`;
};
```

## Performance Considerations

### Pros of API Approach
- Easy to add/remove photos (no Git commits)
- Automatic thumbnail generation
- Metadata storage (dates, captions, order)
- Can add admin UI later
- Database queries for filtering/search

### Cons of API Approach
- Slower than GitHub CDN
- Depends on Pi uptime and home internet
- Single point of failure
- Limited by home upload bandwidth (~10-50 Mbps typical)

### Optimization Strategies

**1. Thumbnail First, Full-Size on Demand:**
```typescript
// Load thumbnail immediately
<img src={`${API_URL}/galleries/photos/${id}/file?thumbnail=true`} />

// Load full-size on click
onClick={() => loadFullSize(id)}
```

**2. Lazy Loading:**
```typescript
<img
  src={thumbnailUrl}
  loading="lazy"
  onIntersection={() => preloadFullSize()}
/>
```

**3. Cloudflare Caching:**
- Cloudflare Tunnel provides caching at edge
- Configure cache headers in API
- Images cached globally, reducing Pi load

**4. Consider CDN for Originals:**
- Keep thumbnails on Pi (small, fast generation)
- Store full-size on Cloudflare R2 or similar (optional)
- Hybrid: thumbnails from Pi, full-size from CDN

## Public Access Setup

### Option A: Cloudflare Tunnel (Recommended)

Provides public HTTPS URL without port forwarding:

1. Follow guide: [services/cloudflare-tunnel.md](services/cloudflare-tunnel.md)
2. Configure routing: `api.yoursite.com` → `http://website-backend-api:8000`
3. Free SSL certificate included
4. DDoS protection included

**API URL:** `https://api.yoursite.com`

### Option B: NetBird Only (Private)

Keep API private, only accessible via Bird Wide Web:

**API URL:** `http://fart-pi.johnserv.garrepi.dev:8000`

**Note:** Frontend on GitHub Pages can't directly access NetBird IPs (CORS, latency). This only works for development or if you deploy frontend on Pi too.

**Recommendation:** Use Cloudflare Tunnel for public API access.

## Database Schema

The Website Backend API uses a single SQLite database with multiple tables:

### Forum Tables (Public Square)
- **users**: Authentication and profiles
- **posts**: Forum threads and articles
- **comments**: Replies to posts

### Gallery Tables
- **galleries**: Photo albums with metadata
- **gallery_photos**: Individual photos with file paths, thumbnails, dimensions

All tables share the same database file: `website_backend.db`

## Development Workflow

### Testing API Changes

1. Make code changes locally
2. Commit and push to GitHub
3. Pull on Pi: `cd ~/tyler-schwenk.github.io/pi && git pull`
4. Rebuild: `cd services/website-backend && docker compose build && docker compose up -d`
5. Test: `curl http://localhost:8000/health`

### Testing Frontend Changes

1. Update Next.js code to use API URLs
2. Run locally: `npm run dev`
3. Test against Pi API (via NetBird or Cloudflare)
4. Build and deploy: `npm run build && git push`

### Full Stack Testing

```bash
# Terminal 1: Monitor Pi API logs
ssh tyler@192.168.1.116
cd ~/tyler-schwenk.github.io/pi/services/website-backend
docker compose logs -f

# Terminal 2: Run frontend locally
cd ~/tyler-schwenk.github.io
npm run dev
# Visit http://localhost:3000

# Frontend makes API calls to Pi, you see logs in Terminal 1
```

## Security Notes

- API requires authentication for write operations (create/update/delete)
- Gallery viewing is public (read-only, no auth needed)
- CORS restricts which domains can call API
- Rate limiting prevents abuse
- JWT tokens for authenticated features

## Next Steps

1. Run photo migration script
2. Update frontend to fetch from API
3. Set up Cloudflare Tunnel for public access
4. Implement forum routers (auth, posts, comments)
5. Test end-to-end from GitHub Pages to Pi API
