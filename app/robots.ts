import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const SITE_URL = "https://tyler-schwenk.github.io";
const USER_AGENT = "*";
const ALLOW_ALL = "/";

/**
 * Defines robots.txt rules for the site.
 *
 * @returns {MetadataRoute.Robots} Robots directives and sitemap location.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: USER_AGENT,
      allow: ALLOW_ALL,
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
