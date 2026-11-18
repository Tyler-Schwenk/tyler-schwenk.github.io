"use client";

import Image from "next/image";
import { formatElapsed, parseBackendTime } from "@/app/admin/format";
import type { DjStreamStatus } from "@/app/opium-den/djApi";
import EqBars from "./EqBars";
import { PauseIcon, PlayIcon, SpinnerIcon } from "./playerIcons";

const BOARD_ART_SRC = "/images/8bit/dj_board.png";
const BOARD_ART_WIDTH_PX = 112;
const BOARD_ART_HEIGHT_PX = 52;

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
 * the top of the booth: the dj board art with the live stream's big play button when
 * it's on, or an off air card when it's not.
 *
 * @param {object} props
 * @param {DjStreamStatus | null} props.status - latest status, null before the first answer.
 * @param {string | null} props.error - why the last status check failed, if it did.
 * @param {boolean} props.playing - the live stream is what's playing right now.
 * @param {boolean} props.loading - and it's still connecting.
 * @param {() => void} props.onToggle - play or pause the live stream.
 * @returns {JSX.Element} the hero card.
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
    : "when i'm practicing on the decks it streams here live. check back sometime, or dig through the past sets below.";

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border p-5 sm:p-6 ${
        live
          ? "border-red-500/60 bg-gradient-to-br from-red-600/40 via-red-950/80 to-black shadow-[0_0_40px_rgba(239,68,68,0.25)]"
          : "border-red-900/70 bg-gradient-to-br from-red-950/70 to-black/80"
      }`}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div
          className={`relative flex aspect-square w-28 shrink-0 items-center justify-center rounded-xl bg-black/60 ring-1 ring-white/10 sm:w-36 ${
            live ? "" : "grayscale opacity-70"
          }`}
        >
          <Image
            src={BOARD_ART_SRC}
            alt="pixel art of the ddj-400 controller"
            width={BOARD_ART_WIDTH_PX}
            height={BOARD_ART_HEIGHT_PX}
            className="pixelated w-[85%] h-auto"
          />
          {live && playing && <EqBars active={!loading} className="absolute bottom-2 right-2 h-4 w-4 text-red-400" />}
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em]">
            {live ? (
              <>
                <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                </span>
                <span className="text-red-300">live now</span>
              </>
            ) : (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-red-900" aria-hidden="true" />
                <span className="text-red-300/70">off air</span>
              </>
            )}
          </p>
          <h2 className="mt-1.5 text-2xl font-semibold text-white sm:text-3xl">Live from the den</h2>
          <p className={`mt-1 text-sm ${live ? "text-red-100/80" : "text-red-200/60 leading-relaxed"}`}>{details}</p>
          {error && !status && <p className="mt-2 text-xs text-red-300/70">{error}</p>}
        </div>

        {live && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={playing ? "Pause the live stream" : "Play the live stream"}
            className="flex h-16 w-16 shrink-0 items-center justify-center self-start rounded-full bg-white text-red-700 shadow-lg transition hover:scale-105 hover:bg-red-50 active:scale-95 sm:self-center"
          >
            {loading ? (
              <SpinnerIcon className="h-7 w-7" />
            ) : playing ? (
              <PauseIcon className="h-7 w-7" />
            ) : (
              <PlayIcon className="h-7 w-7" />
            )}
          </button>
        )}
      </div>
    </section>
  );
}
