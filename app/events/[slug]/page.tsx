import Link from "next/link";
import { notFound } from "next/navigation";

import PageWrapper from "@/components/PageWrapper";
import { EVENTS, EventEntry, getEventBySlug } from "../data";
import EventFlierModal from "@/components/EventFlierModal";

/**
 * Generates static params for event detail pages.
 *
 * @returns {{ slug: string }[]} The list of event slugs.
 */
export function generateStaticParams(): { slug: string }[] {
  return EVENTS.map((event) => ({ slug: event.slug }));
}

/**
 * Renders a single event detail page.
 *
 * @param {object} props - Component props.
 * @param {{ slug: string }} props.params - Route parameters.
 * @returns {JSX.Element} The event detail page.
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

  return (
    <PageWrapper>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 py-16">
        <div className="container mx-auto px-6 max-w-4xl">
          <Link
            href="/events"
            className="text-indigo-200 text-sm tracking-wide hover:text-white transition"
          >
            Back to events
          </Link>

          <div className="mt-6 bg-slate-900/70 border border-slate-700 rounded-2xl p-8 shadow-xl">
            <EventHeader event={event} />
            <EventDetails event={event} />
            <EventHighlights event={event} />
            <EventLinks event={event} />
            <EventRsvp event={event} />
            <EventFlierModal flier={event.flierImage} />
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

/**
 * Renders the main event header.
 *
 * @param {object} props - Component props.
 * @param {EventEntry} props.event - Event data.
 * @returns {JSX.Element} The header section.
 */
function EventHeader({ event }: { event: EventEntry }) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl md:text-4xl font-bold text-white">
        {event.title}
      </h1>
      <p className="text-slate-300 mt-3">{event.summary}</p>
    </header>
  );
}

/**
 * Renders the date and location details.
 *
 * @param {object} props - Component props.
 * @param {EventEntry} props.event - Event data.
 * @returns {JSX.Element} The event metadata section.
 */
function EventDetails({ event }: { event: EventEntry }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 text-sm text-slate-200 mb-8">
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
        <p className="text-slate-400 uppercase tracking-wide text-xs">Date</p>
        <p className="mt-2 font-semibold text-white">{event.dateText}</p>
      </div>
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
        <p className="text-slate-400 uppercase tracking-wide text-xs">Location</p>
        <p className="mt-2 font-semibold text-white">{event.locationText}</p>
      </div>
    </div>
  );
}

/**
 * Renders optional highlight bullets for the event.
 *
 * @param {object} props - Component props.
 * @param {EventEntry} props.event - Event data.
 * @returns {JSX.Element | null} The highlights section when present.
 */
function EventHighlights({ event }: { event: EventEntry }) {
  if (!event.highlights || event.highlights.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-white mb-3">Highlights</h2>
      <ul className="list-disc list-inside text-slate-300 space-y-2">
        {event.highlights.map((highlight) => (
          <li key={highlight}>{highlight}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Renders optional external links for the event.
 *
 * @param {object} props - Component props.
 * @param {EventEntry} props.event - Event data.
 * @returns {JSX.Element | null} The links section when present.
 */
function EventLinks({ event }: { event: EventEntry }) {
  if (!event.links || event.links.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-white mb-3">Related links</h2>
      <div className="flex flex-col gap-3">
        {event.links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-between rounded-xl border border-indigo-500/50 px-4 py-3 text-indigo-100 hover:bg-indigo-500/20 transition"
          >
            <span>{link.label}</span>
            <span className="text-sm text-indigo-300">Open</span>
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * Renders RSVP information for the event.
 *
 * @param {object} props - Component props.
 * @param {EventEntry} props.event - Event data.
 * @returns {JSX.Element | null} The RSVP section when present.
 */
function EventRsvp({ event }: { event: EventEntry }) {
  if (!event.rsvpLink && !event.rsvpNote) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-white mb-3">RSVP</h2>
      {event.rsvpLink ? (
        <a
          href={event.rsvpLink.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-full border border-indigo-400 px-5 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-500/30 transition"
        >
          {event.rsvpLink.label}
        </a>
      ) : (
        <p className="text-slate-300">{event.rsvpNote}</p>
      )}
    </div>
  );
}

