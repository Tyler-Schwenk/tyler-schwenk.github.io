"use client";

import { useCallback, useRef } from "react";
import { beatPulse, FRAME_HISTORY_LENGTH, type BpmConfig, type BpmFrame, type BpmStream, type BpmTempo } from "./bpmAgent";
import { useCanvasLoop } from "./useCanvasLoop";

/**
 * The bpm calibration view: everything the agent hears, so it's clear why it
 * picks the tempo it does.
 * - spectrogram waterfall (newest on the right, low notes at the bottom) with
 *   the kick/bass band the beat tracker listens to marked
 * - that band's onset curve on the same time axis, with ticks where the
 *   tracker puts the beats
 * - a level meter with the silence threshold
 * - every tempo's score, so a half/double tempo mix-up is easy to see
 * - a flash on each beat as it's shown on screen: play a click track and nudge
 *   the offset (- / =) until the flash lands on the click
 * @param props.stream - The bpm agent stream (from BpmPanel).
 */

// layout, px
const PAD_PX = 48;
const HEADER_HEIGHT_PX = 200;
const SECTION_GAP_PX = 28;
const LABEL_HEIGHT_PX = 40;
const METER_WIDTH_PX = 56;
// fractions of the space below the header
const SPECTROGRAM_WIDTH_FRACTION = 0.64;
const SPECTROGRAM_HEIGHT_FRACTION = 0.68;
const FLASH_HEIGHT_FRACTION = 0.45;
const FLASH_MIN_RADIUS_FRACTION = 0.55;

const LABEL_FONT = "28px monospace";
const SMALL_LABEL_FONT = "22px monospace";
const LABEL_COLOR = "#9ca3af";
const FRAME_COLOR = "#374151";
const BACKGROUND_COLOR = "#000";
const ONSET_BAND_COLOR = "#22d3ee";
const ONSET_LINE_COLOR = "#f9fafb";
const ONSET_LINE_WIDTH_PX = 2;
const BEAT_TICK_COLOR = "rgba(250, 204, 21, 0.85)";
const BEAT_TICK_WIDTH_PX = 3;
const METER_FILL_COLOR = "#22c55e";
const METER_AVERAGE_COLOR = "#f9fafb";
const SILENCE_LINE_COLOR = "#ef4444";
const CURVE_FILL_COLOR = "rgba(96, 165, 250, 0.35)";
const CURVE_LINE_COLOR = "#60a5fa";
const CHOSEN_TEMPO_COLOR = "#facc15";
const FLASH_RING_COLOR = "#4b5563";
const FLASH_RING_WIDTH_PX = 4;
const BAND_LINE_DASH_PX = [12, 10];

const METER_MIN_DB = -90;
const METER_MAX_DB = 0;
const CURVE_AXIS_STEP_BPM = 20;
const MS_PER_S = 1000;

// spectrogram colours, quiet to loud: black through purple and orange to pale yellow
const COLOR_MAP_STOPS: [number, number, number][] = [
  [0, 0, 0],
  [45, 12, 90],
  [160, 35, 110],
  [245, 110, 40],
  [252, 240, 150],
];
const COLOR_MAP_LEVELS = 256;
const RGBA_CHANNELS = 4;
const OPAQUE_ALPHA = 255;

/** A screen rectangle. */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where each part of the view goes for a canvas size. */
interface Layout {
  spectrogram: Rect;
  onsets: Rect;
  meter: Rect;
  flash: Rect;
  curve: Rect;
}

/** The offscreen image the spectrogram is drawn into, one pixel per frame and band. */
interface SpectrogramImage {
  canvas: HTMLCanvasElement;
  image: ImageData;
}

/**
 * Interpolates the spectrogram palette.
 * @returns COLOR_MAP_LEVELS rgb triples.
 */
function buildColorMap(): [number, number, number][] {
  const segments = COLOR_MAP_STOPS.length - 1;
  return Array.from({ length: COLOR_MAP_LEVELS }, (_, level) => {
    const position = (level / (COLOR_MAP_LEVELS - 1)) * segments;
    const segment = Math.min(Math.floor(position), segments - 1);
    const t = position - segment;
    const [from, to] = [COLOR_MAP_STOPS[segment], COLOR_MAP_STOPS[segment + 1]];
    return [0, 1, 2].map((c) => Math.round(from[c] + (to[c] - from[c]) * t)) as [number, number, number];
  });
}

const COLOR_MAP = buildColorMap();

/**
 * Splits the canvas into the view's sections.
 * @param width - Canvas width.
 * @param height - Canvas height.
 * @returns Each section's rectangle.
 */
