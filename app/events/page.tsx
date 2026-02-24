import Image from "next/image";
import Link from "next/link";

import PageWrapper from "@/components/PageWrapper";
import { EVENTS, EventEntry } from "./data";

const PAGE_TITLE = "Upcoming Events";

/**
 * Renders the upcoming events landing page.
 *
 * @returns {JSX.Element} The events overview page.
 */
export default function EventsPage() {
  return (
    <PageWrapper>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 py-16">
        <div className="container mx-auto px-6 max-w-5xl">
          <header className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-wide">
              {PAGE_TITLE}
            </h1>
          </header>

          <div className="grid gap-6 md:grid-cols-2">
            {EVENTS.map((event) => (
              <EventCard key={event.slug} event={event} />
            ))}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

/**
 * Renders a single event preview card.
 *
 * @param {object} props - Component props.
 * @param {EventEntry} props.event - Event data.
 * @returns {JSX.Element} The event preview card.
 */
function EventCard({ event }: { event: EventEntry }) {
  const detailHref = `/events/${event.slug}`;

  return (
    <div className="bg-slate-900/70 border border-slate-700 rounded-2xl overflow-hidden shadow-xl flex flex-col">
      {event.flierImage ? (
        <div className="relative w-full h-64 md:h-72">
          <Image
            src={event.flierImage.src}
            alt={event.flierImage.alt}
            fill
            className="object-cover"
            sizes="(min-width: 768px) 50vw, 100vw"
            priority={false}
          />
        </div>
      ) : (
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 px-6 py-10">
          <p className="text-indigo-200 uppercase tracking-[0.2em] text-xs">
            Event
          </p>
          <h2 className="text-2xl font-semibold text-white mt-3">
            {event.title}
          </h2>
        </div>
      )}

      <div className="p-6 flex-1 flex flex-col gap-4">
        <div>
          <h3 className="text-xl font-semibold text-white">
            {event.title}
          </h3>
          <p className="text-slate-300 mt-2">{event.summary}</p>
        </div>

        <div className="text-sm text-slate-300 space-y-1">
          <p>
            <span className="text-slate-400">Date:</span> {event.dateText}
          </p>
          <p>
            <span className="text-slate-400">Location:</span>{" "}
            {event.locationText}
          </p>
        </div>

        <Link
          href={detailHref}
          className="mt-auto inline-flex items-center justify-center rounded-full border border-indigo-400 px-4 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-500/30 transition"
        >
          Open event
        </Link>
      </div>
    </div>
  );
}
