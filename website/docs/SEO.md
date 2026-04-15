# SEO Configuration

## Overview
The site uses Next.js App Router metadata to provide modern SEO defaults, social previews, and crawler directives. These settings are defined at the root layout level and apply to all routes unless overridden.

## Global Metadata
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
- Gallery trip routes
- Gallery people routes

The sitemap is exposed at:
- https://tyler-schwenk.github.io/sitemap.xml

## Robots
Robots directives allow all crawling and reference the sitemap at:
- https://tyler-schwenk.github.io/robots.txt

## Social Preview Image
Open Graph and Twitter cards use the current site icon as the default social preview image:
- /images/favicon/android-chrome-512x512.png
