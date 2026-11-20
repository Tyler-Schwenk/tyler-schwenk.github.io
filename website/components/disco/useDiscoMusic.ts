"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { MUSIC } from "./constants";

// a quick fade for muting, so it doesn't click
const MUTE_FADE_TIME_CONSTANT_S = 0.08;

/** what the invite needs from the music player */
export interface DiscoMusic {
  /** true once the song's taken over from the video and is going */
  playing: boolean;
  muted: boolean;
  /**
   * warms up the audio. call it straight from a tap (or the autoplay attempt) so
   * the browser lets the audio context run, and so the song's decoded by the handoff.
   */
  prepare: () => void;
  /**
   * starts the song at a point on the video's clock, if it's ready.
   * @returns {boolean} false if the song isn't decoded yet or audio's blocked, so the video should keep its own sound.
   */
  startAt: (positionS: number) => boolean;
  stop: () => void;
  toggleMute: () => void;
}

/**
 * the song under the flier. music.mp3 is the invite video's song trimmed to start
 * where the video does, so a time on the video is the same time in the file. it
 * plays on after the video, and once it reaches the outro it loops an 8 bar stretch,
 * a bit quieter. it's web audio rather than an audio element because only web audio
 * loops without a gap. it pauses while the tab's hidden.
 * @returns {DiscoMusic} the player's state and controls.
 */
export function useDiscoMusic(): DiscoMusic {
  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const loadingRef = useRef<Promise<void> | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  const prepare = useCallback(() => {
    // ios mutes web audio with the ringer switch (video sound plays anyway), unless
    // the page says it's playing media. safari 17+ has this; older ones just skip it
    const { audioSession } = navigator as Navigator & { audioSession?: { type: string } };
    if (audioSession) {
      audioSession.type = "playback";
    }
    if (!ctxRef.current) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      masterRef.current = master;
    }
    const ctx = ctxRef.current;
    ctx.resume().catch((error: unknown) => {
      // blocked until a tap; the video keeps its own sound in the meantime
      console.warn("disco invite: audio context couldn't start yet, the video will keep its own sound", error);
    });
    if (loadingRef.current) {
      return;
    }
    loadingRef.current = fetch(MUSIC.src)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`got ${response.status} for ${MUSIC.src}`);
        }
        return response.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        bufferRef.current = buffer;
      })
      .catch((error: unknown) => {
        console.error(
          "disco invite: couldn't load the flier music, so it'll stop with the video. check public/video/disco/music.mp3 exists",
          error,
        );
        loadingRef.current = null;
      });
  }, []);

  const stop = useCallback(() => {
    const source = sourceRef.current;
    sourceRef.current = null;
    setPlaying(false);
    if (!source) {
      return;
    }
    source.onended = null;
    source.stop();
    source.disconnect();
  }, []);

  const startAt = useCallback(
    (positionS: number) => {
      const ctx = ctxRef.current;
      const buffer = bufferRef.current;
      const master = masterRef.current;
      if (!ctx || !buffer || !master || ctx.state !== "running" || positionS >= MUSIC.loopEndS) {
        return false;
      }
      stop();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = MUSIC.loopStartS;
      source.loopEnd = MUSIC.loopEndS;

      // ease down to the loop's level over the last stretch before it first wraps
      const level = ctx.createGain();
      const firstWrapAt = ctx.currentTime + (MUSIC.loopEndS - positionS);
      const fadeFrom = Math.max(ctx.currentTime, firstWrapAt - MUSIC.loopFadeS);
      level.gain.setValueAtTime(1, fadeFrom);
      level.gain.linearRampToValueAtTime(MUSIC.loopGain, firstWrapAt);

      source.connect(level).connect(master);
      source.start(0, positionS);
      sourceRef.current = source;
      setPlaying(true);
      return true;
    },
    [stop],
  );

  const toggleMute = useCallback(() => {
    setMuted((wasMuted) => {
      const ctx = ctxRef.current;
      masterRef.current?.gain.setTargetAtTime(wasMuted ? 1 : 0, ctx?.currentTime ?? 0, MUTE_FADE_TIME_CONSTANT_S);
      return !wasMuted;
    });
  }, []);

  // no music in a background tab; it picks up where it was when they come back
  useEffect(() => {
    const handleVisibility = () => {
      const ctx = ctxRef.current;
      if (!ctx) {
        return;
      }
      const action = document.hidden ? ctx.suspend() : ctx.resume();
      action.catch((error: unknown) => {
        console.warn("disco invite: couldn't pause or resume the music with the tab", error);
      });
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // shut the audio down when the invite goes away
  useEffect(
    () => () => {
      sourceRef.current?.stop();
      ctxRef.current?.close().catch((error: unknown) => {
        console.warn("disco invite: couldn't close the music's audio context", error);
      });
      // forget it all, so a remount builds a fresh context instead of reusing a closed one
      sourceRef.current = null;
      ctxRef.current = null;
      masterRef.current = null;
      bufferRef.current = null;
      loadingRef.current = null;
    },
    [],
  );

  return { playing, muted, prepare, startAt, stop, toggleMute };
}
