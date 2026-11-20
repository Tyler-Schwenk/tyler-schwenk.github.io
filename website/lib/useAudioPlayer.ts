"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** something the player can play: a recorded set, or the live stream. */
export type PlayerTrack = {
  /** stable key, like "live" or "set-3". */
  id: string;
  title: string;
  /** second line, like the date or "live from the den". */
  subtitle: string;
  src: string;
  /** the live stream: no seeking, and resuming jumps back to the live edge. */
  live: boolean;
  /** the site page that's this track's full view (a set's replay, the live room). */
  href: string;
  /** cover art, square-ish, null for none (the player shows a placeholder). */
  artSrc: string | null;
};

/** what useAudioPlayer hands back. */
export type AudioPlayer = {
  /** what's loaded, null before anything's been played. */
  track: PlayerTrack | null;
  /** playing or about to (pressed play and it's loading). */
  playing: boolean;
  /** waiting on the network. */
  loading: boolean;
  currentTimeS: number;
  /** 0 until it's known, and for the live stream. */
  durationS: number;
  /** 0 to 1. */
  volume: number;
  muted: boolean;
  /** why the last play failed, null when things are fine. */
  error: string | null;
  /**
   * plays a track from the start, or resumes it if it's the one loaded. with startAtS
   * (recorded sets only) it plays from there instead, even for a track that's just loading.
   */
  play: (track: PlayerTrack, startAtS?: number) => void;
  pause: () => void;
  /** play if it's paused or a different track, pause if it's this one playing. */
  toggle: (track: PlayerTrack) => void;
  seekTo: (seconds: number) => void;
  /** jumps by this many seconds, either way. */
  seekBy: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
};

/** how far the skip buttons jump, on the page and on the lock screen. */
export const SKIP_BACK_S = 15;
export const SKIP_FORWARD_S = 30;

// what the lock screen and notification controls show next to the title
const MEDIA_SESSION_ARTIST = "Opium Den";
// the site's icon, for anything without its own cover
const FALLBACK_ARTWORK = { src: "/images/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" };
const DEFAULT_VOLUME = 1;

/**
 * a fresh url for the live stream. reconnecting with the same url can get the browser's
 * stale buffer back instead of what's playing now.
 *
 * @param {string} src - the live stream url.
 * @returns {string} the url with a cache-busting query.
 */
function liveEdgeUrl(src: string): string {
  return `${src}${src.includes("?") ? "&" : "?"}t=${Date.now()}`;
}

/**
 * hangs up on whatever the element is loading, so a paused live stream stops downloading.
 *
 * @param {HTMLAudioElement} audio - the player's element.
 */
function unloadAudio(audio: HTMLAudioElement): void {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
}

/**
 * one audio element shared by the whole site, so starting a set stops the live stream
 * and the player bar always shows what's actually playing. it isn't in the page, so it
 * keeps going through client-side navigation, a backgrounded tab and a locked phone.
 *
 * pausing the live stream hangs up instead of buffering in the background, and playing
 * it again reconnects at the live edge. hooks into the media session so phones show the
 * title, play/pause, skip back/forward and a scrubber on the lock screen.
 *
 * @returns {AudioPlayer} state and controls.
 */
