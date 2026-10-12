"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TIMELAPSE_TIMESTAMPS } from "./timelapse-timestamps";
import {
  TIMELAPSE_CHAPTERS,
  TIMELAPSE_SPAN,
  formatClock,
  getAdjacentDayStart,
  getDateAtTime,
  getDayNumber,
  splitDateLabel,
} from "./timelapse-utils";

const FRAME_DURATION_S = 1 / 30;
const PLAYBACK_SPEEDS = [0.5, 1, 2, 3, 4];
const DEFAULT_PLAYBACK_SPEED = 1;
const PERCENT = 100;
// month labels closer than this (as % of the ruler) would overlap on a phone,
// so the earlier one gets dropped
const MIN_MONTH_LABEL_GAP_PCT = 8;
// past this point a month label would run off the right edge, so it hangs left of its tick instead
const RIGHT_ALIGN_LABEL_PCT = 92;

// shared look for every cell in the control strip
const CELL_CLASS =
  "flex h-11 items-center justify-center whitespace-nowrap px-3 text-xs transition-colors focus-visible:relative focus-visible:outline-2 focus-visible:outline-[var(--g-tomato)]";
const PLAIN_CELL_CLASS = `${CELL_CLASS} bg-[var(--g-paper)] text-[var(--g-ink)] hover:bg-[var(--g-paper-raised)]`;

/**
 * Picks which month-start ticks get a text label on the ruler. Walks from the
 * end so the later month wins when two are too close (the early months hold
 * just a couple of before-photos, so they're the ones worth dropping).
 *
 * @param {number} duration - Video duration in seconds.
 * @returns {Set<number>} startSeconds of the chapters that should be labeled.
 */
function pickLabeledMonths(duration: number): Set<number> {
  const labeled = new Set<number>();
  if (!duration) return labeled;
  let nextLabeledPct = Infinity;
  for (let i = TIMELAPSE_CHAPTERS.length - 1; i >= 0; i--) {
    const pct = (TIMELAPSE_CHAPTERS[i].startSeconds / duration) * PERCENT;
    if (nextLabeledPct - pct < MIN_MONTH_LABEL_GAP_PCT) continue;
    labeled.add(TIMELAPSE_CHAPTERS[i].startSeconds);
    nextLabeledPct = pct;
  }
  return labeled;
}

const MONTH_STARTS = new Set(TIMELAPSE_CHAPTERS.map((chapter) => chapter.startSeconds));

interface TimelapsePlayerProps {
  src: string;
  poster?: string;
}

