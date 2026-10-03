"use client";

import { useCallback, useRef } from "react";
import {
  bandRangeLevel,
  beatPhase,
  beatPulse,
  countBeat,
  nextBeatHue,
  type BeatCounter,
  type BpmStream,
} from "./bpmAgent";
import { createSpectrumLevels, updateSpectrumLevels, type SpectrumLevels } from "./spectrumLevels";
import { useCanvasLoop } from "./useCanvasLoop";

/**
 * The artistic bpm view: a slowly turning halo of spectrum spokes (bass at
 * the top and bottom, mirrored left and right) around a glowing core that
 * swells with the bass, all drawn with light trails. Each beat throws a burst
 * of sparks outward, kicks the halo's spin, and steps the colours round.
 * @param props.stream - The bpm agent stream (from BpmPanel).
 */

// sizes, as fractions of the canvas's shorter side unless marked px
const RING_RADIUS_FRACTION = 0.17;
const SPOKE_MAX_LENGTH_FRACTION = 0.3;
const SPOKE_MIN_LENGTH_PX = 3;
const SPOKE_WIDTH_PX = 5;
const CORE_MIN_RADIUS_FRACTION = 0.04;
const CORE_BASS_RADIUS_FRACTION = 0.09;
const CORE_PULSE_RADIUS_FRACTION = 0.03;
const SPARK_SIZE_PX = 4;

// spokes fall slower than the bars view's, so the halo breathes rather than flickers
const SPOKE_FALL_PER_S = 1.2;
const SPOKE_CAP_FALL_PER_S = 0.4;

// how much of the last frame fades each frame (at 60 fps; scaled for other rates), so
// everything that moves leaves a trail
const TRAIL_FADE_PER_FRAME = 0.12;
const REFERENCE_FPS = 60;

// the halo turns slowly, and spins up on each beat
const SPIN_RAD_PER_S = 0.07;
const SPIN_BEAT_BOOST_RAD_PER_S = 0.8;

const SPARKS_PER_BEAT = 48;
const MAX_SPARKS = 900;
const SPARK_MIN_SPEED_FRACTION_PER_S = 0.2;
const SPARK_MAX_SPEED_FRACTION_PER_S = 0.55;
const SPARK_LIFE_S = 1.8;

const BASS_MAX_HZ = 150;
const HUE_STEP_PER_BEAT_DEG = 33;
// how far apart the spoke colours run, and the sparks from the spokes
const HUE_SPREAD_DEG = 90;
const SPARK_HUE_OFFSET_DEG = 180;
const SATURATION_PCT = 95;
const SPOKE_LIGHTNESS_PCT = 55;
const SPARK_LIGHTNESS_PCT = 65;
const CORE_LIGHTNESS_PCT = 70;
const BACKGROUND_RGB = "0, 0, 0";

/** One spark thrown out on a beat. Positions are relative to the centre, px. */
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageS: number;
  hueDeg: number;
}

/** The view's animation state. */
interface HaloState {
  levels: SpectrumLevels;
  beats: BeatCounter;
  hueDeg: number;
  spinRad: number;
  sparks: Spark[];
}

/**
 * Throws a burst of sparks out from the ring.
 * @param state - State, updated in place.
 * @param ringRadius - Where they start, px from the centre.
 * @param size - The canvas's shorter side, px (sets their speed).
 */
function throwSparks(state: HaloState, ringRadius: number, size: number): void {
  for (let i = 0; i < SPARKS_PER_BEAT; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const speedFraction =
      SPARK_MIN_SPEED_FRACTION_PER_S + Math.random() * (SPARK_MAX_SPEED_FRACTION_PER_S - SPARK_MIN_SPEED_FRACTION_PER_S);
    state.sparks.push({
      x: Math.cos(angle) * ringRadius,
      y: Math.sin(angle) * ringRadius,
      vx: Math.cos(angle) * speedFraction * size,
      vy: Math.sin(angle) * speedFraction * size,
      ageS: 0,
      hueDeg: state.hueDeg + SPARK_HUE_OFFSET_DEG,
    });
  }
  // the oldest go first when there are too many
  state.sparks.splice(0, Math.max(0, state.sparks.length - MAX_SPARKS));
}

/**
 * Moves the sparks on and draws them, dropping any that have burnt out.
 * @param ctx - Canvas context, origin at the centre.
 * @param state - State, updated in place.
 * @param dtS - Seconds since the last frame.
 */
