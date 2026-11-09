# SEO Configuration

## Overview
The site uses Next.js App Router metadata to provide modern SEO defaults, social previews, and crawler directives. These settings are defined at the root layout level and apply to all routes unless overridden.

## Global Metadata
Site URL and name live in `lib/siteMetadata.ts` (`SITE_URL` is `https://tyler-schwenk.com`) and are shared by the root layout, sitemap, and robots.

The root layout defines the following defaults:
- Canonical base URL
- Title template and default title
- Description and keywords
- Open Graph metadata for social sharing
- Twitter card metadata
- Robots directives for indexing and link following

## Sitemap
A static sitemap is generated with:
- Core site routes
- Music page route (`/opium-den`)
- Public discussion route (`/public-square`)
- Library route (`/library`)
- Gallery trip routes
- Gallery people routes

The sitemap is exposed at:
- https://tyler-schwenk.com/sitemap.xml

## Robots
Robots directives allow all crawling and reference the sitemap at:
- https://tyler-schwenk.com/robots.txt

## Page Metadata and Link Previews
Next merges metadata shallowly: a page that only sets `title` and `description` still inherits the root layout's entire `openGraph` and `twitter` blocks, so a shared link would show the homepage title, url, and image. Every public page builds its metadata with `pageMetadata()` from `lib/siteMetadata.ts` instead, which fills in:
- `title` (the root template adds ` | Tyler Schwenk` in the tab; the preview title is just the page name)
- `description`
- canonical url, `og:url`
- `og:image` / `twitter:image`, with a `summary_large_image` card

```ts
export const metadata = pageMetadata({
  title: "Kiln",
  description: "Live temperature, rate of rise, and past firings from the kiln.",
  path: "/kiln",
  image: ogCard("kiln", "pixel art kiln"),
});
```

Client component pages (`'use client'`) can't export metadata, so they get a passthrough `layout.tsx` that exports it instead (garden, kitchen, mallard, public-square, sd-workspaces, solar, console, projects/others). The mallard layout also covers `/mallard/confirm`.

Event detail pages (`/events/[slug]`) use `generateMetadata` to preview the event's flier, with date, location, and summary as the description. `/events/techno` has its own hand-written metadata in its layout.

### Preview images
- **Section cards**: `public/images/og/<name>.jpg`, 1200x630. Each is the section's 8-bit icon (full-size original, padding trimmed) centered on a dark vignette. `ogCard(name, alt)` points at one.
- **Flies**: `public/images/og/flies.jpg` is 1200x800 pixel art, so `/flies` passes its size directly.
- **Default**: `DEFAULT_PREVIEW_IMAGE`, the frog site icon (`/images/favicon/android-chrome-512x512.png`). Used by the homepage, the opium den, and any route without its own metadata (gallery trip/people pages, admin, display).

Keep cards as JPEGs under ~300KB; some messaging apps skip previews with big images. Link preview apps cache aggressively, so a changed preview may take a while to show for a url that was already shared.