/**
 * Garden timelapse player. The scrubber is a ruler with one tick per filmed day
 * (longer ticks and labels at each new month), with the date under the cursor
 * shown while hovering or dragging. Below it, the date on screen is set large
 * next to a strip of play / speed / fullscreen / day / frame controls.
 * Keyboard: space or k plays, arrows step a frame, shift+arrows jump a day,
 * f toggles fullscreen.
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
  const { monthDay, year } = splitDateLabel(currentDate);
  const toPct = (seconds: number) => (duration ? (seconds / duration) * PERCENT : 0);
  const labeledMonths = pickLabeledMonths(duration);

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
   * Converts a pointer x-coordinate over the ruler into a video time.
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
    if (!duration) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isScrubbing.current = true;
    const time = timeFromClientX(e.clientX);
    setHoverTime(time);
    seekTo(time);
  };

  const handleTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    const time = timeFromClientX(e.clientX);
    setHoverTime(time);
    if (isScrubbing.current) seekTo(time);
  };

  const handleTrackPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    isScrubbing.current = false;
    // touch has no hover, so don't leave the date bubble stuck on screen
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
  const playLabel = isEnded ? "Replay" : isPlaying ? "Pause" : "Play";

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Garden timelapse player"
      className={`outline-none focus-visible:outline-1 focus-visible:outline-offset-8 focus-visible:outline-[var(--g-ink-faint)] ${
        isFullscreen ? "flex h-full w-full flex-col bg-[var(--g-paper)] p-4 sm:p-6" : ""
      }`}
    >
      {/* video */}
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
      </div>

      {/* ruler scrubber */}
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
        className="garden-mono relative mt-3 h-12 shrink-0 cursor-ew-resize touch-none select-none"
      >
        <span className="absolute inset-x-0 top-0 h-px bg-[var(--g-rule)]" />
        <span className="absolute left-0 top-0 h-0.5 bg-[var(--g-ink)]" style={{ width: `${toPct(currentTime)}%` }} />

        {duration > 0 && TIMELAPSE_TIMESTAMPS.map((entry) => (
          <span
            key={entry.startSeconds}
            className={`absolute top-0 w-px ${MONTH_STARTS.has(entry.startSeconds) ? "h-5" : "h-2.5"} ${
              entry.startSeconds <= currentTime ? "bg-[var(--g-ink)]" : "bg-[var(--g-ink-faint)]"
            }`}
            style={{ left: `${toPct(entry.startSeconds)}%` }}
          />
        ))}

        {TIMELAPSE_CHAPTERS.filter((chapter) => labeledMonths.has(chapter.startSeconds)).map((chapter) => {
          const pct = toPct(chapter.startSeconds);
          return (
            <span
              key={chapter.startSeconds}
              className={`pointer-events-none absolute top-6 text-[10px] uppercase tracking-wider text-[var(--g-ink-soft)] ${
                pct > RIGHT_ALIGN_LABEL_PCT ? "-translate-x-full pr-1" : "pl-1"
              }`}
              style={{ left: `${pct}%` }}
            >
              {chapter.label}
            </span>
          );
        })}

        {/* playhead */}
        {duration > 0 && (
          <span
            className="pointer-events-none absolute -top-1.5 bottom-3 w-0.5 -translate-x-1/2 bg-[var(--g-tomato)]"
            style={{ left: `${toPct(currentTime)}%` }}
          >
            <span className="absolute -left-[3px] top-0 h-2 w-2 bg-[var(--g-tomato)]" />
          </span>
        )}

        {/* date under the cursor */}
        {hoverTime !== null && hoverDate !== null && (
          <>
            <span
              className="pointer-events-none absolute inset-y-0 border-l border-dashed border-[var(--g-ink-faint)]"
              style={{ left: `${toPct(hoverTime)}%` }}
            />
            <span
              className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 whitespace-nowrap bg-[var(--g-ink)] px-2 py-1 text-[11px] text-[var(--g-on-ink)]"
              style={{ left: `clamp(4.5rem, ${toPct(hoverTime)}%, calc(100% - 4.5rem))` }}
            >
              {hoverDate}{hoverDay !== null && ` · day ${hoverDay}`}
            </span>
          </>
        )}
      </div>

      {/* readout + controls */}
      <div className="mt-3 flex shrink-0 flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="garden-display text-6xl leading-none md:text-7xl">{monthDay}</div>
          <div className="garden-mono mt-2 text-xs text-[var(--g-ink-soft)]">
            {year}
            {currentDay !== null && ` · day ${currentDay} of ${TIMELAPSE_SPAN.totalDays}`}
            {` · ${formatClock(currentTime)} / ${formatClock(duration)}`}
          </div>
        </div>

        <div className="garden-mono grid grid-cols-4 gap-px border border-[var(--g-rule)] bg-[var(--g-rule)] md:flex">
          <button
            type="button"
            onClick={togglePlay}
            className={`${CELL_CLASS} col-span-2 bg-[var(--g-ink)] font-medium text-[var(--g-on-ink)] hover:bg-[var(--g-tomato)] md:w-24`}
          >
            {playLabel}
          </button>
          <button
            type="button"
            onClick={cyclePlaybackRate}
            aria-label={`Playback speed ${playbackRate}x, click to change`}
            className={`${PLAIN_CELL_CLASS} md:order-3`}
          >
            {playbackRate}&times;
          </button>
          <button type="button" onClick={toggleFullscreen} className={`${PLAIN_CELL_CLASS} md:order-3`}>
            {isFullscreen ? "Exit" : "Full screen"}
          </button>
          <button type="button" onClick={() => stepDay(-1)} aria-label="Previous day" className={`${PLAIN_CELL_CLASS} md:order-2`}>
            &larr; Day
          </button>
          <button type="button" onClick={() => stepFrame(-1)} aria-label="Previous frame" className={`${PLAIN_CELL_CLASS} md:order-2`}>
            &larr; Frame
          </button>
          <button type="button" onClick={() => stepFrame(1)} aria-label="Next frame" className={`${PLAIN_CELL_CLASS} md:order-2`}>
            Frame &rarr;
          </button>
          <button type="button" onClick={() => stepDay(1)} aria-label="Next day" className={`${PLAIN_CELL_CLASS} md:order-2`}>
            Day &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
