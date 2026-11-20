"use client";

import Image from "next/image";
import Link from "next/link";
import { LIVE_ROOM_PATH, type DjStreamStatus } from "@/app/opium-den/djApi";
import EqBars from "./EqBars";
import LiveStatus from "./LiveStatus";
import { PauseIcon, PlayIcon, SpinnerIcon } from "./playerIcons";

const BOARD_ART_SRC = "/images/8bit/dj_board.png";
const BOARD_ART_WIDTH_PX = 112;
const BOARD_ART_HEIGHT_PX = 52;

/**
 * the den's way into the live room. off air it's one quiet row: the dj board art greyed
 * out, when it streams, and a small link to the room (its chat from the last set stays
 * readable). live it lights up red with how long it's been on and who's listening, a play
 * button to listen right here, and a link into the room for the chat.
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

  return (
    <section
      className={`flex flex-wrap items-center gap-x-4 gap-y-4 ${
        live ? "rounded-xl border border-den-accent/40 bg-den-accent/10 p-4" : "border-y border-den-line py-5"
      }`}
    >
      <div className="flex min-w-0 flex-1 basis-64 items-center gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-white/[0.05] sm:h-20 sm:w-20">
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
          <LiveStatus status={status} className="mt-1 text-sm" />
          {error && !status && <p className="mt-1 text-xs text-den-faint">{error}</p>}
        </div>
      </div>

      {!live && (
        <Link
          href={LIVE_ROOM_PATH}
          className="text-sm text-den-accent-soft transition-colors hover:text-den-ink"
        >
          Live room &rarr;
        </Link>
      )}

      {live && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            aria-label={playing ? "Pause the live stream" : "Play the live stream"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-den-accent text-white transition hover:scale-105 hover:brightness-110 active:scale-95"
          >
            {loading ? <SpinnerIcon /> : playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <Link
            href={LIVE_ROOM_PATH}
            className="rounded-full border border-den-accent/50 px-4 py-2 text-sm font-medium text-den-ink transition-colors hover:bg-den-accent/15"
          >
            Join the room
          </Link>
        </div>
      )}
    </section>
  );
}
