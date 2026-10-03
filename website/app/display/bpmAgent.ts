"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Client for the bpm agent on the kiosk machine (see
 * pi/services/bpm-agent/README.md). The agent records the room's mic only
 * while a page has its event stream open, and streams spectrum frames and
 * tempo estimates. It runs on the same machine as the page, so its beat times
 * are on the same clock as Date.now().
 */

// the agent only listens on the kiosk machine's own loopback, so this only works when
// the page is running in the kiosk browser
export const BPM_AGENT_URL = "http://127.0.0.1:8766";

const AGENT_UNREACHABLE_MESSAGE = "bpm agent unreachable -- this panel only works on the kiosk";

// how much frame history the panels keep (the calibration spectrogram's width), ~7 s
export const FRAME_HISTORY_LENGTH = 600;

// how fast the on-beat pulse fades through the beat: e^-(decay * phase), so it's ~0.7%
// left by the next beat
const BEAT_PULSE_DECAY = 5;

// a beat phase drop bigger than this between two animation frames means a new beat started
const BEAT_WRAP_THRESHOLD = 0.5;
// with no beat, colours that step per beat drift this fast instead
const IDLE_HUE_DRIFT_DEG_PER_S = 8;
const FULL_CIRCLE_DEG = 360;
const MS_PER_S = 1000;
// band levels in frames run 0..this
const BAND_LEVEL_MAX = 255;

/** Fixed facts about the stream, sent once per connection. */
export interface BpmConfig {
  /** Band count + 1 edges, low to high, Hz. */
  band_edges_hz: number[];
  /** A band level of 0 is this many dB, 255 is band_ceil_db, linear between. */
  band_floor_db: number;
  band_ceil_db: number;
  /** The band the onset curve listens to. */
  onset_min_hz: number;
  onset_max_hz: number;
  frame_rate_hz: number;
  /** Below this average level the agent calls the room silent. */
  silence_db: number;
  /** `curve` in BpmTempo covers curve_min_bpm, + curve_step_bpm, ... */
  curve_min_bpm: number;
  curve_step_bpm: number;
}

/** One hop of analysed audio, ~86 a second. */
export interface BpmFrame {
  /** When it was captured, epoch ms on the kiosk's clock. */
  t_ms: number;
  /** Spectrum levels 0-255, low to high frequency. */
  bands: number[];
  /** Bass onset strength (0 when nothing new hit). */
  onset: number;
  level_db: number;
}

/** The agent's current idea of the beat, a few times a second. */
export interface BpmTempo {
  /** Null when silent or there's no clear beat. */
  bpm: number | null;
  /** 0-1, how strongly the onsets repeat at the beat period. */
  confidence: number;
  /** A beat on screen, epoch ms, with the calibration offset applied. Beats fall every period_ms either side. */
  beat_ms: number | null;
  period_ms: number | null;
  /** Calibration offset already applied to beat_ms (negative = earlier on screen). */
  offset_ms: number;
  /** Average level over the last ~1.5 s, dBFS. */
  level_db: number;
  /** Prior-weighted score per tempo (see BpmConfig), max 1. */
  curve: number[];
}

/** What the bpm panels read. Frames and tempo also come as refs, for canvas loops. */
export interface BpmStream {
  config: BpmConfig | null;
  tempo: BpmTempo | null;
  tempoRef: RefObject<BpmTempo | null>;
  /** Oldest first, at most FRAME_HISTORY_LENGTH. Mutated in place as frames arrive. */
  framesRef: RefObject<BpmFrame[]>;
  /** Why there's no stream, or null while it's fine. */
  error: string | null;
}

/**
 * Keeps an event stream open to the bpm agent while mounted, which is what
 * keeps the mic recording. Frames go into a ref (they arrive far faster than
 * React should re-render); config and tempo are state too.
 * @returns The stream's latest data.
 */
export function useBpmStream(): BpmStream {
  const [config, setConfig] = useState<BpmConfig | null>(null);
  const [tempo, setTempo] = useState<BpmTempo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tempoRef = useRef<BpmTempo | null>(null);
  const framesRef = useRef<BpmFrame[]>([]);

  useEffect(() => {
    const source = new EventSource(`${BPM_AGENT_URL}/stream`);
    const frames = framesRef.current;
    source.addEventListener("config", (event) => {
      setConfig(JSON.parse(event.data));
      setError(null);
    });
    source.addEventListener("frame", (event) => {
      frames.push(JSON.parse(event.data));
      if (frames.length > FRAME_HISTORY_LENGTH) frames.splice(0, frames.length - FRAME_HISTORY_LENGTH);
    });
    source.addEventListener("tempo", (event) => {
      const latest: BpmTempo = JSON.parse(event.data);
      tempoRef.current = latest;
      setTempo(latest);
    });
    // the agent's own `error` event carries a message; a bare one is the connection failing
    source.addEventListener("error", (event) => {
      const message = event instanceof MessageEvent ? JSON.parse(event.data).message : AGENT_UNREACHABLE_MESSAGE;
      setError(message);
      tempoRef.current = null;
      setTempo(null);
    });
    return () => {
      source.close();
      frames.length = 0;
    };
  }, []);

  return { config, tempo, tempoRef, framesRef, error };
}

