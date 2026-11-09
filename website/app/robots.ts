import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteMetadata";

export const dynamic = "force-static";

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
