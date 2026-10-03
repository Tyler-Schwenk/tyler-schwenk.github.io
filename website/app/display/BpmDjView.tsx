"use client";

import { useCallback, useRef } from "react";
import {
  bandRangeLevel,
  beatPhase,
  beatPulse,
  countBeat,
  detectedBeatTimes,
  historyTimeAxis,
  type BeatCounter,
  type BpmConfig,
  type BpmFrame,
  type BpmStream,
} from "./bpmAgent";
import { useCanvasLoop } from "./useCanvasLoop";

/**
 * The DJ bpm view: the room split into lows, mids and highs the way a mixer's
 * EQ splits it.
 * - a meter per range in dB, with a peak hold
 * - the tempo, a four-beat counter and how far through the beat it is
 * - a scrolling three-band waveform (blue lows, orange mids, white highs,
 *   like CDJ/rekordbox waveforms) with the detected beat grid over it
 * Meters are absolute (no auto gain), so they read like a level meter.
 * @param props.stream - The bpm agent stream (from BpmPanel).
 */

/** One EQ range: its name, frequencies and colour. */
interface EqRange {
  label: string;
  minHz: number;
  maxHz: number;
  color: string;
}

// split points like a DJ mixer's three-band EQ
const LOW_MAX_HZ = 250;
const HIGH_MIN_HZ = 2500;
const TOP_HZ = 20000;
const EQ_RANGES: EqRange[] = [
  { label: "LOW", minHz: 0, maxHz: LOW_MAX_HZ, color: "#2563eb" },
  { label: "MID", minHz: LOW_MAX_HZ, maxHz: HIGH_MIN_HZ, color: "#f59e0b" },
  { label: "HIGH", minHz: HIGH_MIN_HZ, maxHz: TOP_HZ, color: "#f8fafc" },
];

// layout, px
const PAD_PX = 56;
const METER_WIDTH_PX = 150;
const METER_GAP_PX = 64;
const LABEL_HEIGHT_PX = 90;
const PEAK_LINE_PX = 6;
const BEAT_BOX_SIZE_PX = 110;
const BEAT_BOX_GAP_PX = 28;
const PHASE_BAR_HEIGHT_PX = 22;
const BEAT_GRID_LINE_PX = 2;
// room left of the meters for the dB scale numbers
const SCALE_LABEL_WIDTH_PX = 42;
// fractions of the canvas height
const TOP_SECTION_FRACTION = 0.56;
const BEAT_BOXES_TOP_FRACTION = 0.3;

// meters rise instantly and fall at this many full heights per second; the peak holds
// a while, then falls slower
const METER_FALL_PER_S = 1.5;
const PEAK_HOLD_S = 1.2;
const PEAK_FALL_PER_S = 0.5;
const METER_TICK_STEP_DB = 10;

// the waveform is scaled to the loudest moment in view, then pushed toward the extremes
const WAVE_CONTRAST_EXPONENT = 2;
const BEATS_PER_BAR = 4;
// the lit beat box's opacity between beats; it flashes to full on the beat
const BEAT_BOX_REST_ALPHA = 0.5;

const LABEL_FONT = "bold 34px monospace";
const SMALL_FONT = "22px monospace";
const LABEL_COLOR = "#9ca3af";
const DIM_COLOR = "#1f2937";
const TRACK_COLOR = "#111827";
const BEAT_GRID_COLOR = "rgba(250, 204, 21, 0.55)";
const BEAT_LIT_COLOR = "#facc15";
const BACKGROUND_COLOR = "#000";

/** One meter's animation state. Values are 0-1 of the band scale. */
interface MeterState {
  level: number;
  peak: number;
  peakAgeS: number;
}

/** The view's animation state. */
interface DjState {
  meters: MeterState[];
  beats: BeatCounter;
  /** Each frame's three range levels, worked out once per frame. */
  rangeCache: WeakMap<BpmFrame, number[]>;
}

/**
 * A frame's level in each EQ range, cached since the waveform redraws every frame's history each time.
 * @param state - State holding the cache.
 * @param frame - The frame.
 * @param config - Stream config.
 * @returns One 0-1 level per EQ_RANGES entry.
 */
function rangeLevels(state: DjState, frame: BpmFrame, config: BpmConfig): number[] {
  const cached = state.rangeCache.get(frame);
  if (cached) return cached;
  const levels = EQ_RANGES.map((range) => bandRangeLevel(frame, config, range.minHz, range.maxHz));
  state.rangeCache.set(frame, levels);
  return levels;
}

