# Gallery Documentation

## Overview

The gallery displays photo and video collections organized into three categories:
- **Trips**: Adventure-based photo galleries (climbing trips, travel, events)
- **People**: Social photo collections (friends, family, college, causes)
- **Videos**: Standalone video entries (one card per video)

All media is served from the Pi backend at `https://api.tyler-schwenk.com`. Photos and videos are stored on the Pi's external drive and served via the FastAPI backend. The frontend fetches data at build time, so the site is fully static — changes to media on the Pi require a redeploy to show up.

## Architecture

### Data Flow

```
next build
  └── GalleryPage (async server component)
        ├── fetch /galleries/slug/{slug} for each configured trip/people gallery
        ├── fetch /videos for all public videos
        └── builds gallery data objects → passes to GalleryModal
```

### Routes

- `/gallery` - Main gallery index page
  - Component: [app/gallery/page.tsx](app/gallery/page.tsx)
  - Async server component — fetches all gallery data at build time
  - Displays Trips, People, and Videos sections

- `/gallery/[trip]` - Individual trip gallery viewer
  - Unused — trips use GalleryModal instead

- `/gallery/people/[category]` - People gallery viewer
  - Component: [app/gallery/people/[category]/page.tsx](app/gallery/people/[category]/page.tsx)
  - Async server component — fetches photos from API at build time
  - Client component: [app/gallery/people/[category]/PeopleGalleryClient.tsx](app/gallery/people/[category]/PeopleGalleryClient.tsx)

### Components

#### GalleryModal ([components/GalleryModal.tsx](components/GalleryModal.tsx))
Client component that renders gallery cards and full-screen modal viewer.

**Props:**
```typescript
{
  galleries: Record<string, {
    title: string;
    description: string;
    coverImage: string;
    media: Array<{ src: string; alt: string; type: "image" | "video" }>;
    externalUrl?: string;       // Redirects to external site instead of showing photos
    externalLinkText?: string;  // Custom text for external link button
  }>;
}
```

**Features:**
- Grid of gallery preview cards with hover effects
- Full-screen modal viewer with navigation
- Keyboard support (Escape to close)
- Image preloading for smooth navigation
- Video support with HTML5 player
- External URL handling (displays link instead of photos)

#### PeopleGalleryClient ([app/gallery/people/[category]/PeopleGalleryClient.tsx](app/gallery/people/[category]/PeopleGalleryClient.tsx))
Client component for full-page people gallery viewer.

**Props:**
```typescript
{
  gallery: {
    title: string;
    description: string;
    photos: Array<{ src: string; alt: string; caption?: string }>;
  };
}
```

**Features:**
- Full-size image viewer with aspect ratio preservation
- Navigation arrows for previous/next
- Thumbnail strip with current image highlighting
- Photo counter display
- Empty state handling

## Data Management

### Media URLs

All media is served from the Pi API:

| Content | URL Pattern |
|---|---|
| Photo (full res) | `https://api.tyler-schwenk.com/galleries/photos/{id}/file` |
| Photo (thumbnail) | `https://api.tyler-schwenk.com/galleries/photos/{id}/file?thumbnail=true` |
| Video stream | `https://api.tyler-schwenk.com/videos/{id}/stream` |
| Video thumbnail | `https://api.tyler-schwenk.com/videos/{id}/thumbnail` |

Gallery cover images use the thumbnail of the first photo in the gallery.

### Trip & People Gallery Data

Galleries are fully dynamic — the frontend fetches all galleries from `GET /galleries` at build time and uses their `name` and `description` directly from the API. No hardcoded config is needed for Pi-hosted galleries.

Categorization uses a `PEOPLE_SLUGS` set in [app/gallery/page.tsx](app/gallery/page.tsx):
```typescript
const PEOPLE_SLUGS = new Set(["friends", "college", "palestinepals", "family"]);
```
Galleries whose slug is in this set appear under People; all others appear under Trips.

External-link-only entries (no photos on the Pi) stay hardcoded in `EXTERNAL_TRIPS` and `EXTERNAL_PEOPLE` and are appended at the end of each section:
```typescript
interface ExternalEntry {
  slug: string;          // used as the card key
  title: string;
  description: string;
  externalUrl: string;   // card opens this link instead of showing photos
  externalLinkText?: string;
}
```

### Video Galleries

Videos are auto-fetched from `GET /videos` — no config needed. Every public video on the Pi automatically appears as a gallery card in the Videos section.

### People Category Detail Pages

