"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type TouchEvent } from "react";
import type { AudioPlayer } from "@/lib/useAudioPlayer";
import EqBars from "./EqBars";
import { PlayerProgress, PlayPauseButton, SkipButton } from "./PlayerControls";
import { ChevronIcon } from "./playerIcons";

const ART_SRC = "/images/8bit/dj_board.png";
const ART_WIDTH_PX = 112;
const ART_HEIGHT_PX = 52;
// pull the sheet down this far and let go to close it
const SWIPE_CLOSE_PX = 100;
// tailwind's md breakpoint, where the full desktop bar takes over and the sheet isn't needed
const DESKTOP_QUERY = "(min-width: 48rem)";

/**
 * tracks a downward swipe on the sheet so it follows the finger and closes past a
 * threshold. swipes that start on the seek bar are left alone so scrubbing still works.
 *
 * @param {() => void} onClose - called when the swipe goes far enough.
 * @returns {object} the current drag offset in px (null when not dragging) and touch handlers.
 */
function useSwipeDown(onClose: () => void) {
  const startYRef = useRef<number | null>(null);
  const [offsetPx, setOffsetPx] = useState<number | null>(null);

  const onTouchStart = (event: TouchEvent) => {
    if ((event.target as Element).closest("input")) return;
    startYRef.current = event.touches[0].clientY;
  };
  const onTouchMove = (event: TouchEvent) => {
    if (startYRef.current === null) return;
    setOffsetPx(Math.max(0, event.touches[0].clientY - startYRef.current));
  };
  const onTouchEnd = () => {
    if (startYRef.current === null) return;
    startYRef.current = null;
    if ((offsetPx ?? 0) > SWIPE_CLOSE_PX) onClose();
    setOffsetPx(null);
  };

  return { offsetPx, handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd } };
}

/**
 * the phone's full-screen now-playing view, opened by tapping the mini bar, like spotify
 * or apple music: big art, the title, a full-width seek bar, and back / play / forward.
 * slides up from the bottom; closes with the chevron, escape, or a swipe down. while
 * it's open the page behind it doesn't scroll. phones only, the desktop bar already has
 * everything.
 *
 * @param {object} props
 * @param {AudioPlayer} props.player - the shared player.
 * @param {boolean} props.open - whether it's up.
 * @param {() => void} props.onClose - closes it.
 * @returns {JSX.Element | null} the sheet, or nothing before anything's been played.
 */
export default function NowPlayingSheet({
  player,
  open,
  onClose,
}: {
  player: AudioPlayer;
  open: boolean;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const { offsetPx, handlers } = useSwipeDown(onClose);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    // the sheet's hidden on wider screens, so don't leave the page scroll-locked behind it
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const onResize = () => {
      if (desktop.matches) onClose();
    };
    window.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onResize);
    };
  }, [open, onClose]);

  const { track } = player;
  if (!track) return null;

  const dragging = offsetPx !== null;
  const transform = !open ? "translateY(100%)" : dragging ? `translateY(${offsetPx}px)` : "translateY(0)";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
      inert={!open}
      style={{ transform }}
      // z-[10000] clears the floating home button (z-[9999] in Navigation), like the kiln viewer
      className={`fixed inset-0 z-[10000] flex flex-col bg-den-bg px-6 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] text-den-ink md:hidden ${
        open ? "visible" : "invisible"
      } ${dragging ? "transition-none" : "transition-[transform,visibility] duration-300 ease-out"}`}
      {...handlers}
    >
      <div className="flex items-center justify-between">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close player"
          className="-ml-2 p-2 text-den-muted transition hover:text-den-ink"
        >
          <ChevronIcon direction="down" className="h-7 w-7" />
        </button>
        <p className="text-xs font-medium text-den-muted">Now playing</p>
        {/* balances the chevron so the label sits in the middle */}
        <span className="w-11" aria-hidden="true" />
      </div>

      <div className="flex flex-1 items-center justify-center py-6">
        <div className="flex aspect-square w-full max-w-xs items-center justify-center rounded-lg bg-white/[0.04]">
          <Image
            src={ART_SRC}
            alt=""
            width={ART_WIDTH_PX}
            height={ART_HEIGHT_PX}
            className="pixelated h-auto w-3/4"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-semibold">{track.title}</p>
          <p className="mt-0.5 truncate text-sm text-den-muted">{track.subtitle}</p>
        </div>
        {player.playing && !player.loading && <EqBars active className="h-4 w-4 shrink-0 text-den-accent" />}
      </div>

      <div className="mt-5">
        <PlayerProgress player={player} large />
      </div>

      <div className="mt-6 flex items-center justify-center gap-10">
        {!track.live && <SkipButton player={player} direction="back" large />}
        <PlayPauseButton player={player} large />
        {!track.live && <SkipButton player={player} direction="forward" large />}
      </div>

      {player.error && <p className="mt-4 text-center text-xs text-den-accent">{player.error}</p>}
    </div>
  );
}