/**
 * Moves the meters toward the latest levels: up at once, down under gravity, peaks held.
 * @param meters - Meter state, updated in place.
 * @param levels - Latest range levels.
 * @param dtS - Seconds since the last frame.
 */
function updateMeters(meters: MeterState[], levels: number[], dtS: number): void {
  levels.forEach((target, i) => {
    const meter = meters[i];
    meter.level = Math.max(target, meter.level - METER_FALL_PER_S * dtS);
    meter.peakAgeS += dtS;
    if (meter.level >= meter.peak) {
      meter.peak = meter.level;
      meter.peakAgeS = 0;
    } else if (meter.peakAgeS > PEAK_HOLD_S) {
      meter.peak = Math.max(meter.level, meter.peak - PEAK_FALL_PER_S * dtS);
    }
  });
}

/**
 * Draws the three meters, with a dB scale beside the first.
 * @param ctx - Canvas context.
 * @param meters - Meter state.
 * @param config - Stream config, for the dB scale.
 * @param top - Top of the meters, px.
 * @param bottom - Bottom of the meters, px.
 */
function drawMeters(ctx: CanvasRenderingContext2D, meters: MeterState[], config: BpmConfig, top: number, bottom: number): void {
  const height = bottom - top;
  const rangeDb = config.band_ceil_db - config.band_floor_db;
  ctx.font = SMALL_FONT;
  ctx.fillStyle = LABEL_COLOR;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let db = config.band_ceil_db; db >= config.band_floor_db; db -= METER_TICK_STEP_DB) {
    const y = bottom - ((db - config.band_floor_db) / rangeDb) * height;
    ctx.fillText(`${db}`, PAD_PX + SCALE_LABEL_WIDTH_PX, y);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  EQ_RANGES.forEach((range, i) => {
    const x = PAD_PX * 2 + SCALE_LABEL_WIDTH_PX + i * (METER_WIDTH_PX + METER_GAP_PX);
    const meter = meters[i];
    ctx.fillStyle = TRACK_COLOR;
    ctx.fillRect(x, top, METER_WIDTH_PX, height);
    ctx.fillStyle = range.color;
    ctx.fillRect(x, bottom - meter.level * height, METER_WIDTH_PX, meter.level * height);
    ctx.fillRect(x, bottom - meter.peak * height - PEAK_LINE_PX / 2, METER_WIDTH_PX, PEAK_LINE_PX);
    ctx.font = LABEL_FONT;
    ctx.fillText(range.label, x + METER_WIDTH_PX / 2, bottom + PAD_PX / 3);
    ctx.font = SMALL_FONT;
    ctx.fillStyle = LABEL_COLOR;
    const rangeLabel = range.maxHz >= TOP_HZ ? `${range.minHz}+ Hz` : `${range.minHz}-${range.maxHz} Hz`;
    ctx.fillText(rangeLabel, x + METER_WIDTH_PX / 2, bottom + PAD_PX / 3 + LABEL_HEIGHT_PX / 2);
  });
  ctx.textAlign = "start";
}

/**
 * Draws the four-beat counter and the phase bar under it.
 * @param ctx - Canvas context.
 * @param right - Right edge to line up with, px.
 * @param top - Top of the boxes, px.
 * @param beatCount - Beats counted so far.
 * @param phase - Phase through the current beat, or null with no beat.
 * @param pulse - Beat pulse 0-1.
 */
function drawBeatCounter(
  ctx: CanvasRenderingContext2D,
  right: number,
  top: number,
  beatCount: number,
  phase: number | null,
  pulse: number
): void {
  const totalWidth = BEATS_PER_BAR * BEAT_BOX_SIZE_PX + (BEATS_PER_BAR - 1) * BEAT_BOX_GAP_PX;
  const left = right - totalWidth;
  const litBox = phase === null ? -1 : beatCount % BEATS_PER_BAR;
  for (let i = 0; i < BEATS_PER_BAR; i++) {
    ctx.fillStyle = i === litBox ? BEAT_LIT_COLOR : DIM_COLOR;
    ctx.globalAlpha = i === litBox ? BEAT_BOX_REST_ALPHA + (1 - BEAT_BOX_REST_ALPHA) * pulse : 1;
    ctx.fillRect(left + i * (BEAT_BOX_SIZE_PX + BEAT_BOX_GAP_PX), top, BEAT_BOX_SIZE_PX, BEAT_BOX_SIZE_PX);
  }
  ctx.globalAlpha = 1;
  const barTop = top + BEAT_BOX_SIZE_PX + BEAT_BOX_GAP_PX;
  ctx.fillStyle = DIM_COLOR;
  ctx.fillRect(left, barTop, totalWidth, PHASE_BAR_HEIGHT_PX);
  if (phase === null) return;
  ctx.fillStyle = BEAT_LIT_COLOR;
  ctx.fillRect(left, barTop, totalWidth * phase, PHASE_BAR_HEIGHT_PX);
}

