"use client";

import Image from "next/image";
import { formatElapsed, parseBackendTime } from "@/app/admin/format";
import type { DjStreamStatus } from "@/app/opium-den/djApi";
import EqBars from "./EqBars";
import { PauseIcon, PlayIcon, SpinnerIcon } from "./playerIcons";

const BOARD_ART_SRC = "/images/8bit/dj_board.png";
const BOARD_ART_WIDTH_PX = 112;
const BOARD_ART_HEIGHT_PX = 52;
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
 * the "live now" / "off air" line, with a pulsing dot while it's live.
 *
 * @param {object} props
 * @param {boolean} props.live - the stream's on.
 * @param {string} props.details - what follows the label, like how long it's been on.
 * @returns {JSX.Element} the status line.
 */
function StatusLine({ live, details }: { live: boolean; details: string }) {
  return (
    <p className="mt-1 flex items-start gap-2 text-sm text-den-muted">
      {live ? (
        <span className="relative mt-1.5 flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-den-accent opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-den-accent" />
        </span>
      ) : (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-den-faint" aria-hidden="true" />
      )}
      <span className="min-w-0">
        <span className={live ? "font-medium text-den-accent" : "text-den-ink/80"}>{live ? "Live now" : "Off air"}</span>
        {details && <span> · {details}</span>}
      </span>
    </p>
  );
}

/**
 * the top of the booth, one quiet row: the dj board art, "live from the den" with whether
 * it's on, and a play button while it is. greyed out when it's off air.
 *
 * @param {object} props
 * @param {DjStreamStatus | null} props.status - latest status, null before the first answer.
 * @param {string | null} props.error - why the last status check failed, if it did.
 * @param {boolean} props.playing - the live stream is what's playing right now.
 * @param {boolean} props.loading - and it's still connecting.
 * @param {() => void} props.onToggle - play or pause the live stream.
 * @returns {JSX.Element} the live row.
 */
export default function LiveHero({
  status,
  error,
  playing,
  loading,
  onToggle,
}: {
  status: DjStreamStatus | null;
  error: string | null;
  playing: boolean;
  loading: boolean;
  onToggle: () => void;
}) {
  const live = Boolean(status?.live);
  const details = live
    ? [onAirFor(status?.started_at ?? null), `${status?.listeners ?? 0} listening`].filter(Boolean).join(" · ")
    : OFF_AIR_NOTE;

  return (
    <section className="flex items-center gap-4 border-y border-den-line py-5">
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-white/[0.04] sm:h-20 sm:w-20">
        <Image
          src={BOARD_ART_SRC}
          alt="pixel art of the ddj-400 controller"
          width={BOARD_ART_WIDTH_PX}
          height={BOARD_ART_HEIGHT_PX}
          className={`pixelated h-auto w-[80%] transition ${live ? "" : "opacity-50 grayscale"}`}
        />
        {live && playing && (
          <EqBars active={!loading} className="absolute bottom-1.5 right-1.5 h-3 w-3 text-den-accent" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h2 className="font-semibold text-den-ink">Live from the den</h2>
        <StatusLine live={live} details={details} />
        {error && !status && <p className="mt-1 text-xs text-den-faint">{error}</p>}
      </div>

      {live && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={playing ? "Pause the live stream" : "Play the live stream"}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-den-ink text-den-bg transition hover:scale-105 active:scale-95"
        >
          {loading ? <SpinnerIcon /> : playing ? <PauseIcon /> : <PlayIcon />}
        </button>
      )}
    </section>
  );
}
