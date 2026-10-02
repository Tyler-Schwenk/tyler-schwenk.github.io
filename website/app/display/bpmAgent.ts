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

/** Fixed facts about the stream, sent once per connection. */
export interface BpmConfig {
  /** DISPLAY band count + 1 edges, low to high, Hz. */
  band_edges_hz: number[];
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
