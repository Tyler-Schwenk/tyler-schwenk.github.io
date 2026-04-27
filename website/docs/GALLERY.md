# Gallery Documentation

## Overview

The gallery page displays photo and video collections organized into three sections:
- **Trips** — adventure-based galleries (climbing, travel, events)
- **People** — social galleries (friends, family, college, etc.)
- **Videos** — standalone video entries (one card per video)

All media is served from the Pi backend at `https://api.tyler-schwenk.com`. Photos and videos live on the Pi's external drive. The frontend fetches gallery data at build time (static export), so changes to galleries on the Pi require a frontend redeploy to appear.

---

## Architecture

### Data Flow

```
next build
  └── GalleryPage (async server component)
        ├── GET /galleries          → all public galleries, sorted by display_order DESC
        ├── GET /galleries/slug/{slug} for each → photos list
        ├── GET /videos             → all public videos
        └── builds GalleryEntry objects → passed to GalleryModal
```

### Routes

- `/gallery` — main gallery index ([app/gallery/page.tsx](../app/gallery/page.tsx))
- `/gallery/[trip]` — unused; trips open in a modal on the index page
- `/gallery/people/[category]` — full-page people gallery viewer

---

## Gallery Categorization

Categorization is controlled by `PEOPLE_SLUGS` in [app/gallery/page.tsx](../app/gallery/page.tsx):

```typescript
const PEOPLE_SLUGS = new Set(["friends", "college", "palestinepals", "family", "bikenite"]);
```

Galleries whose slug is in this set render under **People**; all others render under **Trips**. To move a new gallery to the People section, add its slug here and redeploy.

### Gallery Sort Order

Galleries are sorted by `display_order` descending (higher value = shown first). New galleries created via the upload API automatically get `max(display_order) + 10`, so they appear at the front. Reorder galleries via the admin panel at `https://tyler-schwenk.com/admin/`.

### External-Link Entries

Galleries with no photos on the Pi that should still show as cards are hardcoded in `EXTERNAL_TRIPS` / `EXTERNAL_PEOPLE` in page.tsx and appended after Pi-hosted galleries.

```typescript
interface ExternalEntry {
  slug: string;
  title: string;
  description: string;
  externalUrl: string;       // card opens this instead of showing photos
  externalLinkText?: string; // custom button label
}
```

Currently both arrays are empty — all galleries are Pi-hosted.

---

## Components

### GalleryModal ([components/GalleryModal.tsx](../components/GalleryModal.tsx))

Client component rendering gallery cards and a full-screen modal viewer.

**Props:**
```typescript
{
  galleries: Record<string, {
    title: string;
    description: string;
    coverImage: string;
    media: Array<{ src: string; alt: string; type: "image" | "video" }>;
    externalUrl?: string;
    externalLinkText?: string;
  }>;
}
```

Features: card grid, full-screen modal, keyboard nav (Escape/arrows), image preloading, video support, external-link overlay.

### PeopleGalleryClient

Full-page people gallery viewer with thumbnail strip, nav arrows, and photo counter.

---

## Media URLs

| Content | URL |
|---|---|
| Photo (full res) | `https://api.tyler-schwenk.com/galleries/photos/{id}/file` |
| Photo (thumbnail) | `https://api.tyler-schwenk.com/galleries/photos/{id}/file?thumbnail=true` |
| Video stream | `https://api.tyler-schwenk.com/videos/{id}/stream` |
| Video thumbnail | `https://api.tyler-schwenk.com/videos/{id}/thumbnail` |

Gallery cover image = thumbnail of the first photo in the gallery.

---

## Adding New Galleries

### Trip Gallery (no code change needed)

1. Upload photos via `https://tyler-schwenk.com/admin/`
2. Create a new gallery with a name, slug, and description
3. Push to `main` — the gallery auto-appears under Trips

### People Gallery

Same as above, plus add the slug to `PEOPLE_SLUGS` in page.tsx and redeploy.

For a `/gallery/people/{slug}` detail page, also add to `CATEGORY_CONFIG` in [app/gallery/people/[category]/page.tsx](../app/gallery/people/%5Bcategory%5D/page.tsx).

### External-Link Gallery

Add an entry to `EXTERNAL_TRIPS` or `EXTERNAL_PEOPLE` in page.tsx and redeploy.

### Video

Upload via the admin panel — videos are auto-fetched, no code change needed.

---

## File Structure

```
app/gallery/
├── page.tsx                           # main gallery index (async server component)
├── [trip]/page.tsx                    # unused
└── people/[category]/
    ├── page.tsx                       # people gallery (async server component)
    └── PeopleGalleryClient.tsx        # people gallery client component

components/
└── GalleryModal.tsx                   # modal viewer for trips, people, and videos

public/admin/
└── index.html                         # admin panel (login, reorder, edit, upload)
```

## Static Site Generation

All API calls happen during `next build` on GitHub Actions. The Pi must be reachable during the build. If the API is down for a gallery, that gallery renders empty (graceful fallback — build does not fail).

## Styling

- **Theme**: dark mode, slate-900 to slate-800 gradient
- **Accent**: orange (`orange-500`)
- **Responsive**: grid adjusts for mobile/tablet/desktop

## Admin Panel

Manage galleries, photos, and videos at `https://tyler-schwenk.com/admin/`.

- **Galleries tab**: reorder with up/down arrows, edit name/description/slug/visibility, expand to see photos, delete individual photos or entire galleries, drop zone to add photos to any gallery
- **Upload tab**: upload photos to existing or new gallery, upload videos

Login persists for 30 days via JWT stored in localStorage.