function computeLayout(width: number, height: number): Layout {
  const top = HEADER_HEIGHT_PX;
  const bodyHeight = height - top - PAD_PX;
  const leftWidth = width * SPECTROGRAM_WIDTH_FRACTION;
  const spectrogramHeight = bodyHeight * SPECTROGRAM_HEIGHT_FRACTION;
  const onsetTop = top + spectrogramHeight + SECTION_GAP_PX + LABEL_HEIGHT_PX;
  const meterX = PAD_PX + leftWidth + PAD_PX;
  const rightX = meterX + METER_WIDTH_PX + PAD_PX;
  const rightWidth = width - rightX - PAD_PX;
  const flashHeight = bodyHeight * FLASH_HEIGHT_FRACTION;
  const curveTop = top + flashHeight + SECTION_GAP_PX + LABEL_HEIGHT_PX;
  return {
    spectrogram: { x: PAD_PX, y: top, w: leftWidth, h: spectrogramHeight },
    onsets: { x: PAD_PX, y: onsetTop, w: leftWidth, h: height - PAD_PX - onsetTop },
    meter: { x: meterX, y: top, w: METER_WIDTH_PX, h: bodyHeight },
    flash: { x: rightX, y: top, w: rightWidth, h: flashHeight },
    curve: { x: rightX, y: curveTop, w: rightWidth, h: height - PAD_PX - curveTop - LABEL_HEIGHT_PX },
  };
}

/**
 * Draws a section's label just above it.
 * @param ctx - Canvas context.
 * @param rect - The section.
 * @param text - Label.
 */
function drawLabel(ctx: CanvasRenderingContext2D, rect: Rect, text: string): void {
  ctx.font = LABEL_FONT;
  ctx.fillStyle = LABEL_COLOR;
  ctx.textBaseline = "bottom";
  ctx.fillText(text, rect.x, rect.y - SECTION_GAP_PX / 2);
}

/**
 * Makes (or reuses) the offscreen spectrogram image for a band count.
 * @param current - The existing image, if any.
 * @param bandCount - Bands per frame.
 * @returns An image FRAME_HISTORY_LENGTH wide and bandCount tall.
 */
function spectrogramImage(current: SpectrogramImage | null, bandCount: number): SpectrogramImage {
  if (current && current.image.height === bandCount) return current;
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_HISTORY_LENGTH;
  canvas.height = bandCount;
  return { canvas, image: new ImageData(FRAME_HISTORY_LENGTH, bandCount) };
}

/**
 * Paints the frames into the offscreen image (newest column on the right, low bands at the bottom).
 * @param target - Offscreen image.
 * @param frames - Frames, oldest first.
 */
function paintSpectrogram(target: SpectrogramImage, frames: BpmFrame[]): void {
  const { data, width, height } = target.image;
  data.fill(0);
  const firstColumn = width - frames.length;
  frames.forEach((frame, i) => {
    for (let band = 0; band < height; band++) {
      const offset = ((height - 1 - band) * width + firstColumn + i) * RGBA_CHANNELS;
      const [r, g, b] = COLOR_MAP[frame.bands[band]];
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = OPAQUE_ALPHA;
    }
  });
  target.canvas.getContext("2d")?.putImageData(target.image, 0, 0);
}

/**
 * Where a frequency sits on the spectrogram's (log) frequency axis.
 * @param rect - Spectrogram section.
 * @param config - Stream config, for the band edges.
 * @param hz - Frequency.
 * @returns Its y coordinate.
 */
function frequencyY(rect: Rect, config: BpmConfig, hz: number): number {
  const edges = config.band_edges_hz;
  const fraction = Math.log(hz / edges[0]) / Math.log(edges[edges.length - 1] / edges[0]);
  return rect.y + rect.h * (1 - fraction);
}

/**
 * Draws the spectrogram and marks the onset band on it.
 * @param ctx - Canvas context.
 * @param rect - Spectrogram section.
 * @param image - Offscreen image, already painted.
 * @param config - Stream config.
 */
