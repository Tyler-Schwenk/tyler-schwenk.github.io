"use client";

import { useCallback, useRef } from "react";
import { beatPhase, beatPulse, countBeat, nextBeatHue, type BeatCounter, type BpmStream } from "./bpmAgent";
import { createSpectrumLevels, updateSpectrumLevels, type SpectrumLevels } from "./spectrumLevels";
import { useCanvasLoop } from "./useCanvasLoop";

/**
 * The spectrum bars bpm view: spectrum bars mirrored out from the middle (bass in the
 * centre) that jump up with the music and fall back under gravity, with
 * falling peak caps. On every beat the bars kick taller and brighter, a glow
 * flashes behind them, and the colours step round the wheel.
 * @param props.stream - The bpm agent stream (from BpmPanel).
 */

// bar layout, as fractions of the canvas unless marked px
const BAR_GAP_PX = 6;
const MAX_BAR_HEIGHT_FRACTION = 0.72;
const MIN_BAR_HEIGHT_PX = 4;
const BAR_BASELINE_FRACTION = 0.9;
const CAP_HEIGHT_PX = 6;
const CAP_GAP_PX = 4;

// bars rise instantly and fall at this many bar-heights per second; caps fall slower
const BAR_FALL_PER_S = 1.8;
const CAP_FALL_PER_S = 0.45;

// on the beat
const PULSE_HEIGHT_BOOST = 0.22;
const PULSE_LIGHTNESS_BOOST_PCT = 22;
const GLOW_MAX_ALPHA = 0.45;
const GLOW_RADIUS_FRACTION = 0.75;
const GLOW_LIGHTNESS_PCT = 50;
const HUE_STEP_PER_BEAT_DEG = 47;
// colour change from the centre bars to the outer ones
const HUE_SPREAD_DEG = 140;
const BAR_SATURATION_PCT = 90;
const BAR_LIGHTNESS_PCT = 48;
const CAP_COLOR = "rgba(255, 255, 255, 0.85)";
const BACKGROUND_COLOR = "#000";

/** The view's animation state. */
interface BarState {
  levels: SpectrumLevels;
  beats: BeatCounter;
  hueDeg: number;
}

/**
 * Draws the glow behind the bars, brightest right on the beat.
 * @param ctx - Canvas context.
 * @param width - Canvas width.
 * @param height - Canvas height.
 * @param hueDeg - Current hue.
 * @param pulse - Beat pulse 0-1.
 */
function drawGlow(ctx: CanvasRenderingContext2D, width: number, height: number, hueDeg: number, pulse: number): void {
  if (pulse <= 0) return;
  const baselineY = height * BAR_BASELINE_FRACTION;
  const radius = Math.max(width, height) * GLOW_RADIUS_FRACTION;
  const glow = ctx.createRadialGradient(width / 2, baselineY, 0, width / 2, baselineY, radius);
  glow.addColorStop(0, `hsla(${hueDeg}, ${BAR_SATURATION_PCT}%, ${GLOW_LIGHTNESS_PCT}%, ${GLOW_MAX_ALPHA * pulse})`);
  glow.addColorStop(1, "hsla(0, 0%, 0%, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draws the bars and caps, mirrored about the centre.
 * @param ctx - Canvas context.
 * @param width - Canvas width.
 * @param height - Canvas height.
 * @param state - Bar state.
 * @param pulse - Beat pulse 0-1.
 */
function drawBars(ctx: CanvasRenderingContext2D, width: number, height: number, state: BarState, pulse: number): void {
  const { heights, caps } = state.levels;
  const count = heights.length;
  if (count === 0) return;
  const slotWidth = width / (count * 2);
  const barWidth = Math.max(1, slotWidth - BAR_GAP_PX);
  const baselineY = height * BAR_BASELINE_FRACTION;
  const maxHeight = height * MAX_BAR_HEIGHT_FRACTION * (1 + PULSE_HEIGHT_BOOST * pulse);
  const lightness = BAR_LIGHTNESS_PCT + PULSE_LIGHTNESS_BOOST_PCT * pulse;

  for (let i = 0; i < count; i++) {
    const barHeight = Math.max(MIN_BAR_HEIGHT_PX, heights[i] * maxHeight);
    const capY = baselineY - Math.max(MIN_BAR_HEIGHT_PX, caps[i] * maxHeight) - CAP_GAP_PX - CAP_HEIGHT_PX;
    const hue = state.hueDeg + (i / count) * HUE_SPREAD_DEG;
    // band i sits i slots out from the centre on both sides
    const offsets = [width / 2 + i * slotWidth, width / 2 - (i + 1) * slotWidth];
    for (const x of offsets) {
      ctx.fillStyle = `hsl(${hue}, ${BAR_SATURATION_PCT}%, ${lightness}%)`;
      ctx.fillRect(x + BAR_GAP_PX / 2, baselineY - barHeight, barWidth, barHeight);
      ctx.fillStyle = CAP_COLOR;
      ctx.fillRect(x + BAR_GAP_PX / 2, capY, barWidth, CAP_HEIGHT_PX);
    }
  }
}

export default function BpmVisualizer({ stream }: { stream: BpmStream }) {
  const { framesRef, tempoRef, tempo } = stream;
  const stateRef = useRef<BarState>({ levels: createSpectrumLevels(), beats: { count: 0, lastPhase: null }, hueDeg: 0 });

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, dtS: number) => {
      const state = stateRef.current;
      const nowMs = Date.now();
      const latest = framesRef.current?.at(-1);
      if (latest) updateSpectrumLevels(state.levels, latest.bands, dtS, BAR_FALL_PER_S, CAP_FALL_PER_S);
      const phase = beatPhase(tempoRef.current, nowMs);
      const isNewBeat = countBeat(state.beats, phase);
      state.hueDeg = nextBeatHue(state.hueDeg, isNewBeat, phase !== null, HUE_STEP_PER_BEAT_DEG, dtS);
      const pulse = beatPulse(tempoRef.current, nowMs);

      ctx.fillStyle = BACKGROUND_COLOR;
      ctx.fillRect(0, 0, width, height);
      drawGlow(ctx, width, height, state.hueDeg, pulse);
      drawBars(ctx, width, height, state, pulse);
    },
    [framesRef, tempoRef]
  );
  const canvasRef = useCanvasLoop(draw);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden font-mono">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute bottom-6 right-8 text-3xl text-gray-400 tabular-nums">
        {tempo?.bpm != null ? `${tempo.bpm.toFixed(0)} bpm` : "listening..."}
      </div>
    </div>
  );
}
