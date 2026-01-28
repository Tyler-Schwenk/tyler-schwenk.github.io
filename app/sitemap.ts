import type { MetadataRoute } from "next";

const SITE_URL = "https://tyler-schwenk.github.io";

const STATIC_ROUTES = [
  "/",
  "/pac-tyler",
  "/gallery",
  "/cookbook",
  "/inspiration",
  "/mallard",
  "/mallard/confirm",
  "/projects/ribbit-radar",
  "/projects/trade-routes",
  "/projects/others",
  "/sd-workspaces",
];

const TRIP_GALLERY_SLUGS = [
  "epc",
  "durango",
  "ceciliawedding",
  "elcap",
  "halfdome",
  "enchantments",
];

const PEOPLE_GALLERY_SLUGS = [
  "friends",
  "college",
  "palestinepals",
  "family",
  "bikenite",
];

const PRIORITY_HIGHEST = 1.0;
const PRIORITY_HIGH = 0.8;
const PRIORITY_MEDIUM = 0.6;
const PRIORITY_LOW = 0.4;
const CHANGE_FREQUENCY_MONTHLY: MetadataRoute.Sitemap[number]["changeFrequency"] = "monthly";

/**
 * Builds a fully-qualified URL for a route path.
 *
 * @param {string} path - Route path beginning with a slash.
 * @returns {string} Absolute URL for the route.
 */
function buildUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

/**
 * Generates the sitemap entries for the site.
 *
 * @returns {MetadataRoute.Sitemap} Sitemap definition for static routes.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const staticEntries = STATIC_ROUTES.map((route, index) => ({
    url: buildUrl(route),
    lastModified,
    changeFrequency: CHANGE_FREQUENCY_MONTHLY,
    priority: index === 0 ? PRIORITY_HIGHEST : PRIORITY_HIGH,
  }));

  const tripEntries = TRIP_GALLERY_SLUGS.map((slug) => ({
    url: buildUrl(`/gallery/${slug}`),
    lastModified,
    changeFrequency: CHANGE_FREQUENCY_MONTHLY,
    priority: PRIORITY_MEDIUM,
  }));

  const peopleEntries = PEOPLE_GALLERY_SLUGS.map((slug) => ({
    url: buildUrl(`/gallery/people/${slug}`),
    lastModified,
    changeFrequency: CHANGE_FREQUENCY_MONTHLY,
    priority: PRIORITY_LOW,
  }));

  return [...staticEntries, ...tripEntries, ...peopleEntries];
}