Configured in [app/gallery/people/[category]/page.tsx](app/gallery/people/[category]/page.tsx) via `CATEGORY_CONFIG`:

```typescript
const CATEGORY_CONFIG = {
  friends: { title: "Friends", description: "Memories with friends", slug: "friends" },
  // ...
};
```

`generateStaticParams()` returns keys from this config, so only listed categories get static pages.

### "Why Not Instagram" Section

Static content in `WHY_NOT_INSTAGRAM_REASONS` array in [app/gallery/page.tsx](app/gallery/page.tsx). Images in this section (e.g., `reasons/trump_mark.webp`) are static repo assets, not served from the Pi.

## File Structure

```
app/gallery/
├── page.tsx                           # Main gallery index (async server component)
├── [trip]/page.tsx                    # Trip detail page (unused)
└── people/[category]/
    ├── page.tsx                       # People gallery (async server component)
    └── PeopleGalleryClient.tsx        # People gallery client component

components/
└── GalleryModal.tsx                   # Modal viewer for trips, people, and videos

public/images/gallery/
└── reasons/                           # Static images for "Why not Instagram" section
                                       # (other gallery folders kept as backup — not served to users)
```

## Adding New Galleries

### Adding a Trip Gallery

1. Upload photos via `tyler-schwenk.com/admin/upload.html` — set the gallery name, slug, and description there
2. Redeploy the site (push to main → GitHub Actions builds + deploys)

No code change needed. The gallery auto-appears under Trips because its slug wont be in `PEOPLE_SLUGS`.

### Adding a People Gallery

1. Upload photos (same as above)
2. Add the gallery's slug to `PEOPLE_SLUGS` in [app/gallery/page.tsx](app/gallery/page.tsx)
3. For a detail page at `/gallery/people/{category}`, also add to `CATEGORY_CONFIG` in [app/gallery/people/[category]/page.tsx](app/gallery/people/[category]/page.tsx)
4. Redeploy

### Adding an External-Link Gallery

Add an entry to `EXTERNAL_TRIPS` or `EXTERNAL_PEOPLE` in [app/gallery/page.tsx](app/gallery/page.tsx), then redeploy.

### Adding a Video

1. Upload the video via the upload UI
2. Redeploy — videos are auto-fetched, no config change needed

## Features

### Modal Navigation (Trips, People Cards, Videos)

- Click gallery card to open full-screen modal
- Arrow buttons to navigate between photos
- Escape key to close
- Photo counter
- Image preloading for smooth transitions

### People Gallery Detail Pages

- Opens at `/gallery/people/{category}`
- Full-page viewer with thumbnail strip
- Navigation arrows and thumbnail highlighting

### External Links

```typescript
{
  externalUrl: "https://external-site.com/photos",
  externalLinkText: "View on External Site"  // optional
}
```

When set, clicking the card shows a full-screen overlay with a link button instead of photos.

## Static Site Generation

The gallery is built statically at deploy time. All fetch calls to the Pi API happen during `next build` on GitHub Actions. The Pi API must be reachable during the build for galleries to populate.

If the API is unreachable for a specific gallery, that gallery renders with zero photos (graceful fallback). The build does not fail.

## Styling

- **Theme**: Dark mode, slate-900 to slate-800 gradient
- **Accent**: Orange (`orange-500`)
- **Responsive**: Grid adjusts for mobile/tablet/desktop


- `/gallery` - Main gallery index page
  - Component: [app/gallery/page.tsx](app/gallery/page.tsx)
  - Displays grid of trip and people gallery cards
  - Includes "Why not Instagram" section and links to photographers

- `/gallery/[trip]` - Individual trip gallery viewer
  - Component: [app/gallery/[trip]/page.tsx](app/gallery/[trip]/page.tsx)
  - Dynamic route for trip galleries (unused - trips use modal instead)

- `/gallery/people/[category]` - People gallery viewer
  - Component: [app/gallery/people/[category]/page.tsx](app/gallery/people/[category]/page.tsx)
  - Client component: [app/gallery/people/[category]/PeopleGalleryClient.tsx](app/gallery/people/[category]/PeopleGalleryClient.tsx)
  - Dynamic route with full-page viewer and thumbnail navigation

### Components

#### GalleryModal ([components/GalleryModal.tsx](components/GalleryModal.tsx))
Client component that renders gallery cards and full-screen modal viewer.

