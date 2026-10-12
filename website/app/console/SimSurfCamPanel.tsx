"use client";

import { useCallback, useRef } from "react";
import { useCanvasLoop } from "../display/useCanvasLoop";
import type { SurfCamId, SurfConditions } from "../display/surfCams";
import { simulateSurfConditions } from "./simSurf";

/**
 * The console page's stand-in for a live surf cam: the real streams can't play
 * outside the kiosk, so this draws a little animated scene of the spot (a
 * beach with swell rolling in, or the pier's piling underwater) with the
 * agent's info overlay on top, laid out like build_overlay_ass in
 * pi/services/surfcam-agent/surfcam_agent.py. Scenes are drawn at
 * SCENE_FPS to stay cheap on phones.
 * @param props.camId - Which cam.
 */

// the overlay is laid out in mpv's osd units and scaled to the screen, like the agent's
const OSD_WIDTH = 1920;
const OSD_HEIGHT = 1080;
const OSD_MARGIN = 48;
const OSD_NAME_FONT = 72;
const OSD_METRIC_FONT = 34;
const OSD_SOURCE_FONT = 24;
const OSD_METRIC_LINE = 42;
const OSD_BAR_MIN_HEIGHT = 120;
const OSD_BAR_PADDING = 28;
// ass alpha &H70& is ~44% transparent
const OSD_BAR_OPACITY = 0.56;
const OSD_SOURCE_COLOR = "#cccccc";
const OSD_NAME_OUTLINE = 3;
const OSD_METRIC_OUTLINE = 2;
// the agent notes gusts when they're this far above the wind
const GUST_NOTE_MIN_MPH = 5;

const SCENE_FPS = 30;
const SWELL_LINES = 9;
// share of the swell's run toward the beach covered per second
const SWELL_SPEED = 0.06;
// where the swell starts breaking, as a share of its run
const BREAK_START = 0.72;
const HORIZON = 0.38;
const SHORE = 0.82;
const WASH_AMPLITUDE = 0.02;
const WASH_PERIOD_S = 7;
const UNDERWATER_PARTICLES = 90;
const UNDERWATER_RAYS = 6;
const RAY_SWAY_PERIOD_S = 9;
const FISH_COUNT = 5;

/** What's in a cam's view. */
interface SceneStyle {
  underwater?: boolean;
  /** A headland on the horizon (la jolla, seen from the north side). */
  headland?: boolean;
  /** The pier running out to sea. */
  pier?: boolean;
}

const SCENES: Record<SurfCamId, SceneStyle> = {
  pb: {},
  "la-jolla-shores": { headland: true },
  scripps: { pier: true, headland: true },
  "scripps-underwater": { underwater: true },
  moonlight: {},
};

/** One line of the overlay, with the grey "(from ...)" tag when the reading isn't local. */
interface OverlayLine {
  text: string;
  source?: string | null;
}

/**
 * The overlay's reading lines, worded like the agent's get_metrics.
 * @param conditions - The readings.
 * @returns Lines, top to bottom.
 */
function overlayLines(conditions: SurfConditions): OverlayLine[] {
  const { waves, wind, tide } = conditions;
  const lines: OverlayLine[] = [];
  if (waves) lines.push({ text: `Waves ${waves.height_ft.toFixed(1)} ft at ${waves.period_s.toFixed(0)} s from ${waves.direction_compass}` });
  if (wind) {
    const gusts = wind.gusts_mph !== null && wind.gusts_mph - wind.speed_mph >= GUST_NOTE_MIN_MPH ? ` (gusts ${wind.gusts_mph.toFixed(0)})` : "";
    lines.push({ text: `Wind ${wind.speed_mph.toFixed(0)} mph from ${wind.direction_compass}${gusts}` });
  }
  if (tide) {
    const direction = tide.rising ? "rising" : "falling";
    lines.push({ text: `Tide ${tide.height_ft.toFixed(1)} ft ${direction}, ${tide.next_turn_kind} at ${tide.next_turn_at}`, source: tide.source });
  }
  return lines;
}

/**
 * The agent's info bar: place name top left, readings top right, over a translucent strip.
 * @param props.conditions - What to show.
 */
