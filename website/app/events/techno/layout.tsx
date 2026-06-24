import type { Metadata } from "next";

const SITE_URL = "https://tyler-schwenk.com";
const EVENT_TITLE = "Lavender Bay — Techno Renegade";
const EVENT_DESCRIPTION =
  "Free entry techno renegade. July 17 at 7 PM, Mission Bay, San Diego. All proceeds to Al Otro Lado — immigrant rights & mutual aid.";
const OG_IMAGE_URL = `${SITE_URL}/images/events/lav_flier.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: EVENT_TITLE,
  description: EVENT_DESCRIPTION,
  openGraph: {
    type: "website",
    url: `${SITE_URL}/events/techno`,
    title: EVENT_TITLE,
    description: EVENT_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 1600,
        alt: "Lavender Bay techno renegade flier",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: EVENT_TITLE,
    description: EVENT_DESCRIPTION,
    images: [OG_IMAGE_URL],
  },
};

/**
 * Layout wrapper for the techno event route — sets event-specific Open Graph metadata.
 *
 * @param {{ children: React.ReactNode }} props - Layout props.
 * @returns {JSX.Element} Passthrough children wrapper.
 */
export default function TechnoEventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
