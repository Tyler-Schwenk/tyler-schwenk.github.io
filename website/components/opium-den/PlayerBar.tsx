"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { AudioPlayer } from "@/lib/useAudioPlayer";
import EqBars from "./EqBars";
import { PlayerProgress, PlayPauseButton, SkipButton, VolumeControl } from "./PlayerControls";
import SetArt from "./SetArt";
import { ChevronIcon, CloseIcon } from "./playerIcons";

// a bit taller than the bar on either layout, plus the phone's home indicator
const BAR_CLEARANCE = "calc(6rem + env(safe-area-inset-bottom))";
// screen-height layouts (the live room, set pages) subtract this so the bar doesn't cover their bottom
const BAR_CLEARANCE_VAR = "--den-bar-clearance";

/**
 * the minimized player, pinned to the bottom of every page once something's playing,
 * like a streaming app: what's playing on the left, transport and progress in the middle,
 * volume and an x to close it on the right. the cover and title open the track's full
 * view (a set's waveform and chat, or the live room). on a phone it folds down to a mini
 * player (cover, title, play/pause, the x, a thin progress line along the top) and
 * tapping anywhere but the buttons opens the full view. closing stops the audio and the
 * bar goes until something's played again. while it's up it pads the bottom of the page
 * so nothing ends up stuck underneath it, and sets --den-bar-clearance on the body for layouts that are
 * exactly one screen tall.
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
    document.body.style.setProperty(BAR_CLEARANCE_VAR, BAR_CLEARANCE);
    return () => {
      document.body.style.paddingBottom = previous;
      document.body.style.removeProperty(BAR_CLEARANCE_VAR);
    };
  }, [visible]);

  if (!track) return null;
  const progressPct = !track.live && player.durationS > 0 ? (player.currentTimeS / player.durationS) * 100 : 0;
  const canSeek = !track.live;

  return (
    <div className="den-font fixed inset-x-0 bottom-0 z-[9998]border-t border-den-line bg-den-bg/90 pb-[env(safe-area-inset-bottom)] text-den-ink backdrop-blur-lg">
      {/* phone-only progress line along the top edge */}
      <div className="h-0.5 bg-white/[0.06] md:hidden" aria-hidden="true">
        <div className="h-full bg-den-accent" style={{ width: `${track.live ? 100 : progressPct}%` }} />
      </div>

      <div className="relative mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 md:grid md:grid-cols-[1fr_minmax(0,2fr)_1fr] md:gap-6 md:py-3">
        {/* phone-only: the whole mini player opens the full view, except play/pause which sits above this */}
        <Link href={track.href} aria-label={`Open ${track.title}`} className="absolute inset-0 md:hidden" />

        <Link
          href={track.href}
          className="group pointer-events-none flex min-w-0 flex-1 items-center gap-3 md:pointer-events-auto"
        >
          <SetArt src={track.artSrc} className="h-11 w-11 rounded" />
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-medium">
              {player.playing && !player.loading && <EqBars active className="h-3 w-3 shrink-0 text-den-accent" />}
              <span className="truncate transition-colors group-hover:text-den-accent-soft">{track.title}</span>
            </span>
            <span className="block truncate text-xs text-den-faint">{track.subtitle}</span>
          </span>
        </Link>

        <ChevronIcon direction="up" className="pointer-events-none h-5 w-5 shrink-0 text-den-faint md:hidden" />

        <div className="relative flex shrink-0 flex-col gap-1 md:min-w-0">
          <div className="flex items-center justify-center gap-4">
            {canSeek && (
              <div className="hidden md:block">
                <SkipButton player={player} direction="back" />
              </div>
            )}
            <PlayPauseButton player={player} />
            {canSeek && (
              <div className="hidden md:block">
                <SkipButton player={player} direction="forward" />
              </div>
            )}
          </div>
          <div className="hidden md:block">
            <PlayerProgress player={player} />
          </div>
        </div>

        {/* relative so the close button sits above the phone's open-the-full-view link */}
        <div className="relative flex shrink-0 items-center justify-end gap-4">
          <VolumeControl player={player} className="hidden md:flex" />
          <button
            type="button"
            onClick={player.stop}
            aria-label="Close the player"
            title="Close"
            className="-mr-1 p-1 text-den-faint transition-colors hover:text-den-ink"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {player.error && (
        <p className="border-t border-den-line px-4 py-1.5 text-center text-xs text-den-accent">{player.error}</p>
      )}
    </div>
  );
}
