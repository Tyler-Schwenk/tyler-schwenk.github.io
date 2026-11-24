import Image from "next/image";
import Link from "next/link";

import PageWrapper from "@/components/PageWrapper";
import ZineHeadline from "@/components/events/ZineHeadline";
import { EVENTS, EventEntry } from "./data";
import { ogCard, pageMetadata } from "@/lib/siteMetadata";
import "./zine.css";

export const metadata = pageMetadata({
  title: "Upcoming Events",
  description: "Parties, meetups, and fundraisers coming up, plus the ones that already happened",
  path: "/events",
  image: ogCard("events", "pixel art megaphone"),
});

const HEADLINE_LINES = ["Upcoming", "events"];
const CARD_IMAGE_SIZES = "(max-width: 760px) 100vw, 400px";

/**
 * the events landing page, laid out as a riso zine: upcoming events pinned to a
 * big board up top, past ones on a smaller board under them.
 *
 * @returns {JSX.Element} the events overview page.
 */
export default function EventsPage() {
  const upcomingEvents = EVENTS.filter((e) => !e.past);
  const pastEvents = EVENTS.filter((e) => e.past);

  return (
    <PageWrapper>
      <div className="zine">
        <div className="zine-wrap">
          <div className="zine-top">
            <span>tyler&apos;s house &middot; events</span>
            <span className="zine-top-extra">
              {upcomingEvents.length} coming up &middot; {pastEvents.length} already happened &middot; free, take one
            </span>
          </div>
          <ZineHeadline lines={HEADLINE_LINES} />

          {upcomingEvents.length > 0 && (
            <section className="zine-section" aria-label="Coming up">
              <div className="zine-board big">
                {upcomingEvents.map((event, i) => (
                  <EventCard key={event.slug} event={event} index={i} isNext={i === 0} />
                ))}
              </div>
            </section>
          )}

          {pastEvents.length > 0 && (
            <section className="zine-section">
              <div className="zine-sechead blue">
                <h2>Already happened</h2>
                <span className="zine-hand">the archive, newest first. thanks for coming</span>
              </div>
              <div className="zine-board">
                {pastEvents.map((event, i) => (
                  <EventCard key={event.slug} event={event} index={i} isNext={false} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}

/**
 * one event taped to the board: its cover or flier as a halftone duotone (hover shows
 * the real colors), the name scribbled under it, then when, where and the summary.
 *
 * @param {object} props - component props.
 * @param {EventEntry} props.event - the event.
 * @param {number} props.index - its place on the board, which alternates the ink.
 * @param {boolean} props.isNext - gets a "next up!" scribble, for the first upcoming event.
 * @returns {JSX.Element} the card, linking to the event's page.
 */
function EventCard({ event, index, isNext }: { event: EventEntry; index: number; isNext: boolean }) {
  const photo = event.coverImage ?? event.flierImage;
  const ink = index % 2 ? "pink" : "";

  return (
    <Link href={`/events/${event.slug}`} className="zine-card">
      <span className="zine-tape" />
      {isNext && <span className="zine-note">next up!</span>}
      <div className="zine-card-photo">
        <div className={`zine-duo ${ink}`}>
          {photo ? (
            <Image src={photo.src} alt={photo.alt} fill sizes={CARD_IMAGE_SIZES} />
          ) : (
            <div className="zine-duo-ph" />
          )}
        </div>
        <span className="zine-go" aria-hidden="true">&rarr;</span>
      </div>
      <h3>{event.title}</h3>
      <div className="zine-meta">
        <span>{event.dateText}</span>
        <span>@ {event.locationText}</span>
      </div>
      {event.summary && <p>{event.summary}</p>}
    </Link>
  );
}