function drawSparks(ctx: CanvasRenderingContext2D, state: HaloState, dtS: number): void {
  state.sparks = state.sparks.filter((spark) => spark.ageS < SPARK_LIFE_S);
  for (const spark of state.sparks) {
    spark.ageS += dtS;
    spark.x += spark.vx * dtS;
    spark.y += spark.vy * dtS;
    const alpha = Math.max(0, 1 - spark.ageS / SPARK_LIFE_S);
    ctx.fillStyle = `hsla(${spark.hueDeg}, ${SATURATION_PCT}%, ${SPARK_LIGHTNESS_PCT}%, ${alpha})`;
    ctx.fillRect(spark.x - SPARK_SIZE_PX / 2, spark.y - SPARK_SIZE_PX / 2, SPARK_SIZE_PX, SPARK_SIZE_PX);
  }
}

/**
 * Draws the halo of spokes, one per band on each side.
 * @param ctx - Canvas context, origin at the centre.
 * @param state - State.
 * @param ringRadius - Where the spokes start, px.
 * @param maxLength - A full-height spoke's length, px.
 */
function drawSpokes(ctx: CanvasRenderingContext2D, state: HaloState, ringRadius: number, maxLength: number): void {
  const heights = state.levels.heights;
  const count = heights.length;
  ctx.lineWidth = SPOKE_WIDTH_PX;
  ctx.lineCap = "round";
  for (let i = 0; i < count; i++) {
    const length = Math.max(SPOKE_MIN_LENGTH_PX, heights[i] * maxLength);
    // band i sits i/count of the way round each half, starting from the top
    const sweep = (i / count) * Math.PI;
    ctx.strokeStyle = `hsl(${state.hueDeg + (i / count) * HUE_SPREAD_DEG}, ${SATURATION_PCT}%, ${SPOKE_LIGHTNESS_PCT}%)`;
    for (const angle of [state.spinRad - Math.PI / 2 + sweep, state.spinRad - Math.PI / 2 - sweep]) {
      const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
      ctx.beginPath();
      ctx.moveTo(dx * ringRadius, dy * ringRadius);
      ctx.lineTo(dx * (ringRadius + length), dy * (ringRadius + length));
      ctx.stroke();
    }
  }
}

/**
 * Draws the glowing core.
 * @param ctx - Canvas context, origin at the centre.
 * @param hueDeg - Current hue.
 * @param radius - Core radius, px.
 */
function drawCore(ctx: CanvasRenderingContext2D, hueDeg: number, radius: number): void {
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  glow.addColorStop(0, `hsla(${hueDeg}, ${SATURATION_PCT}%, ${CORE_LIGHTNESS_PCT}%, 1)`);
  glow.addColorStop(1, `hsla(${hueDeg}, ${SATURATION_PCT}%, ${CORE_LIGHTNESS_PCT}%, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, 2 * Math.PI);
  ctx.fill();
}

export default function BpmHalo({ stream }: { stream: BpmStream }) {
  const { config, framesRef, tempoRef } = stream;
  const stateRef = useRef<HaloState>({
    levels: createSpectrumLevels(),
    beats: { count: 0, lastPhase: null },
    hueDeg: 0,
    spinRad: 0,
    sparks: [],
  });

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, dtS: number) => {
      const state = stateRef.current;
      const nowMs = Date.now();
      const size = Math.min(width, height);
      const ringRadius = size * RING_RADIUS_FRACTION;
      const latest = framesRef.current?.at(-1);
      if (latest) updateSpectrumLevels(state.levels, latest.bands, dtS, SPOKE_FALL_PER_S, SPOKE_CAP_FALL_PER_S);
      const bass = latest && config ? bandRangeLevel(latest, config, 0, BASS_MAX_HZ) : 0;

      const phase = beatPhase(tempoRef.current, nowMs);
      const isNewBeat = countBeat(state.beats, phase);
      const pulse = beatPulse(tempoRef.current, nowMs);
      state.hueDeg = nextBeatHue(state.hueDeg, isNewBeat, phase !== null, HUE_STEP_PER_BEAT_DEG, dtS);
      state.spinRad += (SPIN_RAD_PER_S + SPIN_BEAT_BOOST_RAD_PER_S * pulse) * dtS;
      if (isNewBeat) throwSparks(state, ringRadius, size);

      const fade = 1 - Math.pow(1 - TRAIL_FADE_PER_FRAME, dtS * REFERENCE_FPS);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(${BACKGROUND_RGB}, ${fade})`;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(width / 2, height / 2);
      // overlapping light adds up, like light does
      ctx.globalCompositeOperation = "lighter";
      drawSpokes(ctx, state, ringRadius, size * SPOKE_MAX_LENGTH_FRACTION);
      drawSparks(ctx, state, dtS);
      const coreRadius =
        size * (CORE_MIN_RADIUS_FRACTION + CORE_BASS_RADIUS_FRACTION * bass + CORE_PULSE_RADIUS_FRACTION * pulse);
      drawCore(ctx, state.hueDeg, coreRadius);
      ctx.restore();
    },
    [config, framesRef, tempoRef]
  );
  const canvasRef = useCanvasLoop(draw);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
