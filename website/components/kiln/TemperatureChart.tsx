"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KilnCurvePoint } from "@/app/kiln/kilnApi";
import { formatDateTime, formatTemp, toFahrenheit } from "@/app/kiln/kilnFormat";

const HEIGHT_PX = 460;
const HEIGHT_SMALL_PX = 300;
const SMALL_WIDTH_PX = 640;
const MARGIN_LEFT_PX = 56;
const MARGIN_RIGHT_PX = 16;
const MARGIN_TOP_PX = 16;
const MARGIN_BOTTOM_PX = 30;
const TARGET_Y_TICKS = 5;
const MIN_X_TICK_SPACING_PX = 72;
const TOOLTIP_WIDTH_PX = 170;
const TOOLTIP_OFFSET_PX = 14;
const END_DOT_RADIUS_PX = 4;
/** a jump past this many buckets between points is a hole in the data, not a slope. */
const GAP_BUCKETS = 3;
/** the shortest jump that counts as a hole. on a short firing a bucket is shorter than the
 * logger's 5 s between readings, so going by buckets alone would break the line at every point. */
const MIN_GAP_MS = 30_000;
/** how many rows the table view shows, so a long firing stays readable. */
const TABLE_ROWS = 24;
const NICE_STEP_MULTIPLES = [1, 2, 2.5, 5, 10];

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const X_TICK_STEPS_MS = [
  5 * MINUTE_MS,
  15 * MINUTE_MS,
  30 * MINUTE_MS,
  HOUR_MS,
  2 * HOUR_MS,
  3 * HOUR_MS,
  6 * HOUR_MS,
  12 * HOUR_MS,
  DAY_MS,
  2 * DAY_MS,
];

type ChartPoint = { timeMs: number; value: number | null; tempC: number | null };

/**
 * picks round y axis ticks covering a range.
 *
 * @param {number} min - lowest value to cover.
 * @param {number} max - highest value to cover.
 * @returns {number[]} the ticks, lowest first.
 */
function niceTicks(min: number, max: number): number[] {
  const rawStep = Math.max(max - min, 1) / TARGET_Y_TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const multiple = NICE_STEP_MULTIPLES.find((m) => m * magnitude >= rawStep) ?? 10;
  const step = multiple * magnitude;
  const ticks: number[] = [];
  for (let tick = Math.floor(min / step) * step; tick < max + step; tick += step) {
    ticks.push(tick);
  }
  return ticks;
}

/**
 * picks x axis ticks on round local times, like the top of each hour.
 *
 * @param {number} startMs - start of the range.
 * @param {number} endMs - end of the range.
 * @param {number} plotWidthPx - how wide the plot is.
 * @returns {{ ticks: number[]; stepMs: number }} the tick times, and the spacing between them.
 */
function timeTicks(startMs: number, endMs: number, plotWidthPx: number): { ticks: number[]; stepMs: number } {
  const maxTicks = Math.max(2, Math.floor(plotWidthPx / MIN_X_TICK_SPACING_PX));
  const stepMs =
    X_TICK_STEPS_MS.find((step) => (endMs - startMs) / step <= maxTicks) ?? X_TICK_STEPS_MS[X_TICK_STEPS_MS.length - 1];
  const utcOffsetMs = new Date(startMs).getTimezoneOffset() * MINUTE_MS;
  const ticks: number[] = [];
  const first = Math.ceil((startMs - utcOffsetMs) / stepMs) * stepMs + utcOffsetMs;
  for (let tick = first; tick <= endMs; tick += stepMs) {
    ticks.push(tick);
  }
  return { ticks, stepMs };
}

/**
 * formats an x axis tick. dates at day spacing or at midnight, otherwise the time.
 *
 * @param {number} tickMs - the tick's time.
 * @param {number} stepMs - the spacing between ticks.
 * @returns {string} the tick's label.
 */
function formatTick(tickMs: number, stepMs: number): string {
  const date = new Date(tickMs);
  const isMidnight = date.getHours() === 0 && date.getMinutes() === 0;
  if (stepMs >= DAY_MS || isMidnight) {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: date.getMinutes() ? "2-digit" : undefined });
}

