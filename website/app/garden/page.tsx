"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import PageWrapper from "@/components/PageWrapper";
import { TIMELAPSE_TIMESTAMPS } from "./timelapse-timestamps";

const API_BASE = "https://api.tyler-schwenk.com";
const TIMELAPSE_SLUG = "garden-timelapse";
const FRAME_DURATION_S = 1 / 30;
const PLAYBACK_SPEEDS = [0.5, 1, 2, 3, 4];

interface VideoMeta {
  id: number;
  title: string;
}

/**
 * Returns the date label for the given playback position.
 * Walks the sorted timestamps and returns the last entry whose startSeconds
 * is <= currentSeconds — so we always show the most recent date.
 *
 * @param {number} currentSeconds - Current video playback position in seconds.
 * @returns {string} Formatted date label, e.g. "Apr 13, 2026".
 */
function getDateAtTime(currentSeconds: number): string {
  let label = TIMELAPSE_TIMESTAMPS[0]?.date ?? "";
  for (const entry of TIMELAPSE_TIMESTAMPS) {
    if (entry.startSeconds <= currentSeconds) {
      label = entry.date;
    } else {
      break;
    }
  }
  return label;
}

/**
 * The garden page — shows a timelapse of the garden with a live date indicator,
 * plus a section of gardening inspiration links.
 *
 * @returns {JSX.Element} The garden page layout.
 */
