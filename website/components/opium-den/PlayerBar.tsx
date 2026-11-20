"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { AudioPlayer } from "@/lib/useAudioPlayer";
import EqBars from "./EqBars";
import NowPlayingSheet from "./NowPlayingSheet";
import { PlayerProgress, PlayPauseButton, SkipButton, VolumeControl } from "./PlayerControls";
import { ChevronIcon } from "./playerIcons";

const ART_SRC = "/images/8bit/dj_board.png";
const ART_WIDTH_PX = 112;
const ART_HEIGHT_PX = 52;
// a bit taller than the bar on either layout, plus the phone's home indicator
const BAR_CLEARANCE = "calc(6rem + env(safe-area-inset-bottom))";
// screen-height layouts (the live room) subtract this so the bar doesn't cover their bottom
const BAR_CLEARANCE_VAR = "--den-bar-clearance";

/**
 * the now-playing bar pinned to the bottom of the screen, like a streaming app: what's
 * playing on the left, transport and progress in the middle, volume on the right. on a
 * phone it folds down to a mini player (title, play/pause, a thin progress line along the
 * top), and tapping anywhere else on it opens the full now-playing sheet with seeking and
 * skips. hidden until something's been played; while it's up it pads the bottom of the
 * page so nothing ends up stuck underneath it, and sets --den-bar-clearance on the body
 * for layouts that are exactly one screen tall.
 *
 * @param {object} props
 * @param {AudioPlayer} props.player - the shared player.
 * @returns {JSX.Element | null} the bar.
 */
export default function PlayerBar({ player }: { player: AudioPlayer }) {
  const { track } = player;
  const visible = track !== null;
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

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
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-den-line bg-den-bg/90 pb-[env(safe-area-inset-bottom)] text-den-ink backdrop-blur-lg">
        {/* phone-only progress line along the top edge */}
        <div className="h-0.5 bg-white/[0.06] md:hidden" aria-hidden="true">
          <div className="h-full bg-den-accent" style={{ width: `${track.live ? 100 : progressPct}%` }} />
        </div>

        <div className="relative mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 md:grid md:grid-cols-[1fr_minmax(0,2fr)_1fr] md:gap-6 md:py-3">
          {/* phone-only: the whole mini player opens the sheet, except play/pause which sits above this */}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Open player"
            aria-haspopup="dialog"
            className="absolute inset-0 md:hidden"
          />

          <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-3 md:pointer-events-auto">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-white/[0.04]">
              <Image src={ART_SRC} alt="" width={ART_WIDTH_PX} height={ART_HEIGHT_PX} className="pixelated h-auto w-9" />
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate text-sm font-medium">
                {player.playing && !player.loading && <EqBars active className="h-3 w-3 shrink-0 text-den-accent" />}
                <span className="truncate">{track.title}</span>
              </p>
              <p className="truncate text-xs text-den-faint">{track.subtitle}</p>
            </div>
          </div>

          <ChevronIcon direction="up" className="pointer-events-none h-5 w-5 shrink-0 text-den-faint md:hidden" />

          <div className="flex shrink-0 flex-col gap-1 md:min-w-0">
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

          <VolumeControl player={player} className="hidden justify-end md:flex" />
        </div>

        {player.error && (
          <p className="border-t border-den-line px-4 py-1.5 text-center text-xs text-den-accent">{player.error}</p>
        )}
      </div>

      <NowPlayingSheet player={player} open={sheetOpen} onClose={closeSheet} />
    </>
  );
}
