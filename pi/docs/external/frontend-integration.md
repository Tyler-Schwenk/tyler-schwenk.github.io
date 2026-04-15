# Frontend Integration Guide

**For:** tyler-schwenk.com website (Next.js/React on GitHub Pages)  
**API Base URL:** `https://api.tyler-schwenk.com`

## Overview

This guide shows how to integrate the Photo Gallery API into the tyler-schwenk.com website. The API serves photos dynamically from a Raspberry Pi backend, replacing static images in the repository.

## Architecture

**Frontend:** Static Next.js site on GitHub Pages (tyler-schwenk.com)  
**Backend:** FastAPI on Raspberry Pi via Cloudflare Tunnel (api.tyler-schwenk.com)  
**Benefits:** Update photos without rebuilding frontend, automatic thumbnails, future forum features

## Quick Start

### 1. Environment Setup

Create `.env.local` in your Next.js project:

```bash
NEXT_PUBLIC_API_URL=https://api.tyler-schwenk.com
```

### 2. API Client Setup

Create `lib/api.ts`:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.tyler-schwenk.com';

export interface Photo {
  id: number;
  gallery_id: number;
  filename: string;
  file_path: string;
  thumbnail_path: string;
  title: string | null;
  description: string | null;
  width: number;
  height: number;
  file_size: number;
  mime_type: string;
  display_order: number;
  created_at: string;
}

export interface Gallery {
  id: number;
  name: string;
  description: string | null;
  slug: string;
  is_public: boolean;
  created_at: string;
  updated_at: string | null;
  photo_count?: number;
  photos?: Photo[];
}

export async function getAllGalleries(): Promise<Gallery[]> {
  const response = await fetch(`${API_URL}/galleries`);
  if (!response.ok) {
    throw new Error(`Failed to fetch galleries: ${response.status}`);
  }
  return response.json();
}

export async function getGalleryBySlug(slug: string): Promise<Gallery> {
  const response = await fetch(`${API_URL}/galleries/slug/${slug}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch gallery: ${response.status}`);
  }
  return response.json();
}

export function getPhotoUrl(photoId: number, thumbnail = false): string {
  const params = thumbnail ? '?thumbnail=true' : '';
  return `${API_URL}/galleries/photos/${photoId}/file${params}`;
}
```

### 3. Gallery Page Component

Create or update `pages/gallery/[slug].tsx`:

```typescript
import { GetStaticProps, GetStaticPaths } from 'next';
import Image from 'next/image';
import { getAllGalleries, getGalleryBySlug, getPhotoUrl, Gallery } from '@/lib/api';

interface GalleryPageProps {
  gallery: Gallery;
}

export default function GalleryPage({ gallery }: GalleryPageProps) {
  return (
    <div className="gallery-container">
      <h1>{gallery.name}</h1>
      {gallery.description && <p>{gallery.description}</p>}
      
      <div className="photo-grid">
        {gallery.photos
          ?.sort((a, b) => a.display_order - b.display_order)
          .map((photo) => (
            <div key={photo.id} className="photo-item">
              <Image
                src={getPhotoUrl(photo.id, true)}
                alt={photo.title || photo.filename}
                width={400}
                height={400}
                onClick={() => openLightbox(photo.id)}
              />
              {photo.title && <p className="photo-title">{photo.title}</p>}
            </div>
          ))}
      </div>
    </div>
  );
}

// Static generation at build time
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const gallery = await getGalleryBySlug(params?.slug as string);
  
  return {
    props: { gallery },
    revalidate: 3600, // Revalidate every hour
  };
};

export const getStaticPaths: GetStaticPaths = async () => {
  const galleries = await getAllGalleries();
  
  return {
    paths: galleries.map((g) => ({ params: { slug: g.slug } })),
    fallback: 'blocking',
  };
};
```

### 4. Gallery Index Page

Create `pages/gallery/index.tsx`:

```typescript
import { GetStaticProps } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getAllGalleries, getPhotoUrl, Gallery } from '@/lib/api';

interface GalleryIndexProps {
  galleries: Gallery[];
}

