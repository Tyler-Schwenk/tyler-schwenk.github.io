"use client";

import { formatDuration } from "@/app/admin/format";
import { SKIP_BACK_S, SKIP_FORWARD_S, type AudioPlayer } from "@/lib/useAudioPlayer";
import { useScrub } from "@/lib/useScrub";
import SliderBar from "./SliderBar";
import { MutedIcon, PauseIcon, PlayIcon, SkipIcon, SpinnerIcon, VolumeIcon } from "./playerIcons";

const VOLUME_STEP = 0.01;

/**
 * the round white play/pause.
 *
 * @param {object} props
 * @param {AudioPlayer} props.player - the shared player.
 * @returns {JSX.Element | null} the button, or nothing before anything's loaded.
 */
export function PlayPauseButton({ player }: { player: AudioPlayer }) {
  const { track, playing, loading } = player;
  if (!track) return null;
  return (
    <button
      type="button"
      onClick={() => player.toggle(track)}
      aria-label={playing ? "Pause" : "Play"}
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-den-accent text-white transition hover:scale-105 hover:brightness-110 active:scale-95"
    >
      {loading ? <SpinnerIcon /> : playing ? <PauseIcon /> : <PlayIcon />}
    </button>
  );
}

/**
 * jumps back or forward a fixed amount.
 *
 * @param {object} props
 * @param {AudioPlayer} props.player - the shared player.
 * @param {"back" | "forward"} props.direction - which way.
 * @param {string} [props.className] - extra classes, like padding for a bigger touch target.
 * @returns {JSX.Element} the button.
 */
export function SkipButton({
  player,
  direction,
  className = "",
}: {
  player: AudioPlayer;
  direction: "back" | "forward";
  className?: string;
}) {
  const seconds = direction === "back" ? SKIP_BACK_S : SKIP_FORWARD_S;
  const label = direction === "back" ? `Back ${seconds} seconds` : `Forward ${seconds} seconds`;
  return (
    <button
      type="button"
      onClick={() => player.seekBy(direction === "back" ? -seconds : seconds)}
      aria-label={label}
      className={`text-den-muted transition hover:text-den-ink active:scale-90 ${className}`}
    >
      <SkipIcon direction={direction} seconds={seconds} className="h-6 w-6" />
    </button>
  );
}

/**
 * the seek bar with elapsed and total time, or a LIVE pill for the stream. dragging
 * shows where you'll land and seeks once on release.
 *
 * @param {object} props
 * @param {AudioPlayer} props.player - the shared player.
 * @returns {JSX.Element} the progress row.
 */
export function PlayerProgress({ player }: { player: AudioPlayer }) {
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
  return (
    <div className="flex items-center gap-2 text-[11px] tabular-nums text-den-faint">
      <span className="w-12 text-right">{elapsed}</span>
      <SliderBar
        value={scrub.value}
        max={player.durationS}
        onChange={scrub.move}
        onRelease={scrub.release}
        label="Seek"
        valueText={`${elapsed} of ${total}`}
        className="flex-1"
      />
      <span className="w-12">{total}</span>
    </div>
  );
}

/**
 * mute and a volume slider. desktop only in practice: phones ignore a page's volume and
 * use their own buttons.
 *
 * @param {object} props
 * @param {AudioPlayer} props.player - the shared player.
 * @param {string} [props.className] - layout classes, like hiding it on phones.
 * @returns {JSX.Element} the control.
 */
export function VolumeControl({ player, className = "" }: { player: AudioPlayer; className?: string }) {
  const shown = player.muted ? 0 : player.volume;
  return (
    <div className={`items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={player.toggleMute}
        aria-label={player.muted ? "Unmute" : "Mute"}
        className="text-den-muted transition hover:text-den-ink"
      >
        {shown === 0 ? <MutedIcon /> : <VolumeIcon />}
      </button>
      <SliderBar
        value={shown}
        max={1}
        step={VOLUME_STEP}
        onChange={player.setVolume}
        label="Volume"
        valueText={`${Math.round(shown * 100)}%`}
        className="w-28"
      />
    </div>
  );
}
