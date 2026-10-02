"use client";

import type { TidePoint, TideReading, TideTurn } from "./surfCams";

/**
 * A normal tide chart for the conditions panel: the predicted curve across the
 * window (past and future), the gauge's measured line over the past part, a
 * "now" marker, each high/low labelled with its time and height, and a time
 * axis. Drawn as one svg that stretches to its container's width.
 * @param props.tide - Tide reading with its curve, from the surfcam agent.
 */

// svg coordinate space; the svg scales it to fit, so these only set proportions
const GRAPH_WIDTH = 2000;
const GRAPH_HEIGHT = 520;
const PLOT_LEFT = 90;
const PLOT_RIGHT = GRAPH_WIDTH - 30;
const PLOT_TOP = 80;
const PLOT_BOTTOM = GRAPH_HEIGHT - 70;

// headroom above the highest and below the lowest point, so turn labels fit (ft)
const HEIGHT_PADDING_FT = 0.6;
// y-axis gridlines every this many feet
const HEIGHT_GRID_STEP_FT = 2;

// time-axis ticks fall on these local hours (midnight, 6am, noon, 6pm)
const TIME_TICK_EVERY_H = 6;
const HOUR_MS = 3_600_000;

const TURN_LABEL_OFFSET = 22;
// a high/low label this close to either end of the plot would run into the axis labels
const TURN_LABEL_EDGE_MARGIN = 110;
// a measured point within this long of a high/low counts as "at" it, for label placement
const TURN_OBSERVED_MATCH_MS = 30 * 60 * 1000;
const LABEL_FONT = 26;
const TURN_FONT = 24;
const NOW_DOT_RADIUS = 11;

// tailwind sky-400 / sky-400 at low opacity / white / gray-500 / gray-700
const PREDICTED_COLOR = "#38bdf8";
const PREDICTED_FILL = "rgba(56, 189, 248, 0.12)";
const OBSERVED_COLOR = "#ffffff";
const AXIS_LABEL_COLOR = "#6b7280";
const GRID_COLOR = "#374151";

/**
 * Maps time and height onto svg coordinates for one graph.
 * @param tide - The reading, for its window.
 * @param minFt - Bottom of the height range.
 * @param maxFt - Top of the height range.
 * @returns x and y mapping functions.
 */
function makeScales(tide: TideReading, minFt: number, maxFt: number) {
  const spanMs = tide.window_end_ms - tide.window_start_ms;
  return {
    x: (ms: number) => PLOT_LEFT + ((ms - tide.window_start_ms) / spanMs) * (PLOT_RIGHT - PLOT_LEFT),
    y: (ft: number) => PLOT_BOTTOM - ((ft - minFt) / (maxFt - minFt)) * (PLOT_BOTTOM - PLOT_TOP),
  };
}

/**
 * Svg path through a series of points.
 * @param points - [ms, ft] pairs in time order.
 * @param x - Time to svg x.
 * @param y - Height to svg y.
 * @returns A path `d` string (empty for no points).
 */
function linePath(points: TidePoint[], x: (ms: number) => number, y: (ft: number) => number): string {
  return points.map(([ms, ft], i) => `${i === 0 ? "M" : "L"}${x(ms).toFixed(1)},${y(ft).toFixed(1)}`).join(" ");
}

/**
 * Local times inside the window that fall on a TIME_TICK_EVERY_H hour boundary.
 * The kiosk runs in the cams' time zone, so local hours are the beach's hours.
 * @param startMs - Window start.
 * @param endMs - Window end.
 * @returns Tick times in epoch ms.
 */
function timeTicks(startMs: number, endMs: number): number[] {
  const first = new Date(startMs);
  first.setMinutes(0, 0, 0);
  const ticks = [];
  for (let ms = first.getTime(); ms <= endMs; ms += HOUR_MS) {
    if (ms >= startMs && new Date(ms).getHours() % TIME_TICK_EVERY_H === 0) ticks.push(ms);
  }
  return ticks;
}

/**
 * Formats a tick label: the weekday at midnight, otherwise the hour ("6 AM").
 * @param ms - Tick time.
 * @returns Label text.
 */
function tickLabel(ms: number): string {
  const date = new Date(ms);
  if (date.getHours() === 0) return date.toLocaleDateString("en-US", { weekday: "short" });
  return date.toLocaleTimeString("en-US", { hour: "numeric" });
}