export function useAudioPlayer(): AudioPlayer {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [track, setTrack] = useState<PlayerTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTimeS, setCurrentTimeS] = useState(0);
  const [durationS, setDurationS] = useState(0);
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // the handlers below read it without re-subscribing every time it changes
  const trackRef = useRef<PlayerTrack | null>(null);
  // where a freshly loaded set should start: a new file can't seek until its metadata's in
  const startAtRef = useRef<number | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;

    const onPlaying = () => {
      setPlaying(true);
      setLoading(false);
    };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setLoading(true);
    const onTime = () => setCurrentTimeS(audio.currentTime);
    const onDuration = () => setDurationS(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onMetadata = () => {
      const startAt = startAtRef.current;
      if (startAt === null) return;
      startAtRef.current = null;
      audio.currentTime = startAt;
    };
    const onVolume = () => {
      setVolumeState(audio.volume);
      setMuted(audio.muted);
    };
    const onEnded = () => {
      setPlaying(false);
      setLoading(false);
    };
    const onError = () => {
      // removing the src on pause fires an error too; only a loaded track's failure counts
      if (!audio.getAttribute("src")) return;
      setPlaying(false);
      setLoading(false);
      const what = trackRef.current?.live ? "the live stream" : `"${trackRef.current?.title ?? "this set"}"`;
      setError(`couldn't play ${what}. the pi might be down or the stream just ended, so try again in a bit.`);
    };

    const listeners: [string, () => void][] = [
      ["playing", onPlaying],
      ["pause", onPause],
      ["waiting", onWaiting],
      ["timeupdate", onTime],
      ["durationchange", onDuration],
      ["loadedmetadata", onMetadata],
      ["volumechange", onVolume],
      ["ended", onEnded],
      ["error", onError],
    ];
    listeners.forEach(([name, handler]) => audio.addEventListener(name, handler));
    return () => {
      listeners.forEach(([name, handler]) => audio.removeEventListener(name, handler));
      unloadAudio(audio);
      audioRef.current = null;
    };
  }, []);

  const startPlayback = useCallback((audio: HTMLAudioElement) => {
    setError(null);
    setLoading(true);
    setPlaying(true);
    audio.play().catch((err: DOMException) => {
      // a newer play or pause interrupting this one isn't a failure
      if (err.name === "AbortError") return;
      setPlaying(false);
      setLoading(false);
      setError(`couldn't start playback (${err.message}). tap play again.`);
    });
  }, []);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (trackRef.current?.live) {
      unloadAudio(audio);
      setPlaying(false);
      setLoading(false);
      return;
    }
    audio.pause();
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || trackRef.current?.live) return;
    const end = Number.isFinite(audio.duration) ? audio.duration : seconds;
    audio.currentTime = Math.min(Math.max(seconds, 0), end);
    setCurrentTimeS(audio.currentTime);
  }, []);

  const play = useCallback(
    (next: PlayerTrack, startAtS?: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const sameTrack = trackRef.current?.id === next.id;
      const startAt = next.live ? null : (startAtS ?? null);
      trackRef.current = next;
      setTrack(next);
      if (!sameTrack || next.live || !audio.getAttribute("src")) {
        audio.src = next.live ? liveEdgeUrl(next.src) : next.src;
        startAtRef.current = startAt;
        setCurrentTimeS(startAt ?? 0);
        setDurationS(0);
      } else if (startAt !== null) {
        seekTo(startAt);
      }
      startPlayback(audio);
    },
    [startPlayback, seekTo]
  );

  const toggle = useCallback(
    (next: PlayerTrack) => {
      if (trackRef.current?.id === next.id && playing) pause();
      else play(next);
    },
    [playing, pause, play]
  );

  const seekBy = useCallback(
    (seconds: number) => seekTo((audioRef.current?.currentTime ?? 0) + seconds),
    [seekTo]
  );

  const setVolume = useCallback((next: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = Math.min(Math.max(next, 0), 1);
    audio.muted = next === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.muted = !audio.muted;
  }, []);

  useEffect(() => {
    if (!track || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: MEDIA_SESSION_ARTIST,
      album: track.subtitle,
      artwork: [track.artSrc ? { src: track.artSrc } : FALLBACK_ARTWORK],
    });
    navigator.mediaSession.setActionHandler("play", () => play(track));
    navigator.mediaSession.setActionHandler("pause", pause);
    navigator.mediaSession.setActionHandler(
      "seekto",
      track.live ? null : (details) => seekTo(details.seekTime ?? 0)
    );
    navigator.mediaSession.setActionHandler(
      "seekbackward",
      track.live ? null : (details) => seekBy(-(details.seekOffset ?? SKIP_BACK_S))
    );
    navigator.mediaSession.setActionHandler(
      "seekforward",
      track.live ? null : (details) => seekBy(details.seekOffset ?? SKIP_FORWARD_S)
    );
  }, [track, play, pause, seekTo, seekBy]);

  // keeps the lock screen's scrubber in step. only once the length's known, since the
  // browser throws on a position past the end, and never for the stream
  useEffect(() => {
    if (!track || track.live || durationS <= 0 || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: durationS,
        position: Math.min(currentTimeS, durationS),
        playbackRate: 1,
      });
    } catch (err) {
      console.warn("couldn't update the lock screen's position, it'll just show without a scrubber", err);
    }
  }, [track, durationS, currentTimeS]);

  return {
    track,
    playing,
    loading,
    currentTimeS,
    durationS,
    volume,
    muted,
    error,
    play,
    pause,
    toggle,
    seekTo,
    seekBy,
    setVolume,
    toggleMute,
  };
}
