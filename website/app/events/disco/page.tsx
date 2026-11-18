import { notFound } from "next/navigation";

import DiscoInvite from "@/components/disco/DiscoInvite";
import { DISCO_EVENT_SLUG } from "@/components/disco/constants";
import { pageMetadata } from "@/lib/siteMetadata";
import { getEventBySlug } from "../data";

const PREVIEW_IMAGE = {
  url: "/images/events/disco-og.jpg",
  width: 1200,
  height: 630,
  alt: "Disco Night is Back! title card from the invite video",
};

export const metadata = pageMetadata({
  title: "Disco December",
  description: "Disco night is back. Open your invite, sound on.",
  path: `/events/${DISCO_EVENT_SLUG}`,
  image: PREVIEW_IMAGE,
});

/**
 * the disco december invite page. the title comes from the events list; the
 * flier's own details live in components/disco/constants.ts.
 * @returns {JSX.Element} the full screen invite.
 */
export default function DiscoInvitePage() {
  const event = getEventBySlug(DISCO_EVENT_SLUG);
  if (!event) {
    notFound();
  }

  return <DiscoInvite info={{ title: event.title }} />;
}
