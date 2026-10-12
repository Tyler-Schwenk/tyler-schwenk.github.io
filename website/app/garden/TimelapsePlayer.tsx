"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  TIMELAPSE_CHAPTERS,
  formatClock,
  getAdjacentDayStart,
  getChapterIndexAtTime,
  getDateAtTime,
  getDayNumber,
} from "./timelapse-utils";

const FRAME_DURATION_S = 1 / 30;
const PLAYBACK_SPEEDS = [0.5, 1, 2, 3, 4];
const DEFAULT_PLAYBACK_SPEED = 1;
const PERCENT = 100;

type IconName = "play" | "pause" | "replay" | "prevDay" | "nextDay" | "prevFrame" | "nextFrame" | "expand" | "collapse";

// 24x24 stroke paths, drawn in the same style as the rest of the controls
const ICON_PATHS: Record<IconName, string[]> = {
  play: ["M7 4.5v15l12-7.5z"],
  pause: ["M7 4.5h3.5v15H7z", "M13.5 4.5H17v15h-3.5z"],
  replay: ["M3 12a9 9 0 1 0 3-6.7", "M3 4v5h5"],
  prevDay: ["M6 5v14", "M18 5l-9 7 9 7z"],
  nextDay: ["M18 5v14", "M6 5l9 7-9 7z"],
  prevFrame: ["M15 6l-6 6 6 6"],
  nextFrame: ["M9 6l6 6-6 6"],
  expand: ["M15 3h6v6", "M9 21H3v-6", "M21 3l-7 7", "M3 21l7-7"],
  collapse: ["M4 14h6v6", "M20 10h-6V4", "M14 10l7-7", "M3 21l7-7"],
};
const FILLED_ICONS: IconName[] = ["play", "pause", "prevDay", "nextDay"];

/**
 * Small inline SVG icon for the player controls.
 *
 * @param {object} props - Component props.
 * @param {IconName} props.name - Which icon to draw.
 * @param {string} [props.className] - Extra classes, mostly for sizing.
 * @returns {JSX.Element} The icon.
 */
function PlayerIcon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  const filled = FILLED_ICONS.includes(name);
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 1 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

interface ControlButtonProps {
  icon: IconName;
  label: string;
  onClick: () => void;
  className?: string;
}

/**
 * Square icon button used in the control bar.
 *
 * @param {ControlButtonProps} props - Icon, accessible label, click handler, extra classes.
 * @returns {JSX.Element} The button.
 */