/**
 * splits a curve into runs of connected points, breaking at faults and holes in the data.
 *
 * @param {ChartPoint[]} points - the curve.
 * @param {number} bucketS - how much time each point covers.
 * @returns {ChartPoint[][]} the runs to draw as separate lines.
 */
function splitIntoRuns(points: ChartPoint[], bucketS: number): ChartPoint[][] {
  const maxJumpMs = Math.max(bucketS * GAP_BUCKETS * 1000, MIN_GAP_MS);
  const runs: ChartPoint[][] = [];
  let run: ChartPoint[] = [];
  for (const point of points) {
    const previous = run[run.length - 1];
    if (point.value === null || (previous && point.timeMs - previous.timeMs > maxJumpMs)) {
      if (run.length > 0) runs.push(run);
      run = [];
    }
    if (point.value !== null) run.push(point);
  }
  if (run.length > 0) runs.push(run);
  return runs;
}

/**
 * a firing's temperature over time, as a line filling its container's width. hovering shows
 * a crosshair and the reading at that time, and a table view sits underneath.
 *
 * @param {object} props - component props.
 * @param {KilnCurvePoint[]} props.points - the curve, oldest first.
 * @param {number} props.bucketS - how much time each point covers.
 * @returns {JSX.Element} the chart.
 */
