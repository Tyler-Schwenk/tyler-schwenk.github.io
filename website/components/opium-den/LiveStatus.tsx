"use client";

import { formatElapsed, parseBackendTime } from "@/app/admin/format";
import { djByline, type DjStreamStatus } from "@/app/opium-den/djApi";

const OFF_AIR_NOTE = "streams here whenever i'm practicing on the decks";

/**
 * how long the stream's been on.
 *
 * @param {string | null} startedAt - when butt connected, naive UTC.
 * @returns {string} like "on air for 23 min", or "" if the start's unknown.
 */
function onAirFor(startedAt: string | null): string {
  if (!startedAt) return "";
  const started = parseBackendTime(startedAt);
  if (Number.isNaN(started.getTime())) return "";
  return `on air for ${formatElapsed(Date.now() - started.getTime())}`;
}

/**
 * what follows "live now" or "off air": who's on (only a guest dj gets named), how long
 * it's been on and who's listening, or when it streams. the listener count only shows
 * once someone's actually tuned in.
 *
 * @param {DjStreamStatus | null} status - latest status.
 * @returns {string} the details, maybe "".
 */
export function liveDetails(status: DjStreamStatus | null): string {
  if (!status?.live) return OFF_AIR_NOTE;
  const byline = djByline(status.dj);
  const listening = status.listeners > 0 ? `${status.listeners} listening` : "";
  return [byline && `${byline} on the decks`, onAirFor(status.started_at), listening].filter(Boolean).join(" · ");
}

/**
 * the "live now" / "off air" line with its dot, blinking like a recorder's lamp while
 * it's live. set in mono, like the rest of the den's readouts.
 *
 * @param {object} props
 * @param {DjStreamStatus | null} props.status - latest status, null before the first answer.
 * @param {string} [props.className] - spacing and size classes.
 * @returns {JSX.Element} the status line.
 */
export default function LiveStatus({
  status,
  className = "text-xs",
}: {
  status: DjStreamStatus | null;
  className?: string;
}) {
  const live = Boolean(status?.live);
  const details = liveDetails(status);
  return (
    <p className={`flex items-start gap-2 font-den-mono text-den-muted ${className}`}>
      {live ? (
        <span className="den-rec-blink mt-[0.4em] h-2 w-2 shrink-0 rounded-full bg-den-accent" aria-hidden="true" />
      ) : (
        <span className="mt-[0.4em] h-2 w-2 shrink-0 rounded-full bg-den-faint" aria-hidden="true" />
      )}
      <span className="min-w-0">
        <span className={`uppercase ${live ? "font-medium text-den-accent-soft" : "text-den-ink"}`}>{live ? "Live now" : "Off air"}</span>
        {details && <span> · {details}</span>}
      </span>
    </p>
  );
}