function CamOverlay({ conditions }: { conditions: SurfConditions }) {
  const lines = overlayLines(conditions);
  const barHeight = Math.max(OSD_BAR_MIN_HEIGHT, OSD_BAR_PADDING + OSD_METRIC_LINE * lines.length);
  const centerY = barHeight / 2;
  const firstLineY = centerY - ((lines.length - 1) * OSD_METRIC_LINE) / 2;
  const outline = { stroke: "black", paintOrder: "stroke" as const, strokeLinejoin: "round" as const };
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${OSD_WIDTH} ${OSD_HEIGHT}`} fontFamily="sans-serif">
      <rect width={OSD_WIDTH} height={barHeight} fill="black" opacity={OSD_BAR_OPACITY} />
      <text x={OSD_MARGIN} y={centerY} dominantBaseline="central" fontSize={OSD_NAME_FONT} fontWeight="bold" fill="white" strokeWidth={OSD_NAME_OUTLINE * 2} {...outline}>
        {conditions.name}
      </text>
      {lines.map((line, i) => (
        <text
          key={line.text}
          x={OSD_WIDTH - OSD_MARGIN}
          y={firstLineY + i * OSD_METRIC_LINE}
          dominantBaseline="central"
          textAnchor="end"
          fontSize={OSD_METRIC_FONT}
          fill="white"
          strokeWidth={OSD_METRIC_OUTLINE * 2}
          {...outline}
        >
          {line.text}
          {line.source && (
            <tspan fontSize={OSD_SOURCE_FONT} fill={OSD_SOURCE_COLOR}>
              {` (from ${line.source})`}
            </tspan>
          )}
        </text>
      ))}
    </svg>
  );
}

/**
 * Draws a beach view: sky, headland, sea with swell lines rolling in and breaking, the pier, the sand.
 * @param ctx - Canvas.
 * @param width - Canvas width.
 * @param height - Canvas height.
 * @param timeS - Scene time.
 * @param style - What's in view.
 */
function drawBeach(ctx: CanvasRenderingContext2D, width: number, height: number, timeS: number, style: SceneStyle) {
  const horizonY = height * HORIZON;
  const washY = height * (SHORE + WASH_AMPLITUDE * Math.sin((2 * Math.PI * timeS) / WASH_PERIOD_S));
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, "#7fb6de");
  sky.addColorStop(1, "#dbe9f0");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizonY);
  if (style.headland) {
    ctx.fillStyle = "#6f8a8f";
    ctx.beginPath();
    ctx.moveTo(width * 0.55, horizonY);
    ctx.quadraticCurveTo(width * 0.8, horizonY - height * 0.07, width, horizonY - height * 0.05);
    ctx.lineTo(width, horizonY);
    ctx.fill();
  }
  const sea = ctx.createLinearGradient(0, horizonY, 0, washY);
  sea.addColorStop(0, "#3c6c8a");
  sea.addColorStop(1, "#4e94a8");
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizonY, width, washY - horizonY);

  for (let i = 0; i < SWELL_LINES; i++) {
    const run = (i / SWELL_LINES + timeS * SWELL_SPEED) % 1;
    // perspective: lines bunch up toward the horizon
    const y = horizonY + (washY - horizonY) * run * run;
    const breaking = Math.max(0, (run - BREAK_START) / (1 - BREAK_START));
    ctx.strokeStyle = breaking > 0 ? `rgba(255,255,255,${0.35 + 0.5 * breaking})` : "rgba(20,50,70,0.35)";
    ctx.lineWidth = 2 + run * height * (breaking > 0 ? 0.03 : 0.006);
    ctx.beginPath();
    for (let x = 0; x <= width; x += width / 32) {
      const wobble = Math.sin(x / (width * 0.07) + i * 1.7 + timeS * 0.6) * run * height * 0.006;
      if (x === 0) ctx.moveTo(x, y + wobble);
      else ctx.lineTo(x, y + wobble);
    }
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(0, washY - height * 0.008, width, height * 0.016);
  const sand = ctx.createLinearGradient(0, washY, 0, height);
  sand.addColorStop(0, "#b9a27c");
  sand.addColorStop(1, "#d8c49d");
  ctx.fillStyle = sand;
  ctx.fillRect(0, washY + height * 0.008, width, height);
  if (style.pier) drawPier(ctx, width, height, horizonY);
}

/**
 * The pier running from the left edge out toward the horizon.
 * @param ctx - Canvas.
 * @param width - Canvas width.
 * @param height - Canvas height.
 * @param horizonY - Horizon, px.
 */
function drawPier(ctx: CanvasRenderingContext2D, width: number, height: number, horizonY: number) {
  const deckNear = { x: 0, y: height * 0.5 };
  const deckFar = { x: width * 0.42, y: horizonY + height * 0.015 };
  ctx.strokeStyle = "#3b3b3b";
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = deckNear.x + (deckFar.x - deckNear.x) * t;
    const y = deckNear.y + (deckFar.y - deckNear.y) * t;
    ctx.lineWidth = Math.max(2, (1 - t) * width * 0.008);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + (1 - t) * height * 0.32 + height * 0.01);
    ctx.stroke();
  }
  ctx.lineWidth = height * 0.02;
  ctx.strokeStyle = "#5a554e";
  ctx.beginPath();
  ctx.moveTo(deckNear.x, deckNear.y);
  ctx.lineTo(deckFar.x, deckFar.y);
  ctx.stroke();
}

/**
 * Draws the underwater view: blue water, swaying light rays, the barnacled piling, fish, drifting specks.
 * @param ctx - Canvas.
 * @param width - Canvas width.
 * @param height - Canvas height.
 * @param timeS - Scene time.
 */
function drawUnderwater(ctx: CanvasRenderingContext2D, width: number, height: number, timeS: number) {
  const water = ctx.createLinearGradient(0, 0, 0, height);
  water.addColorStop(0, "#2f7e8f");
  water.addColorStop(1, "#0c2c3a");
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < UNDERWATER_RAYS; i++) {
    const sway = Math.sin((2 * Math.PI * timeS) / RAY_SWAY_PERIOD_S + i) * width * 0.03;
    const x = width * (0.1 + (i / UNDERWATER_RAYS) * 0.8) + sway;
    ctx.fillStyle = "rgba(200,240,255,0.05)";
    ctx.beginPath();
    ctx.moveTo(x - width * 0.02, 0);
    ctx.lineTo(x + width * 0.02, 0);
    ctx.lineTo(x + width * 0.12, height);
    ctx.lineTo(x + width * 0.04, height);
    ctx.fill();
  }

  ctx.fillStyle = "#1d2b2a";
  ctx.fillRect(width * 0.58, 0, width * 0.14, height);
  ctx.fillStyle = "#4d5a3f";
  for (let i = 0; i < 40; i++) {
    const x = width * 0.58 + ((i * 37) % 100) / 100 * width * 0.14;
    const y = ((i * 61) % 100) / 100 * height;
    ctx.beginPath();
    ctx.arc(x, y, height * 0.012, 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(10,30,35,0.8)";
  for (let i = 0; i < FISH_COUNT; i++) {
    const x = ((timeS * 40 * (1 + i * 0.3) + i * 500) % (width + 200)) - 100;
    const y = height * (0.25 + 0.12 * i) + Math.sin(timeS + i) * height * 0.02;
    ctx.beginPath();
    ctx.ellipse(x, y, width * 0.025, height * 0.012, 0, 0, 2 * Math.PI);
    ctx.moveTo(x - width * 0.025, y);
    ctx.lineTo(x - width * 0.04, y - height * 0.015);
    ctx.lineTo(x - width * 0.04, y + height * 0.015);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(220,240,240,0.35)";
  for (let i = 0; i < UNDERWATER_PARTICLES; i++) {
    const x = ((i * 97.3 + timeS * 12) % width + width) % width;
    const y = ((i * 53.1 - timeS * (8 + (i % 5) * 3)) % height + height) % height;
    ctx.fillRect(x, y, 3, 3);
  }
}

export default function SimSurfCamPanel({ camId }: { camId: SurfCamId }) {
  const style = SCENES[camId];
  const conditions = simulateSurfConditions(camId);
  const sceneRef = useRef({ timeS: 0, sinceDrawS: Infinity });

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, dtS: number) => {
      const scene = sceneRef.current;
      scene.timeS += dtS;
      scene.sinceDrawS += dtS;
      if (scene.sinceDrawS < 1 / SCENE_FPS) return;
      scene.sinceDrawS = 0;
      if (style.underwater) drawUnderwater(ctx, width, height, scene.timeS);
      else drawBeach(ctx, width, height, scene.timeS, style);
    },
    [style]
  );
  const canvasRef = useCanvasLoop(draw);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <CamOverlay conditions={conditions} />
    </div>
  );
}