/**
 * Draws the scrolling three-band waveform with the beat grid, newest on the right.
 * @param ctx - Canvas context.
 * @param state - State (for the level cache).
 * @param stream - The stream (frames, tempo, config).
 * @param config - Stream config.
 * @param rect - Where to draw it.
 */
function drawWaveform(
  ctx: CanvasRenderingContext2D,
  state: DjState,
  stream: BpmStream,
  config: BpmConfig,
  rect: { x: number; y: number; w: number; h: number }
): void {
  const frames = stream.framesRef.current ?? [];
  if (frames.length === 0) return;
  const { startMs, xForTime } = historyTimeAxis(frames[frames.length - 1].t_ms, config, rect.x, rect.w);
  const columnWidth = Math.max(1, rect.w / frames.length);
  const levels = frames.map((frame) => rangeLevels(state, frame, config));
  const loudest = Math.max(...levels.flat()) || 1;
  const centreY = rect.y + rect.h / 2;

  EQ_RANGES.forEach((range, r) => {
    ctx.fillStyle = range.color;
    frames.forEach((frame, i) => {
      const halfHeight = (Math.pow(levels[i][r] / loudest, WAVE_CONTRAST_EXPONENT) * rect.h) / 2;
      ctx.fillRect(xForTime(frame.t_ms), centreY - halfHeight, columnWidth, halfHeight * 2);
    });
  });

  ctx.fillStyle = BEAT_GRID_COLOR;
  for (const t of detectedBeatTimes(stream.tempoRef.current, startMs, frames[frames.length - 1].t_ms)) {
    ctx.fillRect(xForTime(t), rect.y, BEAT_GRID_LINE_PX, rect.h);
  }
}

export default function BpmDjView({ stream }: { stream: BpmStream }) {
  const { config, tempo } = stream;
  const stateRef = useRef<DjState>({
    meters: EQ_RANGES.map(() => ({ level: 0, peak: 0, peakAgeS: 0 })),
    beats: { count: 0, lastPhase: null },
    rangeCache: new WeakMap(),
  });

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, dtS: number) => {
      ctx.fillStyle = BACKGROUND_COLOR;
      ctx.fillRect(0, 0, width, height);
      if (!config) return;
      const state = stateRef.current;
      const nowMs = Date.now();
      const latest = stream.framesRef.current?.at(-1);
      if (latest) updateMeters(state.meters, rangeLevels(state, latest, config), dtS);
      const phase = beatPhase(stream.tempoRef.current, nowMs);
      countBeat(state.beats, phase);

      const topSectionBottom = height * TOP_SECTION_FRACTION;
      drawMeters(ctx, state.meters, config, PAD_PX, topSectionBottom - LABEL_HEIGHT_PX);
      drawBeatCounter(
        ctx,
        width - PAD_PX,
        height * BEAT_BOXES_TOP_FRACTION,
        state.beats.count,
        phase,
        beatPulse(stream.tempoRef.current, nowMs)
      );
      const waveTop = topSectionBottom + PAD_PX;
      drawWaveform(ctx, state, stream, config, { x: 0, y: waveTop, w: width, h: height - waveTop - PAD_PX });
    },
    [config, stream]
  );
  const canvasRef = useCanvasLoop(draw);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden font-mono">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute top-12 right-14 text-right">
        <div className="text-[9rem] leading-none font-bold text-white tabular-nums">
          {tempo?.bpm != null ? tempo.bpm.toFixed(1) : "---.-"}
        </div>
        <div className="text-3xl text-gray-400 uppercase tracking-widest mt-2">
          bpm{tempo && tempo.bpm != null && ` · confidence ${tempo.confidence.toFixed(2)}`}
        </div>
      </div>
    </div>
  );
}