export default function GalleryIndex({ galleries }: GalleryIndexProps) {
  return (
    <div className="galleries-container">
      <h1>Photo Galleries</h1>
      
      <div className="gallery-grid">
        {galleries.map((gallery) => (
          <Link key={gallery.id} href={`/gallery/${gallery.slug}`}>
            <div className="gallery-card">
              {gallery.photos?.[0] && (
                <Image
                  src={getPhotoUrl(gallery.photos[0].id, true)}
                  alt={gallery.name}
                  width={400}
                  height={400}
                />
              )}
              <h2>{gallery.name}</h2>
              <p>{gallery.photo_count} photos</p>
              {gallery.description && <p>{gallery.description}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const galleries = await getAllGalleries();
  
  return {
    props: { galleries },
    revalidate: 3600,
  };
};
```

## Image Loading Strategies

### Option 1: Static Generation (Recommended)

Fetch data at build time using `getStaticProps`. Best for performance and SEO.

```typescript
export const getStaticProps: GetStaticProps = async () => {
  const galleries = await getAllGalleries();
  return {
    props: { galleries },
    revalidate: 3600, // ISR: revalidate every hour
  };
};
```

### Option 2: Client-Side Fetching

Fetch data on the client for dynamic content.

```typescript
import { useEffect, useState } from 'react';
import { getAllGalleries, Gallery } from '@/lib/api';

export default function GalleryPage() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllGalleries()
      .then(setGalleries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;

  return <div>{/* Render galleries */}</div>;
}
```

### Option 3: Hybrid (Static + Client Updates)

Static generation for initial load, client-side fetching for updates.

```typescript
export default function GalleryPage({ initialGalleries }: Props) {
  const [galleries, setGalleries] = useState(initialGalleries);

  // Refresh data on mount
  useEffect(() => {
    getAllGalleries().then(setGalleries);
  }, []);

  return <div>{/* Render galleries */}</div>;
}

export const getStaticProps: GetStaticProps = async () => {
  const galleries = await getAllGalleries();
  return { props: { initialGalleries: galleries } };
};
```

## Image Optimization

### Using Next.js Image Component

```typescript
<Image
  src={getPhotoUrl(photo.id, true)}
  alt={photo.title || photo.filename}
  width={400}
  height={400}
  loading="lazy"
  placeholder="blur"
  blurDataURL="/placeholder.jpg"
/>
```

### External Image Configuration

Add to `next.config.js`:

```javascript
module.exports = {
  images: {
    domains: ['api.tyler-schwenk.com'],
    formats: ['image/webp', 'image/avif'],
  },
};
```

### Progressive Loading

```typescript
const [imageLoaded, setImageLoaded] = useState(false);

<div className="photo-wrapper">
  {!imageLoaded && <div className="skeleton-loader" />}
  <img
    src={getPhotoUrl(photo.id, true)}
    alt={photo.title}
    onLoad={() => setImageLoaded(true)}
    style={{ opacity: imageLoaded ? 1 : 0 }}
  />
</div>
```

## Lightbox for Full-Size Images

```typescript
import { useState } from 'react';

export default function GalleryWithLightbox({ photos }: Props) {
  const [lightboxPhoto, setLightboxPhoto] = useState<number | null>(null);

  return (
    <>
      <div className="gallery-grid">
        {photos.map((photo) => (
          <img
            key={photo.id}
            src={getPhotoUrl(photo.id, true)}
            alt={photo.title}
            onClick={() => setLightboxPhoto(photo.id)}
          />
        ))}
      </div>

      {lightboxPhoto && (
        <div className="lightbox" onClick={() => setLightboxPhoto(null)}>
          <img
            src={getPhotoUrl(lightboxPhoto)}
            alt="Full size"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
```

## Error Handling

```typescript
import { useState, useEffect } from 'react';

export default function GalleryPage({ slug }: Props) {
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGalleryBySlug(slug)
      .then(setGallery)
      .catch((err) => {
        console.error('Failed to load gallery:', err);
        setError('Failed to load gallery. Please try again later.');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!gallery) return <NotFound />;

  return <GalleryDisplay gallery={gallery} />;
}
```

## Migration Steps

### 1. Test API Endpoints

Verify API is accessible:

```bash
curl https://api.tyler-schwenk.com/health
curl https://api.tyler-schwenk.com/galleries
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Create API Client

Copy the `lib/api.ts` code above into your project.

### 4. Update Gallery Pages

Replace static image imports with API calls.

**Before:**
```typescript
const photos = [
  { src: '/images/gallery/jordan/photo1.jpg', alt: 'Photo 1' },
  { src: '/images/gallery/jordan/photo2.jpg', alt: 'Photo 2' },
];
```

**After:**
```typescript
const gallery = await getGalleryBySlug('jordan');
const photos = gallery.photos?.map(p => ({
  src: getPhotoUrl(p.id, true),
  alt: p.title || p.filename,
}));
```

### 5. Remove Static Images

After verifying API integration:

```bash
rm -rf public/images/gallery/
```

### 6. Deploy

```bash
git add .
git commit -m "Migrate gallery to API"
git push origin main
```

GitHub Pages will rebuild automatically.

## Available Galleries

Current galleries accessible via API:

- `jordan` - 32 photos
- `durango` - 30 photos
- `friends` - 25 photos
- `italy` - 28 photos
- `aspen` - 24 photos
- `family` - 20 photos
- `telluride` - 19 photos
- `brothers` - 18 photos
- `college` - 16 photos
- `moab` - 12 photos
- `dad` - 11 photos
- `mom` - 8 photos
- `cats` - 8 photos
- `cedaredge` - 8 photos
- `sam` - 7 photos
- `dylan` - 5 photos

## Performance Tips

1. **Use thumbnails** for grid views (`?thumbnail=true`)
2. **Lazy load images** below the fold
3. **Static generation** for SEO and performance
4. **ISR revalidation** to update content periodically
5. **Optimize with Next.js Image** component
6. **Cache API responses** in browser

## CORS

API is configured to accept requests from:
- `https://tyler-schwenk.com`
- `https://www.tyler-schwenk.com`
- `http://localhost:3000` (development)

## Support

- API Documentation: https://api.tyler-schwenk.com/docs
- Health Check: https://api.tyler-schwenk.com/health
