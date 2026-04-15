# Gallery API Reference

**Base URL:** `https://api.tyler-schwenk.com`

Complete API reference for photo gallery endpoints on tyler-schwenk.com.

## Data Types

### Gallery Object

```typescript
interface Gallery {
  id: number;
  name: string;
  description: string | null;
  slug: string;              // URL-friendly identifier
  is_public: boolean;
  created_at: string;        // ISO 8601 timestamp
  updated_at: string | null; // ISO 8601 timestamp
  photo_count?: number;      // Only in list view
  photos?: Photo[];          // Only when fetching single gallery
}
```

### Photo Object

```typescript
interface Photo {
  id: number;
  gallery_id: number;
  filename: string;
  file_path: string;
  thumbnail_path: string;
  title: string | null;
  description: string | null;
  width: number;             // Original width in pixels
  height: number;            // Original height in pixels
  file_size: number;         // Size in bytes
  mime_type: string;         // e.g., "image/jpeg"
  display_order: number;     // Sort order (0-based)
  created_at: string;        // ISO 8601 timestamp
}
```

## Endpoints

### List All Galleries

Get all public galleries with photo counts.

**Request:**
```http
GET /galleries
```

**Query Parameters:**
- `skip` (integer, optional): Number to skip for pagination (default: 0)
- `limit` (integer, optional): Max results to return (default: 100, max: 100)
- `public_only` (boolean, optional): Only show public galleries (default: true)

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Jordan",
    "description": "Trip to Jordan",
    "slug": "jordan",
    "is_public": true,
    "created_at": "2026-03-15T10:00:00Z",
    "updated_at": null,
    "photo_count": 32
  },
  {
    "id": 2,
    "name": "Durango",
    "description": "Summer in Durango",
    "slug": "durango",
    "is_public": true,
    "created_at": "2026-03-15T10:00:00Z",
    "updated_at": null,
    "photo_count": 30
  }
]
```

**Example:**
```typescript
const galleries = await fetch('https://api.tyler-schwenk.com/galleries')
  .then(r => r.json());

console.log(`Found ${galleries.length} galleries`);
```

---

### Get Gallery by ID

Get a specific gallery with all photos.

**Request:**
```http
GET /galleries/{gallery_id}
```

**Path Parameters:**
- `gallery_id` (integer, required): Gallery ID

**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "Jordan",
  "description": "Trip to Jordan",
  "slug": "jordan",
  "is_public": true,
  "created_at": "2026-03-15T10:00:00Z",
  "updated_at": null,
  "photos": [
    {
      "id": 1,
      "gallery_id": 1,
      "filename": "petra.jpg",
      "file_path": "gallery_1/abc-123.jpg",
      "thumbnail_path": "gallery_1/thumbnails/abc-123.jpg",
      "title": "Petra Treasury",
      "description": "The iconic facade at Petra",
      "width": 3000,
      "height": 2000,
      "file_size": 1245678,
      "mime_type": "image/jpeg",
      "display_order": 0,
      "created_at": "2026-03-15T10:30:00Z"
    }
  ]
}
```

**Response:** `404 Not Found`
```json
{
  "detail": "Gallery not found"
}
```

**Example:**
```typescript
const gallery = await fetch('https://api.tyler-schwenk.com/galleries/1')
  .then(r => r.json());

console.log(`${gallery.name}: ${gallery.photos.length} photos`);
```

---

### Get Gallery by Slug

Get a gallery by URL-friendly slug (recommended for frontend).

**Request:**
```http
GET /galleries/slug/{slug}
```

**Path Parameters:**
- `slug` (string, required): Gallery slug (e.g., "jordan", "durango")

**Response:** Same as Get Gallery by ID

**Example:**
```typescript
const gallery = await fetch('https://api.tyler-schwenk.com/galleries/slug/jordan')
  .then(r => r.json());
```

**Common Slugs:**
- `jordan`, `durango`, `friends`, `italy`, `aspen`, `family`, `telluride`, `brothers`, `college`, `moab`, `dad`, `mom`, `cats`, `cedaredge`, `sam`, `dylan`

---

### Get Photo File

Retrieve the actual image file (original or thumbnail).

**Request:**
```http
GET /galleries/photos/{photo_id}/file
```

**Path Parameters:**
- `photo_id` (integer, required): Photo ID

**Query Parameters:**
- `thumbnail` (boolean, optional): Return thumbnail instead of original (default: false)

**Response:** `200 OK`
- Content-Type: `image/jpeg`, `image/png`, etc.
- Body: Binary image data

**Response:** `404 Not Found`
```json
{
  "detail": "Photo not found"
}
```

**Examples:**

In HTML:
```html
<!-- Full size -->
<img src="https://api.tyler-schwenk.com/galleries/photos/1/file" alt="Photo">

<!-- Thumbnail (400x400px max) -->
<img src="https://api.tyler-schwenk.com/galleries/photos/1/file?thumbnail=true" alt="Thumbnail">
```

In React/Next.js:
```tsx
import Image from 'next/image';

<Image
  src={`https://api.tyler-schwenk.com/galleries/photos/${photo.id}/file?thumbnail=true`}
  alt={photo.title || 'Photo'}
  width={400}
  height={400}