function drawSpectrogram(ctx: CanvasRenderingContext2D, rect: Rect, image: SpectrogramImage, config: BpmConfig): void {
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image.canvas, rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = ONSET_BAND_COLOR;
  ctx.setLineDash(BAND_LINE_DASH_PX);
  for (const hz of [config.onset_min_hz, config.onset_max_hz]) {
    const y = frequencyY(rect, config, hz);
    ctx.beginPath();
    ctx.moveTo(rect.x, y);
    ctx.lineTo(rect.x + rect.w, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.font = SMALL_LABEL_FONT;
  ctx.fillStyle = ONSET_BAND_COLOR;
  ctx.textBaseline = "bottom";
  ctx.fillText(`beat band ${config.onset_min_hz}-${config.onset_max_hz} Hz`, rect.x + PAD_PX / 2, frequencyY(rect, config, config.onset_max_hz));
  drawLabel(ctx, rect, "spectrogram (newest on the right)");
}

/**
 * Draws the onset curve and the tracker's beats (before the offset, so they
 * should sit on the onset peaks).
 * @param ctx - Canvas context.
 * @param rect - Onset section.
 * @param frames - Frames, oldest first.
 * @param tempo - Latest tempo, or null.
 * @param config - Stream config.
 */
function drawOnsets(ctx: CanvasRenderingContext2D, rect: Rect, frames: BpmFrame[], tempo: BpmTempo | null, config: BpmConfig): void {
  drawLabel(ctx, rect, "beat band onsets, yellow = detected beats");
  ctx.strokeStyle = FRAME_COLOR;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  if (frames.length === 0) return;
  const columnWidth = rect.w / FRAME_HISTORY_LENGTH;
  const endMs = frames[frames.length - 1].t_ms;
  const xForTime = (tMs: number) => rect.x + rect.w - ((endMs - tMs) / MS_PER_S) * config.frame_rate_hz * columnWidth;

  if (tempo?.beat_ms != null && tempo.period_ms != null) {
    const detectedBeatMs = tempo.beat_ms - tempo.offset_ms;
    const startMs = endMs - (FRAME_HISTORY_LENGTH / config.frame_rate_hz) * MS_PER_S;
    const firstBeat = Math.ceil((startMs - detectedBeatMs) / tempo.period_ms);
    ctx.strokeStyle = BEAT_TICK_COLOR;
    ctx.lineWidth = BEAT_TICK_WIDTH_PX;
    for (let t = detectedBeatMs + firstBeat * tempo.period_ms; t <= endMs; t += tempo.period_ms) {
      ctx.beginPath();
      ctx.moveTo(xForTime(t), rect.y);
      ctx.lineTo(xForTime(t), rect.y + rect.h);
      ctx.stroke();
    }
  }

  const peak = Math.max(...frames.map((frame) => frame.onset)) || 1;
  ctx.strokeStyle = ONSET_LINE_COLOR;
  ctx.lineWidth = ONSET_LINE_WIDTH_PX;
  ctx.beginPath();
  frames.forEach((frame, i) => {
    const x = xForTime(frame.t_ms);
    const y = rect.y + rect.h * (1 - frame.onset / peak);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

/**
 * Draws the level meter: this frame's level, the recent average, and the silence line.
 * @param ctx - Canvas context.
 * @param rect - Meter section.
 * @param frame - Latest frame, if any.
 * @param tempo - Latest tempo, or null (for the average).
 * @param config - Stream config.
 */
function drawMeter(ctx: CanvasRenderingContext2D, rect: Rect, frame: BpmFrame | undefined, tempo: BpmTempo | null, config: BpmConfig): void {
  const yForDb = (db: number) => {
    const clamped = Math.min(METER_MAX_DB, Math.max(METER_MIN_DB, db));
    return rect.y + rect.h * (1 - (clamped - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB));
  };
  ctx.strokeStyle = FRAME_COLOR;
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  if (frame) {
    const levelY = yForDb(frame.level_db);
    ctx.fillStyle = METER_FILL_COLOR;
    ctx.fillRect(rect.x, levelY, rect.w, rect.y + rect.h - levelY);
  }
  const lines: [number | undefined, string][] = [
    [tempo?.level_db, METER_AVERAGE_COLOR],
    [config.silence_db, SILENCE_LINE_COLOR],
  ];
  ctx.lineWidth = BEAT_TICK_WIDTH_PX;
  for (const [db, color] of lines) {
    if (db === undefined) continue;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(rect.x, yForDb(db));
    ctx.lineTo(rect.x + rect.w, yForDb(db));
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(rect.x - SECTION_GAP_PX / 2, rect.y + rect.h);
  ctx.rotate(-Math.PI / 2);
  ctx.font = SMALL_LABEL_FONT;
  ctx.fillStyle = LABEL_COLOR;
  ctx.textBaseline = "bottom";
  ctx.fillText("level (red = silence below)", 0, 0);
  ctx.restore();
}

/**
 * Draws the beat flash: a ring that fills on each beat as the screen shows it.
 * @param ctx - Canvas context.
 * @param rect - Flash section.
 * @param pulse - Beat pulse 0-1.
 */
function drawFlash(ctx: CanvasRenderingContext2D, rect: Rect, pulse: number): void {
  const radius = Math.min(rect.w, rect.h) / 2;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  ctx.strokeStyle = FLASH_RING_COLOR;
  ctx.lineWidth = FLASH_RING_WIDTH_PX;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
  ctx.stroke();
  if (pulse <= 0) return;
  ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * (FLASH_MIN_RADIUS_FRACTION + (1 - FLASH_MIN_RADIUS_FRACTION) * pulse), 0, 2 * Math.PI);
  ctx.fill();
}

/**
 * Draws every tempo's score, with the chosen tempo marked.
 * @param ctx - Canvas context.
 * @param rect - Curve section.
 * @param tempo - Latest tempo, or null.
 * @param config - Stream config.
 */
function drawTempoCurve(ctx: CanvasRenderingContext2D, rect: Rect, tempo: BpmTempo | null, config: BpmConfig): void {
  drawLabel(ctx, rect, "tempo scores");
  ctx.strokeStyle = FRAME_COLOR;
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  const curve = tempo?.curve ?? [];
  if (curve.length < 2) return;
  const maxBpm = config.curve_min_bpm + (curve.length - 1) * config.curve_step_bpm;
  const xForBpm = (bpm: number) => rect.x + (rect.w * (bpm - config.curve_min_bpm)) / (maxBpm - config.curve_min_bpm);
  const bottom = rect.y + rect.h;

  ctx.beginPath();
  ctx.moveTo(rect.x, bottom);
  curve.forEach((score, i) => ctx.lineTo(xForBpm(config.curve_min_bpm + i * config.curve_step_bpm), bottom - score * rect.h));
  ctx.lineTo(rect.x + rect.w, bottom);
  ctx.fillStyle = CURVE_FILL_COLOR;
  ctx.fill();
  ctx.strokeStyle = CURVE_LINE_COLOR;
  ctx.stroke();

  ctx.font = SMALL_LABEL_FONT;
  ctx.fillStyle = LABEL_COLOR;
  ctx.textBaseline = "top";
  const firstTick = Math.ceil(config.curve_min_bpm / CURVE_AXIS_STEP_BPM) * CURVE_AXIS_STEP_BPM;
  for (let bpm = firstTick; bpm <= maxBpm; bpm += CURVE_AXIS_STEP_BPM) {
    ctx.fillText(String(bpm), xForBpm(bpm), bottom + SECTION_GAP_PX / 2);
  }
  if (tempo?.bpm == null) return;
  ctx.strokeStyle = CHOSEN_TEMPO_COLOR;
  ctx.lineWidth = BEAT_TICK_WIDTH_PX;
  ctx.beginPath();
  ctx.moveTo(xForBpm(tempo.bpm), rect.y);
  ctx.lineTo(xForBpm(tempo.bpm), bottom);
  ctx.stroke();
}

/**
 * Formats a signed number of ms, like "+20 ms".
 * @param ms - Milliseconds.
 * @returns The text.
 */
function formatOffset(ms: number): string {
  return `${ms > 0 ? "+" : ""}${ms} ms`;
}

export default function BpmCalibration({ stream }: { stream: BpmStream }) {
  const { config, tempo, framesRef, tempoRef } = stream;
  const imageRef = useRef<SpectrogramImage | null>(null);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      ctx.fillStyle = BACKGROUND_COLOR;
      ctx.fillRect(0, 0, width, height);
      if (!config) return;
      const frames = framesRef.current ?? [];
      const latestTempo = tempoRef.current;
      const layout = computeLayout(width, height);
      const bandCount = config.band_edges_hz.length - 1;
      imageRef.current = spectrogramImage(imageRef.current, bandCount);
      paintSpectrogram(imageRef.current, frames);
      drawSpectrogram(ctx, layout.spectrogram, imageRef.current, config);
      drawOnsets(ctx, layout.onsets, frames, latestTempo, config);
      drawMeter(ctx, layout.meter, frames.at(-1), latestTempo, config);
      drawFlash(ctx, layout.flash, beatPulse(latestTempo, Date.now()));
      drawTempoCurve(ctx, layout.curve, latestTempo, config);
    },
    [config, framesRef, tempoRef]
  );
  const canvasRef = useCanvasLoop(draw);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden font-mono">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute top-8 left-12 right-12 flex items-start justify-between">
        <div>
          <div className="text-3xl text-gray-400 uppercase tracking-widest">BPM calibration</div>
          <div className="text-6xl font-bold text-white tabular-nums mt-2">
            {tempo?.bpm != null ? `${tempo.bpm.toFixed(1)} bpm` : "no beat"}
          </div>
        </div>
        <div className="text-3xl text-gray-300 text-right tabular-nums leading-relaxed">
          <div>confidence {tempo ? tempo.confidence.toFixed(2) : "--"}</div>
          <div>offset {tempo ? formatOffset(tempo.offset_ms) : "--"}</div>
          <div>
            level {tempo ? `${tempo.level_db.toFixed(0)} dB` : "--"}
            {config && ` (silent below ${config.silence_db} dB)`}
          </div>
        </div>
      </div>
      <div className="absolute bottom-4 right-12 text-2xl text-gray-500">
        - / = move the flash earlier / later &middot; b back to the visualizer
      </div>
    </div>
  );
}