export default function TemperatureChart({ points, bucketS }: { points: KilnCurvePoint[]; bucketS: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widthPx, setWidthPx] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setWidthPx(entry.contentRect.width));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const chartPoints = useMemo<ChartPoint[]>(
    () =>
      points.map((point) => ({
        timeMs: new Date(point.recorded_at).getTime(),
        tempC: point.thermocouple_c,
        value: point.thermocouple_c === null ? null : toFahrenheit(point.thermocouple_c),
      })),
    [points],
  );

  const known = chartPoints.filter((point) => point.value !== null);
  const heightPx = widthPx < SMALL_WIDTH_PX ? HEIGHT_SMALL_PX : HEIGHT_PX;
  const plotWidthPx = Math.max(0, widthPx - MARGIN_LEFT_PX - MARGIN_RIGHT_PX);
  const plotHeightPx = heightPx - MARGIN_TOP_PX - MARGIN_BOTTOM_PX;
  const hasCurve = known.length >= 2 && widthPx > 0;

  const values = known.map((point) => point.value as number);
  const yTicks = hasCurve ? niceTicks(Math.min(...values), Math.max(...values)) : [];
  const yMin = yTicks[0] ?? 0;
  const yMax = yTicks[yTicks.length - 1] ?? 1;
  const startMs = chartPoints[0]?.timeMs ?? 0;
  const endMs = chartPoints[chartPoints.length - 1]?.timeMs ?? 1;
  const xFor = (timeMs: number) => MARGIN_LEFT_PX + ((timeMs - startMs) / Math.max(endMs - startMs, 1)) * plotWidthPx;
  const yFor = (value: number) => MARGIN_TOP_PX + (1 - (value - yMin) / Math.max(yMax - yMin, 1)) * plotHeightPx;
  const { ticks: xTicks, stepMs } = hasCurve ? timeTicks(startMs, endMs, plotWidthPx) : { ticks: [], stepMs: HOUR_MS };

  const runs = hasCurve ? splitIntoRuns(chartPoints, bucketS) : [];
  const toPath = (run: ChartPoint[]) =>
    run.map((p, i) => `${i ? "L" : "M"}${xFor(p.timeMs).toFixed(1)} ${yFor(p.value as number).toFixed(1)}`).join("");
  const baselineY = MARGIN_TOP_PX + plotHeightPx;
  const lastKnown = known[known.length - 1];
  const hovered = hoverIndex === null ? null : chartPoints[hoverIndex];
  const tableStep = Math.max(1, Math.ceil(known.length / TABLE_ROWS));

  /**
   * finds the point nearest the pointer.
   *
   * @param {React.PointerEvent<SVGSVGElement>} event - the pointer event.
   */
  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const timeMs = startMs + ((event.clientX - rect.left - MARGIN_LEFT_PX) / plotWidthPx) * (endMs - startMs);
    let nearest = 0;
    chartPoints.forEach((point, index) => {
      if (Math.abs(point.timeMs - timeMs) < Math.abs(chartPoints[nearest].timeMs - timeMs)) nearest = index;
    });
    setHoverIndex(nearest);
  };

  const hoverX = hovered ? xFor(hovered.timeMs) : 0;
  const flipTooltip = hoverX + TOOLTIP_OFFSET_PX + TOOLTIP_WIDTH_PX > widthPx;

  return (
    <div>
      <div ref={containerRef} className="kiln-chart" style={{ height: heightPx }}>
        {!hasCurve && widthPx > 0 && <p className="kiln-chart-empty">Waiting for enough readings to draw a curve.</p>}
        {hasCurve && (
          <svg
            width={widthPx}
            height={heightPx}
            role="img"
            aria-label={`Kiln temperature over time, ending at ${formatTemp(lastKnown.tempC)}. The same data is in the table below.`}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
            style={{ touchAction: "pan-y" }}
          >
            {yTicks.map((tick) => (
              <g key={tick}>
                <line x1={MARGIN_LEFT_PX} x2={widthPx - MARGIN_RIGHT_PX} y1={yFor(tick)} y2={yFor(tick)} className="kiln-grid" />
                <text x={MARGIN_LEFT_PX - 10} y={yFor(tick)} dy="0.32em" textAnchor="end" className="kiln-axis">
                  {tick.toLocaleString()}°
                </text>
              </g>
            ))}
            {xTicks.map((tick) => (
              <text key={tick} x={xFor(tick)} y={heightPx - 8} textAnchor="middle" className="kiln-axis">
                {formatTick(tick, stepMs)}
              </text>
            ))}
            {runs.map((run) => (
              <g key={run[0].timeMs}>
                <path
                  d={`${toPath(run)}L${xFor(run[run.length - 1].timeMs).toFixed(1)} ${baselineY}L${xFor(run[0].timeMs).toFixed(1)} ${baselineY}Z`}
                  className="kiln-area"
                />
                <path d={toPath(run)} className="kiln-line" />
              </g>
            ))}
            <circle
              cx={xFor(lastKnown.timeMs)}
              cy={yFor(lastKnown.value as number)}
              r={END_DOT_RADIUS_PX}
              className="kiln-dot"
            />
            {hovered && (
              <line x1={hoverX} x2={hoverX} y1={MARGIN_TOP_PX} y2={baselineY} className="kiln-crosshair" />
            )}
            {hovered && hovered.value !== null && (
              <circle cx={hoverX} cy={yFor(hovered.value)} r={END_DOT_RADIUS_PX} className="kiln-dot" />
            )}
          </svg>
        )}
        {hasCurve && hovered && (
          <div
            className="kiln-tooltip"
            style={{
              top: MARGIN_TOP_PX,
              left: flipTooltip ? hoverX - TOOLTIP_OFFSET_PX - TOOLTIP_WIDTH_PX : hoverX + TOOLTIP_OFFSET_PX,
              width: TOOLTIP_WIDTH_PX,
            }}
          >
            <div className="kiln-tooltip-value">{hovered.tempC === null ? "Probe fault" : formatTemp(hovered.tempC)}</div>
            <div className="kiln-tooltip-time">{formatDateTime(hovered.timeMs)}</div>
          </div>
        )}
      </div>

      {hasCurve && (
        <details className="kiln-table">
          <summary>View as table</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Temperature</th>
              </tr>
            </thead>
            <tbody>
              {known
                .filter((_, index) => index % tableStep === 0)
                .map((point) => (
                  <tr key={point.timeMs}>
                    <td>{formatDateTime(point.timeMs)}</td>
                    <td>{formatTemp(point.tempC)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
