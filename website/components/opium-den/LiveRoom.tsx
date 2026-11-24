"use client";

import Link from "next/link";
import {
  djLiveThumbUrl,
  djLiveTrack,
  fetchDjStatus,
  LIVE_SECTION_PATH,
  LIVE_TRACK_ID,
  type DjStreamStatus,
} from "@/app/opium-den/djApi";
import type { AudioPlayer } from "@/lib/useAudioPlayer";
import { usePoll } from "@/lib/usePoll";
import { useCoverPlayerBar, useDenPlayer } from "./DenPlayerProvider";
import EqBars from "./EqBars";
import LiveChat from "./LiveChat";
import LiveStatus from "./LiveStatus";
import SetArt from "./SetArt";
import { VolumeControl } from "./PlayerControls";
import { PauseIcon, PlayIcon, SpinnerIcon } from "./playerIcons";

// faster than the live section's poll: in here, the listener count and going off air should show quickly
const ROOM_STATUS_POLL_INTERVAL_MS = 5000;

/**
 * the round signal-red play button for the stream.
 *
 * @param {object} props
 * @param {AudioPlayer} props.player - the site's shared player.
 * @param {DjStreamStatus | null} props.status - latest status, for the set's cover.
 * @returns {JSX.Element} the button.
 */
function StreamButton({ player, status }: { player: AudioPlayer; status: DjStreamStatus | null }) {
  const current = player.track?.id === LIVE_TRACK_ID;
  const playing = current && player.playing;
  const loading = current && player.loading;
  return (
    <button
      type="button"
      onClick={() => player.toggle(djLiveTrack(status))}
      aria-label={playing ? "Pause the live stream" : "Play the live stream"}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-den-accent text-white transition hover:scale-105 hover:brightness-110 active:scale-95 sm:h-14 sm:w-14"
    >
      {loading ? <SpinnerIcon className="h-6 w-6" /> : playing ? <PauseIcon className="h-6 w-6" /> : <PlayIcon className="h-6 w-6" />}
    </button>
  );
}

/**
 * the opium den's live room, the live stream's full view, built around the chat: a
 * compact header (the set's cover, "live room", how long it's been on and who's
 * listening, the play button, volume on desktop, a red edge while on air), and the chat filling the rest of the
 * screen with its box at the bottom. the room is exactly one screen tall (less the player
 * bar when a past set's playing, via --den-bar-clearance), so on a phone the message box
 * sits where your thumb is. while the stream's what's playing, the player bar steps aside
 * since this page has the controls. off air it says so and keeps the last few hours of
 * chat readable. see website/docs/OPIUM_DEN.md.
 *
 * @returns {JSX.Element} the room.
 */
export default function LiveRoom() {
  const { data: status, error } = usePoll(fetchDjStatus, ROOM_STATUS_POLL_INTERVAL_MS);
  const player = useDenPlayer();
  useCoverPlayerBar(LIVE_TRACK_ID);
  const live = Boolean(status?.live);
  const liveLoaded = player.track?.id === LIVE_TRACK_ID;
  const streaming = live && liveLoaded && player.playing;

  return (
    <main className="mx-auto flex h-[calc(100dvh-var(--den-bar-clearance,0px))] w-full max-w-4xl flex-col px-4 pb-4 sm:px-8 sm:pb-6">
      {/* the home button's row: it sits fixed top-left, so this just leaves it room */}
      <div className="flex h-20 shrink-0 items-center justify-end sm:h-24">
        <Link href={LIVE_SECTION_PATH} className="font-den-mono text-[11px] uppercase transition-colors hover:text-den-accent-soft">
          &larr; Live from the den
        </Link>
      </div>

      <header
        className={`flex shrink-0 items-center gap-3 border bg-den-raised p-3 sm:gap-4 sm:p-4 ${
          live ? "border-den-ink shadow-[inset_3px_0_0_var(--color-den-accent)]" : "border-den-line"
        }`}
      >
        <div className="relative shrink-0">
          <SetArt src={djLiveThumbUrl(status)} dim={!live} className="h-12 w-12 sm:h-14 sm:w-14" />
          {streaming && <EqBars active={!player.loading} className="absolute bottom-1 right-1 h-2.5 w-2.5 text-den-accent" />}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold tracking-[-0.04em] sm:text-3xl">Live room</h1>
          <LiveStatus status={status} className="mt-1 text-[11px]" />
          {error && !status && <p className="mt-0.5 font-den-mono text-[11px] text-den-muted">{error}</p>}
        </div>
        {live && liveLoaded && <VolumeControl player={player} className="hidden md:flex" />}
        {live && <StreamButton player={player} status={status} />}
      </header>

      <div className="mt-3 min-h-0 flex-1 sm:mt-4">
        <LiveChat live={live} />
      </div>
    </main>
  );
}
