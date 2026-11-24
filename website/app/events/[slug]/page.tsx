import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import PageWrapper from "@/components/PageWrapper";
import { EVENTS, EventEntry, getEventBySlug } from "../data";
import EventRsvpForm from "@/components/EventRsvpForm";
import ZineFlier from "@/components/events/ZineFlier";
import ZineHeadline from "@/components/events/ZineHeadline";
import { DEFAULT_PREVIEW_IMAGE, pageMetadata } from "@/lib/siteMetadata";
import "../zine.css";

const SNAP_IMAGE_WIDTH_PX = 600;
const SNAP_IMAGE_HEIGHT_PX = 400;

/**
 * Generates static params for event detail pages.
 *
 * @returns {{ slug: string }[]} The list of event slugs.
 */
export function generateStaticParams(): { slug: string }[] {
  return EVENTS.map((event) => ({ slug: event.slug }));
}

/**
 * sets the event's title and link preview: its flier if it has one, plus when and where.
 *
 * @param {object} props - route props.
 * @param {Promise<{ slug: string }>} props.params - route parameters.
 * @returns {Promise<Metadata>} the event page's metadata, or nothing for an unknown slug.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event) {
    return {};
  }

  return pageMetadata({
    title: event.title,
    description: [event.dateText, event.locationText, event.summary].filter(Boolean).join(" | "),
    path: `/events/${event.slug}`,
    image: event.flierImage
      ? { url: event.flierImage.src, alt: event.flierImage.alt }
      : DEFAULT_PREVIEW_IMAGE,
  });
}

/**
 * an event's own page, in the events section's riso zine look: the name as a
 * two-ink headline, then a spread with the flier taped down on one side and
 * when, where, the plan, links and rsvp on the other. disco and techno have their
 * own routes and designs, so they never land here.
 *
 * @param {object} props - component props.
 * @param {Promise<{ slug: string }>} props.params - route parameters.
 * @returns {Promise<JSX.Element>} the event page.
 */
export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = getEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const past = Boolean(event.past);

  return (
    <PageWrapper>
      <div className="zine">
        <div className="zine-wrap">
          <div className="zine-top">
            <Link href="/events">&larr; all events</Link>
            <span className="zine-top-extra">{past ? "already happened" : "coming up"} &middot; free, take one</span>
          </div>
          <ZineHeadline lines={[event.title]} small />
          {event.summary && (
            <div className="zine-issue">
              <p>{event.summary}</p>
            </div>
          )}

          <section className={`zine-spread${event.flierImage ? "" : " solo"}`}>
            {event.flierImage && <ZineFlier flier={event.flierImage} past={past} />}
            <div>
              <EventFacts event={event} />
              <EventSchedule event={event} />
              <EventHighlights event={event} />
              <EventLinks event={event} />
              <EventRsvp event={event} />
              {event.rsvpForm && <EventRsvpForm eventSlug={event.slug} />}
            </div>
          </section>

          <EventAdditionalImages event={event} />
        </div>
      </div>
    </PageWrapper>
  );
}

/**
 * when and where, side by side in a ruled box.
 *
 * @param {object} props - component props.
 * @param {EventEntry} props.event - the event.
 * @returns {JSX.Element} the facts box.
 */
function EventFacts({ event }: { event: EventEntry }) {
  return (
    <div className="zine-facts">
      <div>
        <span>when</span>
        <b>{event.dateText}</b>
      </div>
      <div>
        <span>where</span>
        <b>{event.locationText}</b>
      </div>
    </div>
  );
}

/**
 * the event's schedule, if it has one.
 *
 * @param {object} props - component props.
 * @param {EventEntry} props.event - the event.
 * @returns {JSX.Element | null} the schedule block, or nothing.
 */
function EventSchedule({ event }: { event: EventEntry }) {
  if (!event.schedule) {
    return null;
  }

  return (
    <div className="zine-block">
      <h2>The plan</h2>
      <p>{event.schedule}</p>
    </div>
  );
}

/**
 * the event's highlights as an arrow list, if it has any.
 *
 * @param {object} props - component props.
 * @param {EventEntry} props.event - the event.
 * @returns {JSX.Element | null} the highlights block, or nothing.
 */
function EventHighlights({ event }: { event: EventEntry }) {
  if (!event.highlights || event.highlights.length === 0) {
    return null;
  }

  return (
    <div className="zine-block">
      <h2>The rundown</h2>
      <ul className="zine-list">
        {event.highlights.map((highlight) => (
          <li key={highlight}>{highlight}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * the event's outside links as little speech-bubble tags, if it has any.
 *
 * @param {object} props - component props.
 * @param {EventEntry} props.event - the event.
 * @returns {JSX.Element | null} the links block, or nothing.
 */
function EventLinks({ event }: { event: EventEntry }) {
  if (!event.links || event.links.length === 0) {
    return null;
  }

  return (
    <div className="zine-block">
      <h2>Links</h2>
      <div className="zine-links">
        {event.links.map((link) => (
          <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="zine-link">
            <span>{link.label}</span>
            <small>&#8599;</small>
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * extra photos taped along the bottom of the page, like a donation receipt.
 *
 * @param {object} props - component props.
 * @param {EventEntry} props.event - the event.
 * @returns {JSX.Element | null} the photos section, or nothing.
 */
function EventAdditionalImages({ event }: { event: EventEntry }) {
  if (!event.additionalImages || event.additionalImages.length === 0) {
    return null;
  }

  return (
    <section className="zine-section">
      <div className="zine-sechead blue">
        <h2>Also pinned up</h2>
      </div>
      <div className="zine-snaps">
        {event.additionalImages.map((image) => (
          <div key={image.src} className="zine-snap">
            <span className="zine-tape" />
            <Image src={image.src} alt={image.alt} width={SNAP_IMAGE_WIDTH_PX} height={SNAP_IMAGE_HEIGHT_PX} />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * the rsvp: a big stamped button when there's a sign-up link, else just the note.
 *
 * @param {object} props - component props.
 * @param {EventEntry} props.event - the event.
 * @returns {JSX.Element | null} the rsvp block, or nothing.
 */
function EventRsvp({ event }: { event: EventEntry }) {
  if (!event.rsvpLink && !event.rsvpNote) {
    return null;
  }

  return (
    <div className="zine-block">
      <h2>RSVP</h2>
      {event.rsvpLink ? (
        <a href={event.rsvpLink.href} target="_blank" rel="noopener noreferrer" className="zine-btn">
          {event.rsvpLink.label}
        </a>
      ) : (
        <p>{event.rsvpNote}</p>
      )}
    </div>
  );
}