**Props:**
```typescript
{
  galleries: Record<string, {
    title: string;
    description: string;
    coverImage: string;
    media: Array<{ src: string; alt: string; type: "image" | "video" }>;
    externalUrl?: string;       // Redirects to external site
    externalLinkText?: string;  // Custom text for external link
  }>;
}
```

**Features:**
- Grid of gallery preview cards with hover effects
- Full-screen modal viewer with navigation
- Keyboard support (Escape to close)
- Image preloading for smooth navigation
- Video support with HTML5 player
- External URL handling (displays link instead of photos)

#### PeopleGalleryClient ([app/gallery/people/[category]/PeopleGalleryClient.tsx](app/gallery/people/[category]/PeopleGalleryClient.tsx))
Client component for full-page people gallery viewer.

**Props:**
```typescript
{
  gallery: {
    title: string;
    description: string;
    photos: Array<{ src: string; alt: string; caption?: string }>;
  };
}
```

**Features:**
- Full-size image viewer with aspect ratio preservation
- Navigation arrows for previous/next
- Thumbnail strip with current image highlighting
- Photo counter display
- Empty state handling

## Data Management

### Trip Galleries

Configured in [app/gallery/page.tsx](app/gallery/page.tsx) using `tripConfig`:

```typescript
const tripConfig: Record<string, {
  title: string;           // Display name
  description: string;     // Trip description (supports \n for line breaks)
  folderPath: string;      // Path relative to public/ directory
  coverImage?: string;     // Custom cover image (defaults to first photo)
  videoPaths?: string[];   // Array of video paths (displayed before images)
  externalUrl?: string;    // External link instead of modal
}> = {
  jordan: {
    title: "Jordan",
    description: "Lovely time in Jordan. February 2026",
    folderPath: "/images/gallery/jordan",
    videoPaths: ["/video/jordan.mp4"]
  },
  // ...additional trips
};
```

**Photo Loading:**
- Uses Node.js `fs.readdirSync()` to dynamically load images from folder paths
- Helper function: `getImagesFromFolder(folderPath, altText)`
- Filters for image extensions: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- Videos placed first in media array, then images

### People Galleries

Two configurations exist:

1. **Main Gallery Page** ([app/gallery/page.tsx](app/gallery/page.tsx)) - `peopleConfig`
   - Similar to `tripConfig`
   - Dynamically loads photos from folders

2. **People Category Pages** ([app/gallery/people/[category]/page.tsx](app/gallery/people/[category]/page.tsx)) - `categoryPhotos`
   - Hardcoded photo arrays with explicit file paths
   - Used for server-side static generation

```typescript
const categoryPhotos: Record<string, {
  title: string;
  description: string;
  photos: Array<{ src: string; alt: string; caption?: string }>;
}> = {
  friends: {
    title: "Friends",
    description: "Memories with friends",
    photos: [
      { src: "/images/gallery/friends/000000040005.JPG", alt: "Friends", caption: "" },
      // ...additional photos
    ]
  }
};
```

### "Why Not Instagram" Section

Educational content explaining social media concerns:

```typescript
const WHY_NOT_INSTAGRAM_REASONS: Array<{
  title?: string;
  description?: string;
  linkUrl?: string;
  linkText?: string;
  imageSrc?: string;
}> = [
  // Reasons array
];
```

## File Structure

```
app/gallery/
├── page.tsx                           # Main gallery index
├── [trip]/page.tsx                    # Trip detail page (unused)
└── people/[category]/
    ├── page.tsx                       # People gallery server component
    └── PeopleGalleryClient.tsx        # People gallery client component

components/
└── GalleryModal.tsx                   # Modal viewer component

public/images/gallery/
├── bikenite/                          # Bike Nite photos
├── Celciliawedding/                   # Wedding event photos
├── college/                           # College memories
├── durango/                           # Durango trip
├── elcap/                             # El Cap climb
├── enchantments/                      # Enchantments backpacking
├── epc/                               # El Potrero Chico climbing
├── family/                            # Family photos
├── friends/                           # Friends photos
├── halfdome/                          # Half Dome climb
├── jordan/                            # Jordan trip
├── palestinepals/                     # Palestine solidarity event
├── reasons/                           # Instagram reasons images
└── sort/                              # Unsorted photos (not in galleries)

public/video/
└── jordan.mp4                         # Trip videos

convert_gallery_heic.py                # Image conversion utility
```

## Adding New Galleries

### Adding a Trip Gallery

1. Create folder in `public/images/gallery/{trip-name}/`
2. Add images to folder (jpg, jpeg, png, gif, webp)
3. Add entry to `tripConfig` in [app/gallery/page.tsx](app/gallery/page.tsx):