function ControlButton({ icon, label, onClick, className = "" }: ControlButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--g-player-text)] transition-colors hover:bg-[var(--g-player-raised)] focus-visible:outline-2 focus-visible:outline-[var(--g-player-accent)] ${className}`}
    >
      <PlayerIcon name={icon} />
    </button>
  );
}

interface TimelapsePlayerProps {
  src: string;
  poster?: string;
}

/**
 * Garden timelapse player. Shows the calendar date of the frame on screen as a
 * plant-tag overlay, a scrubber with month chapters and a hover date preview,
 * day/frame stepping, speed control, and fullscreen. Keyboard: space/k plays,
 * arrows step a frame, shift+arrows jump a day, f toggles fullscreen.
 *
 * @param {TimelapsePlayerProps} props - Component props.
 * @param {string} props.src - Video stream URL.
 * @param {string} [props.poster] - Optional poster image shown before playback.
 * @returns {JSX.Element} The player.
 */
export default function TimelapsePlayer({ src, poster }: TimelapsePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const isScrubbing = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(DEFAULT_PLAYBACK_SPEED);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const currentDate = getDateAtTime(currentTime);
  const currentDay = getDayNumber(currentDate);
  const activeChapter = getChapterIndexAtTime(currentTime);
  const progressPct = duration ? (currentTime / duration) * PERCENT : 0;

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, []);

  // timeupdate only fires ~4x a second, which skips right past the short early
  // days — poll every animation frame while playing so the date never lags
  useEffect(() => {
    if (!isPlaying) return;
    let frameId = 0;
    const tick = () => {
      const video = videoRef.current;
      if (video && !isScrubbing.current) setCurrentTime(video.currentTime);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying]);

  // playbackRate is a property on the video element, not an attribute, so it's applied via ref
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = playbackRate;
  }, [playbackRate]);

  const seekTo = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const clamped = Math.max(0, Math.min(video.duration, seconds));
    video.currentTime = clamped;
    setCurrentTime(clamped);
    if (clamped < video.duration) setIsEnded(false);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isEnded) {
      video.currentTime = 0;
      setIsEnded(false);
    }
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }, [isEnded]);

  const stepFrame = useCallback((direction: 1 | -1) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    seekTo(video.currentTime + direction * FRAME_DURATION_S);
  }, [seekTo]);

  const stepDay = useCallback((direction: 1 | -1) => {
    const video = videoRef.current;
    if (!video) return;
    const target = getAdjacentDayStart(video.currentTime, direction);
    if (target !== null) seekTo(target);
  }, [seekTo]);

  const cyclePlaybackRate = useCallback(() => {
    const nextIndex = (PLAYBACK_SPEEDS.indexOf(playbackRate) + 1) % PLAYBACK_SPEEDS.length;
    setPlaybackRate(PLAYBACK_SPEEDS[nextIndex]);
  }, [playbackRate]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!container || !video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (container.requestFullscreen) {
      container.requestFullscreen();
    } else if (video.webkitEnterFullscreen) {
      // iOS Safari only supports fullscreen on the video element itself
      video.webkitEnterFullscreen();
    }
  }, []);

  /**
   * Converts a pointer x-coordinate over the scrubber into a video time.
   *
   * @param {number} clientX - Pointer x in viewport pixels.
   * @returns {number} Corresponding playback time in seconds (0 if not ready).
   */
  const timeFromClientX = (clientX: number): number => {
    const track = trackRef.current;
    if (!track || !duration) return 0;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isScrubbing.current = true;
    seekTo(timeFromClientX(e.clientX));
  };

  const handleTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    const time = timeFromClientX(e.clientX);
    setHoverTime(time);
    if (isScrubbing.current) seekTo(time);
  };

  const handleTrackPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    isScrubbing.current = false;
    // touch has no hover, so don't leave the preview bubble stuck on screen
    if (e.pointerType !== "mouse") setHoverTime(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const key = e.key.toLowerCase();
    // let focused buttons handle their own space/enter
    if (key === " " && e.target instanceof HTMLButtonElement) return;
    if (key === " " || key === "k") {
      e.preventDefault();
      togglePlay();
    } else if (key === "arrowleft" || key === "arrowright") {
      e.preventDefault();
      const direction = key === "arrowright" ? 1 : -1;
      if (e.shiftKey) {
        stepDay(direction);
      } else {
        stepFrame(direction);
      }
    } else if (key === "f") {
      e.preventDefault();
      toggleFullscreen();
    }
  };

  const hoverDate = hoverTime === null ? null : getDateAtTime(hoverTime);
  const hoverDay = hoverDate === null ? null : getDayNumber(hoverDate);
  const hoverPct = hoverTime === null || !duration ? 0 : (hoverTime / duration) * PERCENT;
  const playLabel = isEnded ? "Replay" : isPlaying ? "Pause" : "Play";

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Garden timelapse player"
      className={`group/player flex flex-col overflow-hidden bg-[var(--g-player-bg)] text-[var(--g-player-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-leaf)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--g-paper)] ${
        isFullscreen ? "h-full w-full" : "rounded-2xl shadow-[var(--g-shadow)]"
      }`}
    >
      {/* video stage */}
      <div
        className={`relative cursor-pointer bg-black ${isFullscreen ? "min-h-0 flex-1" : "aspect-video"}`}
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          preload="metadata"
          playsInline
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
          onSeeked={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={(e) => {
            setCurrentTime(e.currentTarget.duration);
            setIsPlaying(false);
            setIsEnded(true);
          }}
          className="absolute inset-0 h-full w-full object-contain"
        >
          Your browser does not support the video tag.
        </video>

        {/* plant-tag date label */}
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-3 rounded-lg bg-[var(--g-tag-bg)] py-2 pl-3 pr-4 text-[var(--g-tag-ink)] shadow-lg sm:left-5 sm:top-5 sm:py-2.5">
          <span className="h-2 w-2 rounded-full border border-[var(--g-tag-ink)]/40" aria-hidden="true" />
          <div className="leading-tight">
            {currentDay !== null && (
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-60">
                Day {currentDay}
              </div>
            )}
            <div className="garden-serif text-base sm:text-xl">
              {currentDate}
            </div>
          </div>
        </div>

        {/* big centered play button whenever we're not playing */}
        {!isPlaying && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--g-tag-bg)]/95 text-[var(--g-tag-ink)] shadow-xl transition-transform group-hover/player:scale-105 sm:h-20 sm:w-20">
              <PlayerIcon name={isEnded ? "replay" : "play"} className={isEnded ? "h-7 w-7" : "ml-1 h-7 w-7 sm:h-8 sm:w-8"} />
            </span>
          </div>
        )}
      </div>

      {/* controls */}
      <div className="shrink-0 px-3 pb-3 pt-4 sm:px-5 sm:pb-4">
        {/* scrubber */}
        <div
          ref={trackRef}
          role="slider"
          aria-label="Timelapse position"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={currentDate}
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handleTrackPointerMove}
          onPointerUp={handleTrackPointerUp}
          onPointerCancel={handleTrackPointerUp}
          onPointerLeave={() => !isScrubbing.current && setHoverTime(null)}
          className="group/track relative cursor-pointer touch-none py-2"
        >
          {hoverDate !== null && (
            <div
              className="pointer-events-none absolute bottom-full mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--g-tag-bg)] px-2.5 py-1 text-center text-[var(--g-tag-ink)] shadow-lg"
              style={{ left: `clamp(3rem, ${hoverPct}%, calc(100% - 3rem))` }}
            >
              <div className="garden-serif text-sm">{hoverDate}</div>
              {hoverDay !== null && (
                <div className="text-[10px] uppercase tracking-[0.15em] opacity-60">Day {hoverDay}</div>
              )}
            </div>
          )}

          <div className="relative h-1.5 rounded-full bg-[var(--g-player-track)] transition-[height] group-hover/track:h-2">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[var(--g-player-accent)]"
              style={{ width: `${progressPct}%` }}
            />
            {/* chapter dividers — notches cut into the track at each new month */}
            {duration > 0 && TIMELAPSE_CHAPTERS.slice(1).map((chapter) => (
              <span
                key={chapter.startSeconds}
                className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-[var(--g-player-bg)]"
                style={{ left: `${(chapter.startSeconds / duration) * PERCENT}%` }}
              />
            ))}
            <span
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--g-player-text)] shadow ring-4 ring-[var(--g-player-accent)]/25"
              style={{ left: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* buttons row */}
        <div className="mt-2 flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playLabel}
            title={playLabel}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--g-player-accent)] text-[var(--g-player-bg)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-player-accent)]"
          >
            <PlayerIcon name={isEnded ? "replay" : isPlaying ? "pause" : "play"} className="h-4 w-4" />
          </button>
          <ControlButton icon="prevDay" label="Previous day (shift + left)" onClick={() => stepDay(-1)} />
          <ControlButton icon="prevFrame" label="Previous frame (left)" onClick={() => stepFrame(-1)} />
          <ControlButton icon="nextFrame" label="Next frame (right)" onClick={() => stepFrame(1)} />
          <ControlButton icon="nextDay" label="Next day (shift + right)" onClick={() => stepDay(1)} />

          <span className="ml-2 hidden text-xs tabular-nums text-[var(--g-player-muted)] sm:inline">
            {formatClock(currentTime)} / {formatClock(duration)}
          </span>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={cyclePlaybackRate}
              aria-label={`Playback speed ${playbackRate}x, click to change`}
              title="Playback speed"
              className="h-8 min-w-12 rounded-full border border-[var(--g-player-track)] px-2.5 text-xs font-semibold tabular-nums text-[var(--g-player-text)] transition-colors hover:border-[var(--g-player-accent)] focus-visible:outline-2 focus-visible:outline-[var(--g-player-accent)]"
            >
              {playbackRate}&times;
            </button>
            <ControlButton
              icon={isFullscreen ? "collapse" : "expand"}
              label={isFullscreen ? "Exit fullscreen (f)" : "Fullscreen (f)"}
              onClick={toggleFullscreen}
            />
          </div>
        </div>

        {/* month chapters */}
        {TIMELAPSE_CHAPTERS.length > 1 && (
          <div className="mt-3 flex items-center gap-2 overflow-x-auto border-t border-[var(--g-player-raised)] pt-3">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--g-player-muted)]">
              Jump to
            </span>
            {TIMELAPSE_CHAPTERS.map((chapter, i) => (
              <button
                key={chapter.startSeconds}
                type="button"
                onClick={() => seekTo(chapter.startSeconds)}
                aria-current={i === activeChapter ? "true" : undefined}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--g-player-accent)] ${
                  i === activeChapter
                    ? "bg-[var(--g-player-accent)] text-[var(--g-player-bg)]"
                    : "bg-[var(--g-player-raised)] text-[var(--g-player-muted)] hover:text-[var(--g-player-text)]"
                }`}
              >
                {chapter.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
