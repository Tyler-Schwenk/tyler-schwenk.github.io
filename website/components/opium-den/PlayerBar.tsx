"use client";

import Image from "next/image";
import { useEffect } from "react";
import { formatDuration } from "@/app/admin/format";
import type { AudioPlayer } from "@/lib/useAudioPlayer";
import EqBars from "./EqBars";
import SliderBar from "./SliderBar";
import { MutedIcon, PauseIcon, PlayIcon, SkipIcon, SpinnerIcon, VolumeIcon } from "./playerIcons";

const SKIP_BACK_S = 15;
const SKIP_FORWARD_S = 30;
const VOLUME_STEP = 0.01;
const ART_SRC = "/images/8bit/dj_board.png";
const ART_WIDTH_PX = 112;
const ART_HEIGHT_PX = 52;
// a bit taller than the bar on either layout, plus the phone's home indicator
const BAR_CLEARANCE = "calc(6rem + env(safe-area-inset-bottom))";

/**
 * the big round play/pause in the middle of the bar.
 *
 * @param {object} props
 * @param {AudioPlayer} props.player - the shared player.
 * @returns {JSX.Element} the button.
 */
function PlayPauseButton({ player }: { player: AudioPlayer }) {
  const { track, playing, loading } = player;
  if (!track) return null;
  return (
    <button
      type="button"
      onClick={() => player.toggle(track)}
      aria-label={playing ? "Pause" : "Play"}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 active:scale-95"
    >
      {loading ? <SpinnerIcon /> : playing ? <PauseIcon /> : <PlayIcon />}
    </button>
  );
}

/**
 * the seek bar with elapsed and total time, or a LIVE pill for the stream.
 *
 * @param {object} props
 * @param {AudioPlayer} props.player - the shared player.
 * @returns {JSX.Element} the progress row.
 */
function Progress({ player }: { player: AudioPlayer }) {
  if (player.track?.live) {
    return (
      <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-red-400">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
        live
      </div>
    );
  }
  const elapsed = formatDuration(player.currentTimeS);
  const total = player.durationS > 0 ? formatDuration(player.durationS) : "--:--";
  return (
    <div className="flex items-center gap-2 text-[11px] tabular-nums text-white/60">
      <span className="w-12 text-right">{elapsed}</span>
      <SliderBar
        value={player.currentTimeS}
        max={player.durationS}
        onChange={player.seekTo}
        label="Seek"
        valueText={`${elapsed} of ${total}`}
        className="flex-1"
      />
      <span className="w-12">{total}</span>
    </div>
  );
}

/**
 * the now-playing bar pinned to the bottom of the screen, like a streaming app: what's
 * playing on the left, transport and progress in the middle, volume on the right. on a
 * phone it folds down to the title, play/pause, and a thin progress line along the top.
 * hidden until something's been played; while it's up it pads the bottom of the page so
 * nothing ends up stuck underneath it.
 *
 * @param {object} props
 * @param {AudioPlayer} props.player - the shared player.
 * @returns {JSX.Element | null} the bar.
 */
export default function PlayerBar({ player }: { player: AudioPlayer }) {
  const { track } = player;
  const visible = track !== null;

  // the bar floats over the page, so pad the bottom of the page to keep the end of it reachable
  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.paddingBottom;
    document.body.style.paddingBottom = BAR_CLEARANCE;
    return () => {
      document.body.style.paddingBottom = previous;
    };
  }, [visible]);

  if (!track) return null;
  const progressPct = !track.live && player.durationS > 0 ? (player.currentTimeS / player.durationS) * 100 : 0;
  const canSeek = !track.live;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#120306]/95 pb-[env(safe-area-inset-bottom)] text-white shadow-[0_-8px_30px_rgba(0,0,0,0.5)] backdrop-blur">
      {/* phone-only progress line along the top edge */}
      <div className="h-0.5 bg-white/10 md:hidden" aria-hidden="true">
        <div className="h-full bg-red-500" style={{ width: `${track.live ? 100 : progressPct}%` }} />
      </div>

      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 md:grid md:grid-cols-[1fr_minmax(0,2fr)_1fr] md:gap-6 md:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-black/70 ring-1 ring-white/10">
            <Image src={ART_SRC} alt="" width={ART_WIDTH_PX} height={ART_HEIGHT_PX} className="pixelated w-10 h-auto" />
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate text-sm font-semibold">
              {player.playing && !player.loading && <EqBars active className="h-3 w-3 shrink-0 text-red-400" />}
              <span className="truncate">{track.title}</span>
            </p>
            <p className="truncate text-xs text-white/50">{track.subtitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1 md:min-w-0">
          <div className="flex items-center justify-center gap-4">
            {canSeek && (
              <button
                type="button"
                onClick={() => player.seekBy(-SKIP_BACK_S)}
                aria-label={`Back ${SKIP_BACK_S} seconds`}
                className="hidden text-white/70 transition hover:text-white md:block"
              >
                <SkipIcon direction="back" seconds={SKIP_BACK_S} />
              </button>
            )}
            <PlayPauseButton player={player} />
            {canSeek && (
              <button
                type="button"
                onClick={() => player.seekBy(SKIP_FORWARD_S)}
                aria-label={`Forward ${SKIP_FORWARD_S} seconds`}
                className="hidden text-white/70 transition hover:text-white md:block"
              >
                <SkipIcon direction="forward" seconds={SKIP_FORWARD_S} />
              </button>
            )}
          </div>
          <div className="hidden md:block">
            <Progress player={player} />
          </div>
        </div>

        <div className="hidden items-center justify-end gap-2 md:flex">
          <button
            type="button"
            onClick={player.toggleMute}
            aria-label={player.muted ? "Unmute" : "Mute"}
            className="text-white/70 transition hover:text-white"
          >
            {player.muted || player.volume === 0 ? <MutedIcon /> : <VolumeIcon />}
          </button>
          <SliderBar
            value={player.muted ? 0 : player.volume}
            max={1}
            step={VOLUME_STEP}
            onChange={player.setVolume}
            label="Volume"
            valueText={`${Math.round((player.muted ? 0 : player.volume) * 100)}%`}
            className="w-28"
          />
        </div>
      </div>

      {player.error && (
        <p className="border-t border-white/10 px-4 py-1.5 text-center text-xs text-red-300">{player.error}</p>
      )}
    </div>
  );
}