```typescript
newtripname: {
  title: "Trip Title",
  description: "Trip description",
  folderPath: "/images/gallery/{trip-name}",
  coverImage: "/images/gallery/{trip-name}/cover.jpg",  // Optional
  videoPaths: ["/video/{trip-name}.mp4"],                // Optional
  externalUrl: "https://external-site.com/gallery"       // Optional
}
```

### Adding a People Gallery

1. Create folder in `public/images/gallery/{category-name}/`
2. Add images to folder
3. Add entry to `peopleConfig` in [app/gallery/page.tsx](app/gallery/page.tsx):

```typescript
categoryname: {
  title: "Category Title",
  description: "Category description",
  folderPath: "/images/gallery/{category-name}",
  externalUrl: "https://external-link.com",              // Optional
  externalLinkText: "Custom link text"                   // Optional
}
```

4. Add entry to `categoryPhotos` in [app/gallery/people/[category]/page.tsx](app/gallery/people/[category]/page.tsx):

```typescript
categoryname: {
  title: "Category Title",
  description: "Category description",
  photos: [
    { src: "/images/gallery/{category-name}/photo1.jpg", alt: "Category Title", caption: "" },
    // ...additional photos
  ]
}
```

**Note:** Both configurations must be kept in sync for proper functionality.

## Image Management

### Supported Formats

- **Gallery Display**: jpg, jpeg, png, gif, webp
- **Upload Format**: HEIC files can be converted using the Python script

### Converting HEIC to JPG

Use the provided conversion script for HEIC files from iPhone/iOS devices:

```bash
python convert_gallery_heic.py
```

**Script behavior:**
- Recursively finds all `.heic` and `.HEIC` files in `public/images/gallery/`
- Converts to `.jpg` format with 95% quality
- Deletes original HEIC files after successful conversion
- Preserves directory structure

**Dependencies:**
```bash
pip install pillow pillow-heif
```

### Image Guidelines

- **Resolution**: No strict limits - Next.js optimizes automatically
- **Naming**: Use descriptive names or keep original camera filenames
- **Organization**: Keep photos in appropriate category folders
- **Cover Images**: First image in folder used as cover (unless specified in config)

## Features

### Modal Navigation

**Trip Galleries:**
- Click gallery card to open full-screen modal
- Arrow buttons or keyboard arrows to navigate
- Escape key to close
- Counter shows current position
- Image preloading for smooth transitions

**People Galleries:**
- Opens dedicated page route
- Full-page viewer with thumbnail strip
- Navigation arrows
- Thumbnail highlighting for current image

### External Links

Galleries can link to external sites instead of displaying photos:

```typescript
{
  externalUrl: "https://external-site.com/photos",
  externalLinkText: "View on External Site"  // Optional custom text
}
```

When `externalUrl` is set, clicking the gallery card opens a full-screen overlay with the link.

### Video Support

Trip galleries support video content:

```typescript
{
  videoPaths: ["/video/video-file.mp4"]
}
```

Videos display before images in the media array and use HTML5 video player with controls.

## Styling

- **Theme**: Dark mode with slate-900 to slate-800 gradient
- **Accent Color**: Orange (#f97316 / orange-500)
- **Hover Effects**: Scale transforms, shadow changes, opacity transitions
- **Responsive**: Grid layouts adjust for mobile/tablet/desktop
- **Typography**: Bold headers, relaxed line height for descriptions

## Static Site Generation

Both trip and people galleries use `generateStaticParams()` to generate static pages at build time:

```typescript
export async function generateStaticParams() {
  return Object.keys(tripGalleries).map((trip) => ({
    trip: trip,
  }));
}
```

This ensures fast page loads and good SEO.

## Known Issues / Considerations

- **Data Duplication**: People galleries have configs in both main page and people route - must be kept in sync
- **Trip Route Unused**: The `[trip]/page.tsx` route exists but trips use GalleryModal instead
- **Hardcoded Paths**: People category pages have hardcoded photo arrays instead of dynamic loading
- **No Captions**: Most photos don't have captions populated (empty strings)

## Future Enhancements

Potential improvements:
- Centralize people gallery configuration (eliminate duplication)
- Add metadata file (JSON/YAML) for photo captions and dates
- Image lazy loading optimization for large galleries
- Gallery search/filter functionality
- Photo metadata extraction (EXIF data for dates, locations)
- Consistent routing (modal vs. page for all galleries)