export default function GardenPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrubbing = useRef(false);
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoNotFound, setVideoNotFound] = useState(false);
  const [currentDate, setCurrentDate] = useState(TIMELAPSE_TIMESTAMPS[0]?.date ?? "");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // fetch the video ID by slug on mount — slug is stable, numeric ID is not
  useEffect(() => {
    fetch(`${API_BASE}/videos/slug/${TIMELAPSE_SLUG}`)
      .then((res) => {
        if (!res.ok) {
          setVideoNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setVideoMeta({ id: data.id, title: data.title });
      })
      .catch(() => setVideoNotFound(true));
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, []);

  const handleTimeUpdate = useCallback(() => {
    // skip while the user is dragging — they own the slider position
    if (isScrubbing.current) return;
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress((video.currentTime / video.duration) * 100);
    setCurrentDate(getDateAtTime(video.currentTime));
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setIsEnded(true);
  }, []);

  // playbackRate is a property on the video element, not an HTML attribute, so it's applied via ref
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = playbackRate;
  }, [playbackRate]);

  const cyclePlaybackRate = useCallback(() => {
    const nextIndex = (PLAYBACK_SPEEDS.indexOf(playbackRate) + 1) % PLAYBACK_SPEEDS.length;
    setPlaybackRate(PLAYBACK_SPEEDS[nextIndex]);
  }, [playbackRate]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (container.requestFullscreen) {
      container.requestFullscreen();
    } else if ((video as HTMLVideoElement & { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen) {
      // iOS Safari only supports fullscreen on the video element itself
      (video as HTMLVideoElement & { webkitEnterFullscreen: () => void }).webkitEnterFullscreen();
    }
  }, []);

  // play/pause toggle — also handles replay from ended state
  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isEnded) {
      video.currentTime = 0;
      video.play();
      setIsEnded(false);
      return;
    }
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }, [isEnded]);

  const handleScrubStart = useCallback(() => {
    isScrubbing.current = true;
  }, []);

  const handleScrubEnd = useCallback(() => {
    isScrubbing.current = false;
  }, []);

  // scrubbing: seek the video and update date + progress immediately
  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const pct = parseFloat(e.target.value);
    const newTime = (pct / 100) * video.duration;
    video.currentTime = newTime;
    setProgress(pct);
    setCurrentDate(getDateAtTime(newTime));
    if (isEnded) setIsEnded(false);
  }, [isEnded]);

  // step one frame forward or back
  const stepFrame = useCallback((direction: 1 | -1) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const newTime = Math.max(0, Math.min(video.duration, video.currentTime + direction * FRAME_DURATION_S));
    video.currentTime = newTime;
    setProgress((newTime / video.duration) * 100);
    setCurrentDate(getDateAtTime(newTime));
    if (isEnded && direction < 0) setIsEnded(false);
  }, [isEnded]);

  const videoSrc = videoMeta ? `${API_BASE}/videos/${videoMeta.id}/stream` : null;

  return (
    <PageWrapper>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-950 to-slate-900 py-16">
        <div className="container mx-auto px-6 max-w-4xl">

          {/* Header */}
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-4 mb-3">
              <Image src="/images/8bit/plant.png" alt="" width={48} height={48} />
              <h1 className="text-4xl md:text-5xl font-bold text-green-400 pixel-font tracking-wider drop-shadow-[3px_3px_0_rgba(0,0,0,1)]">
                THE GARDEN
              </h1>
              <Image src="/images/8bit/plant.png" alt="" width={48} height={48} />
            </div>
          </div>

          {/* Timelapse Section */}
          <div className="mb-16">
            <h2 className="text-lg font-bold text-green-300 pixel-font mb-5 text-center tracking-wide">
              TIMELAPSE
            </h2>

            {videoSrc ? (
              <div
                ref={containerRef}
                className={isFullscreen ? "flex flex-col bg-black" : ""}
              >
                <video
                  ref={videoRef}
                  src={videoSrc}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleEnded}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className={isFullscreen
                    ? "flex-1 min-h-0 w-full object-contain"
                    : "w-full rounded-lg border-2 border-green-700 shadow-2xl"}
                >
                  Your browser does not support the video tag.
                </video>

                {/* Custom controls */}
                <div className={isFullscreen
                  ? "w-full shrink-0 bg-black/90 px-4 py-3"
                  : "mt-3 bg-green-950/60 border border-green-800 rounded-lg px-4 py-3"}>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handlePlayPause}
                      className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-green-700 hover:bg-green-600 text-white transition-colors"
                      aria-label={isEnded ? "Replay" : isPlaying ? "Pause" : "Play"}
                    >
                      {isEnded ? "↺" : isPlaying ? "⏸" : "▶"}
                    </button>
                    <button
                      onClick={() => stepFrame(-1)}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded bg-green-900 hover:bg-green-800 text-green-300 transition-colors text-sm"
                      aria-label="Previous frame"
                    >
                      &#x276E;
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={0.01}
                      value={progress}
                      onChange={handleScrub}
                      onMouseDown={handleScrubStart}
                      onMouseUp={handleScrubEnd}
                      onTouchStart={handleScrubStart}
                      onTouchEnd={handleScrubEnd}
                      className="flex-1 cursor-pointer accent-green-400"
                    />
                    <button
                      onClick={() => stepFrame(1)}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded bg-green-900 hover:bg-green-800 text-green-300 transition-colors text-sm"
                      aria-label="Next frame"
                    >
                      &#x276F;
                    </button>
                    <button
                      onClick={cyclePlaybackRate}
                      className="flex-shrink-0 h-8 px-2 flex items-center justify-center rounded bg-green-900 hover:bg-green-800 text-green-300 transition-colors text-xs font-mono"
                      aria-label={`Playback speed: ${playbackRate}x, click to change`}
                    >
                      {playbackRate}x
                    </button>
                    <button
                      onClick={toggleFullscreen}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded bg-green-900 hover:bg-green-800 text-green-300 transition-colors"
                      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                    >
                      {isFullscreen ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="4 14 10 14 10 20"></polyline>
                          <polyline points="20 10 14 10 14 4"></polyline>
                          <line x1="10" y1="14" x2="3" y2="21"></line>
                          <line x1="21" y1="3" x2="14" y2="10"></line>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="15 3 21 3 21 9"></polyline>
                          <polyline points="9 21 3 21 3 15"></polyline>
                          <line x1="21" y1="3" x2="14" y2="10"></line>
                          <line x1="3" y1="21" x2="10" y2="14"></line>
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="mt-2 text-center">
                    <span className="text-green-300 font-mono text-base tracking-widest">
                      {currentDate}
                    </span>
                  </div>
                </div>
              </div>
            ) : videoNotFound ? (
              <div className="bg-green-950/40 border-2 border-green-800 rounded-lg p-12 text-center">
                <p className="text-green-400 pixel-font text-lg mb-2">COMING SOON</p>
                <p className="text-slate-400 text-sm">timelapse video is being processed</p>
              </div>
            ) : (
              <div className="bg-green-950/40 border-2 border-green-800 rounded-lg p-12 text-center">
                <p className="text-slate-400 text-sm">loading...</p>
              </div>
            )}
          </div>

          {/* Gardening Inspiration */}
          <div className="mb-16">
            <h2 className="text-lg font-bold text-green-300 pixel-font mb-6 text-center tracking-wide">
              GARDENING INSPIRATION
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <a
                href="https://sandiegoseedcompany.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-950/40 border-2 border-green-700 rounded-lg p-6 hover:bg-green-900/40 hover:border-green-500 transition-all group"
              >
                <div className="text-green-400 font-bold text-lg mb-1 group-hover:text-green-300">
                  San Diego Seed Company
                </div>
                <div className="text-slate-400 text-sm mb-2">sandiegoseedcompany.com</div>
                <div className="text-slate-500 text-xs">
                  local seed company with solid info for SoCal gardening
                </div>
              </a>
              <a
                href="https://www.youtube.com/@SanDiegoSeedCompany"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-950/40 border-2 border-green-700 rounded-lg p-6 hover:bg-green-900/40 hover:border-green-500 transition-all group"
              >
                <div className="text-green-400 font-bold text-lg mb-1 group-hover:text-green-300">
                  San Diego Seed Co. — YouTube
                </div>
                <div className="text-slate-400 text-sm mb-2">@SanDiegoSeedCompany</div>
                <div className="text-slate-500 text-xs">
                  videos on planting, growing, and harvesting for San Diego climate
                </div>
              </a>
              <a
                href="https://www.youtube.com/watch?v=6vqRMKOxaW8"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-950/40 border-2 border-green-700 rounded-lg p-6 hover:bg-green-900/40 hover:border-green-500 transition-all group"
              >
                <div className="text-green-400 font-bold text-lg mb-1 group-hover:text-green-300">
                  Trellis to make you Jealous
                </div>
                <div className="text-slate-400 text-sm mb-2">youtube.com</div>
                <div className="text-slate-500 text-xs">
                  I use a modified version of this
                </div>
              </a>
            </div>
          </div>

          {/* Back Link */}
          <div className="text-center">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              ← Back to Main Menu
            </Link>
          </div>

        </div>
      </div>
    </PageWrapper>
  );
}