/>
```

In CSS background:
```css
.photo-background {
  background-image: url('https://api.tyler-schwenk.com/galleries/photos/1/file?thumbnail=true');
}
```

---

### Get Photo Metadata

Get photo information without downloading the image.

**Request:**
```http
GET /galleries/photos/{photo_id}
```

**Path Parameters:**
- `photo_id` (integer, required): Photo ID

**Response:** `200 OK`
```json
{
  "id": 1,
  "gallery_id": 1,
  "filename": "petra.jpg",
  "file_path": "gallery_1/abc-123.jpg",
  "thumbnail_path": "gallery_1/thumbnails/abc-123.jpg",
  "title": "Petra Treasury",
  "description": "The iconic facade at Petra",
  "width": 3000,
  "height": 2000,
  "file_size": 1245678,
  "mime_type": "image/jpeg",
  "display_order": 0,
  "created_at": "2026-03-15T10:30:00Z"
}
```

**Example:**
```typescript
const photo = await fetch('https://api.tyler-schwenk.com/galleries/photos/1')
  .then(r => r.json());

console.log(`Photo: ${photo.title} (${photo.width}x${photo.height})`);
```

---

### List Gallery Photos

Get all photos in a specific gallery.

**Request:**
```http
GET /galleries/{gallery_id}/photos
```

**Path Parameters:**
- `gallery_id` (integer, required): Gallery ID

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "gallery_id": 1,
    "filename": "petra.jpg",
    "title": "Petra Treasury",
    "display_order": 0,
    "created_at": "2026-03-15T10:30:00Z"
  }
]
```

Photos are sorted by `display_order` ascending, then `created_at` ascending.

**Example:**
```typescript
const photos = await fetch('https://api.tyler-schwenk.com/galleries/1/photos')
  .then(r => r.json());
```

## Complete Usage Example

### Fetch and Display Gallery

```typescript
async function displayGallery(slug: string) {
  try {
    // Fetch gallery with all photos
    const response = await fetch(`https://api.tyler-schwenk.com/galleries/slug/${slug}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const gallery = await response.json();
    
    // Sort photos by display order
    const sortedPhotos = gallery.photos.sort((a, b) => 
      a.display_order - b.display_order
    );
    
    // Display gallery info
    console.log(`Gallery: ${gallery.name}`);
    console.log(`Description: ${gallery.description}`);
    console.log(`Photos: ${sortedPhotos.length}`);
    
    // Render photos
    sortedPhotos.forEach(photo => {
      const img = document.createElement('img');
      img.src = `https://api.tyler-schwenk.com/galleries/photos/${photo.id}/file?thumbnail=true`;
      img.alt = photo.title || photo.filename;
      img.loading = 'lazy';
      
      img.onclick = () => {
        // Open full size in modal/lightbox
        window.open(
          `https://api.tyler-schwenk.com/galleries/photos/${photo.id}/file`,
          '_blank'
        );
      };
      
      document.querySelector('.gallery-grid').appendChild(img);
    });
    
  } catch (error) {
    console.error('Failed to load gallery:', error);
    // Show error message to user
  }
}

// Usage
displayGallery('jordan');
```

### Gallery Grid Component (React)

```tsx
import { useState, useEffect } from 'react';

interface Props {
  slug: string;
}

export default function GalleryGrid({ slug }: Props) {
  const [gallery, setGallery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`https://api.tyler-schwenk.com/galleries/slug/${slug}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setGallery)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!gallery) return <div>Gallery not found</div>;

  return (
    <div>
      <h1>{gallery.name}</h1>
      {gallery.description && <p>{gallery.description}</p>}
      
      <div className="grid grid-cols-3 gap-4">
        {gallery.photos
          .sort((a, b) => a.display_order - b.display_order)
          .map(photo => (
            <img
              key={photo.id}
              src={`https://api.tyler-schwenk.com/galleries/photos/${photo.id}/file?thumbnail=true`}
              alt={photo.title || photo.filename}
              className="w-full h-auto cursor-pointer hover:opacity-80"
              onClick={() => window.open(
                `https://api.tyler-schwenk.com/galleries/photos/${photo.id}/file`,
                '_blank'
              )}
            />
          ))}
      </div>
    </div>
  );
}
```

## Thumbnail Specifications

Thumbnails are automatically generated with these properties:

- **Max dimensions:** 400x400 pixels
- **Aspect ratio:** Preserved (not cropped)
- **Format:** Same as original (JPEG/PNG)
- **Quality:** Optimized for web (JPEG quality ~85)
- **File size:** ~50-150 KB typical

## Error Responses

### 404 Not Found

Gallery or photo doesn't exist.

```json
{
  "detail": "Gallery not found"
}
```

### 500 Internal Server Error

Server error loading image file.

```json
{
  "detail": "Error loading image file"
}
```

## CORS

API accepts requests from:
- `https://tyler-schwenk.com`
- `https://www.tyler-schwenk.com`
- `http://localhost:3000` (development)
- `http://localhost:5173` (development)

If you get CORS errors, ensure your request originates from an allowed domain.

## Rate Limits

Gallery endpoints have no rate limiting. Requests are cached by Cloudflare CDN for performance.

## Caching

- API responses cached for 1 hour by Cloudflare
- Images cached indefinitely (until changed)
- Use `Cache-Control` headers appropriately in your frontend

## Best Practices

1. **Use thumbnails** for grid/preview views to save bandwidth
2. **Use slugs** instead of IDs for cleaner URLs
3. **Sort by display_order** to respect intended photo sequence
4. **Lazy load** images below the fold
5. **Handle errors** gracefully (network issues, missing galleries)
6. **Cache responses** in your application to reduce API calls
7. **Preload** first few images for better UX

## Health Check

Verify API availability:

```bash
curl https://api.tyler-schwenk.com/health
```

Response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-03-20T10:00:00Z"
}
```

## Interactive Documentation

Full interactive API documentation with request/response examples:

https://api.tyler-schwenk.com/docs
