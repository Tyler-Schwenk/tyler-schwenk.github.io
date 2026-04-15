# Gallery Documentation

## Overview

The Gallery feature displays photo and video collections organized into two main categories:
- **Trips**: Adventure-based photo galleries (climbing trips, travel, events)
- **People**: Social photo collections (friends, family, college, causes)

## Architecture

### Routes

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
