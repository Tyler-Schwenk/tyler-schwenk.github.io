"use client";

import { useState } from "react";
import { formatDate, formatDuration, formatElapsed, parseBackendTime } from "@/app/admin/format";
import { DJ_LIVE_URL, djSetAudioUrl, type DjSet, type DjStreamStatus } from "@/app/opium-den/djApi";
import { useDjStream } from "@/lib/useDjStream";

const CARD_CLASS = "rounded-xl border border-red-800/60 bg-red-900/20 p-4";

/**
 * how long the stream's been on, for the live panel.
 *
 * @param {string | null} startedAt - when butt connected, naive UTC.
 * @returns {string} like "on for 23 min", or "" if the start time's unknown.
 */
function onAirFor(startedAt: string | null): string {
  if (!startedAt) return "";
  const started = parseBackendTime(startedAt);
  if (Number.isNaN(started.getTime())) return "";
  return `on for ${formatElapsed(Date.now() - started.getTime())}`;
}

/**
 * the live player when the stream's on, or an off air note when it's not.
 *
 * @param {object} props
 * @param {DjStreamStatus | null} props.status - latest status, null before the first answer.
 * @param {string | null} props.error - why the last check failed, if it did.
 */
function LivePanel({ status, error }: { status: DjStreamStatus | null; error: string | null }) {
  if (!status?.live) {
    return (
      <div className={CARD_CLASS}>
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-red-300">
          <span className="h-2.5 w-2.5 rounded-full bg-red-900" aria-hidden="true" />
          off air
        </p>
        <p className="mt-2 text-red-100/80 leading-relaxed">
          when i&apos;m practicing on the decks it streams here live, so check back sometime.
        </p>
        {error && !status && <p className="mt-2 text-xs text-red-300/70">{error}</p>}
      </div>
    );
  }

  const details = [onAirFor(status.started_at), `${status.listeners} listening`].filter(Boolean).join(" - ");
  return (
    <div className="rounded-xl border border-red-500/80 bg-red-900/40 p-4 shadow-[0_0_24px_rgba(239,68,68,0.25)]">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold uppercase tracking-wide text-red-100">
        <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        live now
        <span className="font-normal normal-case tracking-normal text-red-200/80">{details}</span>
      </p>
      <audio className="mt-3 w-full" controls preload="none" src={DJ_LIVE_URL}>
        your browser can&apos;t play the stream.
      </audio>
    </div>
  );
}

/**
 * the recorded sets, newest first. one plays at a time: picking a set swaps the player to it.
 *
 * @param {object} props
 * @param {DjSet[]} props.sets - the sets.
 */
function SetArchive({ sets }: { sets: DjSet[] }) {
  const [playingId, setPlayingId] = useState<number | null>(null);

  if (sets.length === 0) {
    return <p className="text-sm text-red-200/70">no sets recorded yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {sets.map((set) => {
        const playing = set.id === playingId;
        return (
          <li key={set.id} className={CARD_CLASS}>
            <button
              type="button"
              onClick={() => setPlayingId(playing ? null : set.id)}
              aria-expanded={playing}
              className="flex w-full items-baseline justify-between gap-3 text-left"
            >
              <span className="min-w-0 truncate font-medium text-red-100">
                {set.title || formatDate(set.started_at)}
              </span>
              <span className="shrink-0 text-sm text-red-300">{formatDuration(set.duration_s)}</span>
            </button>
            {set.title && <p className="mt-0.5 text-xs text-red-300/70">{formatDate(set.started_at)}</p>}
            {playing && (
              <audio className="mt-3 w-full" controls autoPlay preload="metadata" src={djSetAudioUrl(set.id)}>
                your browser can&apos;t play this set.
              </audio>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * the opium den's dj booth: the live stream when i'm on the decks, and every past set
 * underneath. see website/docs/OPIUM_DEN.md.
 *
 * @returns {JSX.Element} the booth section.
 */
export default function DjBooth() {
  const { status, sets, error } = useDjStream();

  return (
    <section className="mt-8 space-y-3">
      <h2 className="text-xl font-medium text-red-100">Live from the den</h2>
      <LivePanel status={status} error={error} />
      {sets && (
        <>
          <h3 className="pt-2 text-sm font-semibold uppercase tracking-wide text-red-300">past sets</h3>
          <SetArchive sets={sets} />
        </>
      )}
    </section>
  );
}
