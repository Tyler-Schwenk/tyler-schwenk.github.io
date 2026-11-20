"use client";

import { formatDuration } from "@/app/admin/format";
import { SKIP_BACK_S, SKIP_FORWARD_S, type AudioPlayer } from "@/lib/useAudioPlayer";
import { useScrub } from "@/lib/useScrub";
import SliderBar from "./SliderBar";
import { PauseIcon, PlayIcon, SkipIcon, SpinnerIcon } from "./playerIcons";

/**
 * the round white play/pause.
 *
 * @param {object} props
 * @param {AudioPlayer} props.player - the shared player.
 * @param {boolean} [props.large] - the big one in the phone's now-playing sheet.
 * @returns {JSX.Element | null} the button, or nothing before anything's loaded.
 */
export function PlayPauseButton({ player, large = false }: { player: AudioPlayer; large?: boolean }) {
  const { track, playing, loading } = player;
  if (!track) return null;
  const size = large ? "h-16 w-16" : "h-10 w-10";
  const iconSize = large ? "h-7 w-7" : "h-5 w-5";
  return (
    <button
      type="button"
      onClick={() => player.toggle(track)}
      aria-label={playing ? "Pause" : "Play"}
      className={`relative flex shrink-0 items-center justify-center rounded-full bg-den-ink text-den-bg transition hover:scale-105 active:scale-95 ${size}`}
    >
      {loading ? (
        <SpinnerIcon className={iconSize} />
      ) : playing ? (
        <PauseIcon className={iconSize} />
      ) : (
        <PlayIcon className={iconSize} />
      )}
    </button>
  );
}

/**
 * jumps back or forward a fixed amount.
 *
 * @param {object} props
 * @param {AudioPlayer} props.player - the shared player.
 * @param {"back" | "forward"} props.direction - which way.
 * @param {boolean} [props.large] - the touch-sized one.
 * @returns {JSX.Element} the button.
 */
export function SkipButton({
  player,
  direction,
  large = false,
}: {
  player: AudioPlayer;
  direction: "back" | "forward";
  large?: boolean;
}) {
  const seconds = direction === "back" ? SKIP_BACK_S : SKIP_FORWARD_S;
  const label = direction === "back" ? `Back ${seconds} seconds` : `Forward ${seconds} seconds`;
  // the phone version gets a padded hit area, since the icon alone is a small target
  const size = large ? "p-3" : "";
  return (
    <button
      type="button"
      onClick={() => player.seekBy(direction === "back" ? -seconds : seconds)}
      aria-label={label}
      className={`text-den-muted transition hover:text-den-ink active:scale-90 ${size}`}
    >
      <SkipIcon direction={direction} seconds={seconds} className={large ? "h-9 w-9" : "h-6 w-6"} />
    </button>
  );
}

/**
 * the seek bar with elapsed and total time, or a LIVE pill for the stream. dragging
 * shows where you'll land and seeks once on release.
 *
 * @param {object} props
 * @param {AudioPlayer} props.player - the shared player.
 * @param {boolean} [props.large] - the phone sheet's version: full-width bar, times underneath.
 * @returns {JSX.Element} the progress row.
 */
export function PlayerProgress({ player, large = false }: { player: AudioPlayer; large?: boolean }) {
  const scrub = useScrub(player.currentTimeS, player.seekTo);

  if (player.track?.live) {
    return (
      <div className="flex items-center justify-center gap-2 text-xs font-medium text-den-accent">
        <span className="h-1.5 w-1.5 rounded-full bg-den-accent" aria-hidden="true" />
        Live
      </div>
    );
  }

  const elapsed = formatDuration(scrub.value);
  const total = player.durationS > 0 ? formatDuration(player.durationS) : "--:--";
  const slider = (
    <SliderBar
      value={scrub.value}
      max={player.durationS}
      onChange={scrub.move}
      onRelease={scrub.release}
      label="Seek"
      valueText={`${elapsed} of ${total}`}
      large={large}
      className={large ? "w-full" : "flex-1"}
    />
  );

  if (large) {
    return (
      <div className="text-xs tabular-nums text-den-faint">
        {slider}
        <div className="flex justify-between">
          <span>{elapsed}</span>
          <span>{total}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[11px] tabular-nums text-den-faint">
      <span className="w-12 text-right">{elapsed}</span>
      {slider}
      <span className="w-12">{total}</span>
    </div>
  );
}
