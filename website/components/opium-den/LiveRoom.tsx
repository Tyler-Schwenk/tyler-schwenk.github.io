"use client";

import Image from "next/image";
import Link from "next/link";
import { fetchDjStatus, LIVE_TRACK } from "@/app/opium-den/djApi";
import type { AudioPlayer } from "@/lib/useAudioPlayer";
import { usePoll } from "@/lib/usePoll";
import { useDenPlayer } from "./DenPlayerProvider";
import EqBars from "./EqBars";
import LiveChat from "./LiveChat";
import LiveStatus from "./LiveStatus";
import { VolumeControl } from "./PlayerControls";
import { PauseIcon, PlayIcon, SpinnerIcon } from "./playerIcons";

// faster than the den's poll: in here, the listener count and going off air should show quickly
const ROOM_STATUS_POLL_INTERVAL_MS = 5000;
const BOARD_ART_SRC = "/images/8bit/dj_board.png";
const BOARD_ART_WIDTH_PX = 112;
const BOARD_ART_HEIGHT_PX = 52;

/**
 * the big red play button for the stream, with volume beside it on desktop.
 *
 * @param {object} props
 * @param {AudioPlayer} props.player - the den's shared player.
 * @returns {JSX.Element} the controls.
 */
function StreamControls({ player }: { player: AudioPlayer }) {
  const current = player.track?.id === LIVE_TRACK.id;
  const playing = current && player.playing;
  const loading = current && player.loading;
  return (
    <div className="mt-6 flex items-center gap-5">
      <button
        type="button"
        onClick={() => player.toggle(LIVE_TRACK)}
        aria-label={playing ? "Pause the live stream" : "Play the live stream"}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-den-accent text-white transition hover:scale-105 hover:brightness-110 active:scale-95"
      >
        {loading ? <SpinnerIcon className="h-6 w-6" /> : playing ? <PauseIcon className="h-6 w-6" /> : <PlayIcon className="h-6 w-6" />}
      </button>
      {current && <VolumeControl player={player} className="hidden md:flex" />}
    </div>
  );
}

/**
 * the opium den's live room, like a stream page: the dj board, whether it's live, how
 * long it's been on and who's listening, the play button, and the chat beside it (under
 * it on phones). plays through the den's shared player, so leaving for the den keeps the
 * music going. off air it says so, keeps the last few hours of chat readable, and points
 * back to the past sets. see website/docs/OPIUM_DEN.md.
 *
 * @returns {JSX.Element} the room.
 */
export default function LiveRoom() {
  const { data: status, error } = usePoll(fetchDjStatus, ROOM_STATUS_POLL_INTERVAL_MS);
  const player = useDenPlayer();
  const live = Boolean(status?.live);
  const streaming = live && player.track?.id === LIVE_TRACK.id && player.playing;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col px-5 pb-8 pt-24 sm:pt-28 lg:h-dvh">
      <Link href="/opium-den" className="w-fit text-sm text-den-accent-soft transition-colors hover:text-den-ink">
        &larr; Opium Den
      </Link>

      <div className="mt-6 grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="flex flex-col">
          <div
            className={`relative flex aspect-[5/2] items-center justify-center rounded-xl border lg:aspect-auto lg:min-h-0 lg:flex-1 ${
              live ? "border-den-accent/40 bg-den-accent/10" : "border-den-line bg-white/[0.03]"
            }`}
          >
            <Image
              src={BOARD_ART_SRC}
              alt="pixel art of the ddj-400 controller"
              width={BOARD_ART_WIDTH_PX}
              height={BOARD_ART_HEIGHT_PX}
              priority
              className={`pixelated h-auto w-2/5 max-w-sm transition lg:w-1/2 ${live ? "" : "opacity-40 grayscale"}`}
            />
            {streaming && <EqBars active={!player.loading} className="absolute bottom-4 right-4 h-5 w-5 text-den-accent" />}
          </div>

          <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">Live from the den</h1>
          <LiveStatus status={status} className="mt-2" />
          {error && !status && <p className="mt-2 text-sm text-den-faint">{error}</p>}

          {live ? (
            <StreamControls player={player} />
          ) : (
            <p className="mt-6 text-sm text-den-muted">
              nothing on right now.{" "}
              <Link href="/opium-den" className="text-den-accent-soft underline-offset-4 hover:underline">
                dig through the past sets
              </Link>{" "}
              in the meantime.
            </p>
          )}
        </section>

        <div className="h-[70dvh] min-h-80 lg:h-auto lg:min-h-0">
          <LiveChat live={live} />
        </div>
      </div>
    </main>
  );
}