/**
 * Where a high/low's label goes: above both lines for a high, below both for a low, so
 * it never sits on the measured line when that runs off the prediction.
 * @param turn - The high or low.
 * @param observed - Measured points, to keep clear of.
 * @returns Height (ft) to hang the label off.
 */
function turnLabelAnchorFt(turn: TideTurn, observed: TidePoint[]): number {
  const nearby = observed.filter(([ms]) => Math.abs(ms - turn.at_ms) <= TURN_OBSERVED_MATCH_MS).map(([, ft]) => ft);
  const pick = turn.kind === "high" ? Math.max : Math.min;
  return pick(turn.height_ft, ...nearby);
}

export default function TideGraph({ tide }: { tide: TideReading }) {
  const heights = [...tide.predicted, ...tide.observed].map(([, ft]) => ft);
  const minFt = Math.min(...heights) - HEIGHT_PADDING_FT;
  const maxFt = Math.max(...heights) + HEIGHT_PADDING_FT;
  const { x, y } = makeScales(tide, minFt, maxFt);
  const nowMs = tide.now_ms;

  const predictedPath = linePath(tide.predicted, x, y);
  const first = tide.predicted[0];
  const last = tide.predicted[tide.predicted.length - 1];
  const fillPath = first && last ? `${predictedPath} L${x(last[0])},${PLOT_BOTTOM} L${x(first[0])},${PLOT_BOTTOM} Z` : "";

  const isAwayFromEdges = (turn: TideTurn) =>
    x(turn.at_ms) - PLOT_LEFT >= TURN_LABEL_EDGE_MARGIN && PLOT_RIGHT - x(turn.at_ms) >= TURN_LABEL_EDGE_MARGIN;

  const gridFeet = [];
  for (let ft = Math.ceil(minFt / HEIGHT_GRID_STEP_FT) * HEIGHT_GRID_STEP_FT; ft <= maxFt; ft += HEIGHT_GRID_STEP_FT) {
    gridFeet.push(ft);
  }

  return (
    <svg viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`} className="w-full h-auto">
      {gridFeet.map((ft) => (
        <g key={ft}>
          <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y(ft)} y2={y(ft)} stroke={GRID_COLOR} strokeWidth={1} />
          <text x={PLOT_LEFT - 14} y={y(ft)} fontSize={LABEL_FONT} fill={AXIS_LABEL_COLOR} textAnchor="end" dominantBaseline="central">
            {ft} ft
          </text>
        </g>
      ))}
      {timeTicks(tide.window_start_ms, tide.window_end_ms).map((ms) => (
        <g key={ms}>
          <line x1={x(ms)} x2={x(ms)} y1={PLOT_TOP} y2={PLOT_BOTTOM} stroke={GRID_COLOR} strokeWidth={1} />
          <text x={x(ms)} y={PLOT_BOTTOM + 40} fontSize={LABEL_FONT} fill={AXIS_LABEL_COLOR} textAnchor="middle">
            {tickLabel(ms)}
          </text>
        </g>
      ))}
      <path d={fillPath} fill={PREDICTED_FILL} />
      <path d={predictedPath} fill="none" stroke={PREDICTED_COLOR} strokeWidth={4} />
      <path d={linePath(tide.observed, x, y)} fill="none" stroke={OBSERVED_COLOR} strokeWidth={5} />
      {tide.turns.filter(isAwayFromEdges).map((turn) => {
        const isHigh = turn.kind === "high";
        const anchorY = y(turnLabelAnchorFt(turn, tide.observed));
        const labelY = anchorY + (isHigh ? -TURN_LABEL_OFFSET : TURN_LABEL_OFFSET + TURN_FONT);
        return (
          <text key={turn.at_ms} x={x(turn.at_ms)} y={labelY} fontSize={TURN_FONT} fill={OBSERVED_COLOR} textAnchor="middle">
            {turn.height_ft.toFixed(1)} ft {turn.at}
          </text>
        );
      })}
      <line x1={x(nowMs)} x2={x(nowMs)} y1={PLOT_TOP} y2={PLOT_BOTTOM} stroke={OBSERVED_COLOR} strokeWidth={2} strokeDasharray="8 8" />
      <circle cx={x(nowMs)} cy={y(tide.height_ft)} r={NOW_DOT_RADIUS} fill={OBSERVED_COLOR} />
      <text x={x(nowMs)} y={PLOT_TOP - 24} fontSize={LABEL_FONT} fill={OBSERVED_COLOR} textAnchor="middle" fontWeight="bold">
        now
      </text>
    </svg>
  );
}