/**
 * How far through the current beat a moment is.
 * @param tempo - Latest tempo, or null.
 * @param nowMs - The moment, epoch ms.
 * @returns 0 right on a beat rising toward 1 just before the next, or null with no beat.
 */
export function beatPhase(tempo: BpmTempo | null, nowMs: number): number | null {
  if (!tempo || tempo.beat_ms === null || tempo.period_ms === null) return null;
  const beats = (nowMs - tempo.beat_ms) / tempo.period_ms;
  return beats - Math.floor(beats);
}

/**
 * The on-beat pulse every bpm visual shares: jumps to 1 on each beat and fades out.
 * @param tempo - Latest tempo, or null.
 * @param nowMs - The moment, epoch ms.
 * @returns 0-1, 0 with no beat.
 */
export function beatPulse(tempo: BpmTempo | null, nowMs: number): number {
  const phase = beatPhase(tempo, nowMs);
  return phase === null ? 0 : Math.exp(-BEAT_PULSE_DECAY * phase);
}

/** Counts beats as an animation runs, by watching the beat phase wrap round. */
export interface BeatCounter {
  /** Beats seen since the counter started. */
  count: number;
  /** Phase on the previous animation frame, null with no beat. */
  lastPhase: number | null;
}

/**
 * Advances a beat counter by one animation frame.
 * @param counter - Counter, updated in place.
 * @param phase - This frame's beat phase (from beatPhase), or null with no beat.
 * @returns True if a new beat started since the last frame.
 */
export function countBeat(counter: BeatCounter, phase: number | null): boolean {
  const isNewBeat = phase !== null && counter.lastPhase !== null && phase < counter.lastPhase - BEAT_WRAP_THRESHOLD;
  if (isNewBeat) counter.count++;
  counter.lastPhase = phase;
  return isNewBeat;
}

/**
 * Moves a hue on: a step round the wheel on each new beat, or a slow drift with no beat.
 * @param hueDeg - Current hue.
 * @param isNewBeat - A beat started this frame (from countBeat).
 * @param hasBeat - There's a beat at all.
 * @param stepDeg - How far a beat moves it.
 * @param dtS - Seconds since the last frame.
 * @returns The new hue, 0-360.
 */
export function nextBeatHue(hueDeg: number, isNewBeat: boolean, hasBeat: boolean, stepDeg: number, dtS: number): number {
  const moved = hasBeat ? hueDeg + (isNewBeat ? stepDeg : 0) : hueDeg + IDLE_HUE_DRIFT_DEG_PER_S * dtS;
  return moved % FULL_CIRCLE_DEG;
}

/**
 * The mean level of a frame's bands whose centres fall in a frequency range.
 * @param frame - The frame.
 * @param config - Stream config, for the band edges.
 * @param minHz - Bottom of the range.
 * @param maxHz - Top of the range.
 * @returns 0-1 (0 if no band falls in the range).
 */
export function bandRangeLevel(frame: BpmFrame, config: BpmConfig, minHz: number, maxHz: number): number {
  const edges = config.band_edges_hz;
  let total = 0;
  let count = 0;
  frame.bands.forEach((level, band) => {
    const centreHz = Math.sqrt(edges[band] * edges[band + 1]);
    if (centreHz < minHz || centreHz >= maxHz) return;
    total += level;
    count++;
  });
  return count === 0 ? 0 : total / count / BAND_LEVEL_MAX;
}

/**
 * The beats the tracker detected (before the calibration offset, so they line
 * up with the audio frames rather than the screen) inside a time window.
 * @param tempo - Latest tempo, or null.
 * @param startMs - Window start, epoch ms.
 * @param endMs - Window end, epoch ms.
 * @returns Beat times, oldest first (none with no beat).
 */
export function detectedBeatTimes(tempo: BpmTempo | null, startMs: number, endMs: number): number[] {
  if (!tempo || tempo.beat_ms === null || tempo.period_ms === null) return [];
  const detectedBeatMs = tempo.beat_ms - tempo.offset_ms;
  const times: number[] = [];
  const first = Math.ceil((startMs - detectedBeatMs) / tempo.period_ms);
  for (let t = detectedBeatMs + first * tempo.period_ms; t <= endMs; t += tempo.period_ms) times.push(t);
  return times;
}

/**
 * A time axis for drawing frame history: FRAME_HISTORY_LENGTH frames across a
 * width, with the newest frame at the right edge.
 * @param endMs - The newest frame's time.
 * @param config - Stream config, for the frame rate.
 * @param left - Left edge, px.
 * @param width - Width, px.
 * @returns The window's start time, and a function from a time to its x.
 */
export function historyTimeAxis(
  endMs: number,
  config: BpmConfig,
  left: number,
  width: number
): { startMs: number; xForTime: (tMs: number) => number } {
  const columnWidth = width / FRAME_HISTORY_LENGTH;
  const startMs = endMs - (FRAME_HISTORY_LENGTH / config.frame_rate_hz) * MS_PER_S;
  const xForTime = (tMs: number) => left + width - ((endMs - tMs) / MS_PER_S) * config.frame_rate_hz * columnWidth;
  return { startMs, xForTime };
}
