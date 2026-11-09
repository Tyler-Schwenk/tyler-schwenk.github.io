import type { Metadata } from "next";

export const SITE_URL = "https://tyler-schwenk.com";
export const SITE_NAME = "Tyler Schwenk";

// generated 1200x630 link preview cards, one per section (see website/docs/SEO.md)
const OG_CARD_DIR = "/images/og";
const OG_CARD_WIDTH_PX = 1200;
const OG_CARD_HEIGHT_PX = 630;

export interface PreviewImage {
  /** site-relative path, e.g. "/images/og/kiln.jpg" */
  url: string;
  /** optional, but lets some apps lay out the preview before the image loads */
  width?: number;
  height?: number;
  alt: string;
}

const DEFAULT_PREVIEW_SIZE_PX = 512;

/** the frog site icon, for the homepage and any page without its own card */
export const DEFAULT_PREVIEW_IMAGE: PreviewImage = {
  url: "/images/favicon/android-chrome-512x512.png",
  width: DEFAULT_PREVIEW_SIZE_PX,
  height: DEFAULT_PREVIEW_SIZE_PX,
  alt: SITE_NAME,
};

export interface PageMetadataOptions {
  /** page name, shown in the tab (with the site suffix) and as the link preview title */
  title: string;
  description: string;
  /** route path starting with a slash, e.g. "/kiln" */
  path: string;
  /** preview image; use ogCard() for the standard section cards */
  image: PreviewImage;
}

/**
 * builds a preview image entry for one of the generated section cards.
 * @param {string} name - card file name without extension, e.g. "kiln".
 * @param {string} alt - what's in the picture.
 * @returns {PreviewImage} the card's path, size, and alt text.
 */
export function ogCard(name: string, alt: string): PreviewImage {
  return {
    url: `${OG_CARD_DIR}/${name}.jpg`,
    width: OG_CARD_WIDTH_PX,
    height: OG_CARD_HEIGHT_PX,
    alt,
  };
}

/**
 * builds a page's metadata so links shared from it preview that page instead of the homepage.
 *
 * next merges metadata shallowly, so a page that only sets title/description still
 * inherits the root layout's whole openGraph and twitter blocks (homepage title, frog
 * image, homepage url). this fills all of them in for the page.
 *
 * @param {PageMetadataOptions} options - the page's title, description, path, and preview image.
 * @returns {Metadata} metadata to export from the page or its layout.
 */
export function pageMetadata({ title, description, path, image }: PageMetadataOptions): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: SITE_NAME,
      url: path,
      title,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}
