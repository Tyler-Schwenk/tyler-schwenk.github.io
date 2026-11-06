"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KilnCurvePoint } from "@/app/kiln/kilnApi";
import {
  alignByStartTemp,
  maxJumpMs,
  nearestPoint,
  rateAround,
  splitIntoRuns,
  toChartPoints,
  type ChartPoint,
} from "@/app/kiln/kilnCurve";
import { formatDateTime, formatDuration, formatRate, formatTemp } from "@/app/kiln/kilnFormat";
import { seriesClass } from "./CompareFirings";

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
const TOOLTIP_COMPARE_WIDTH_PX = 250;
const TOOLTIP_OFFSET_PX = 14;
const END_DOT_RADIUS_PX = 4;
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

/** the main series' key. firing ids start at 1, so it can't clash with a comparison. */
const MAIN_SERIES_ID = 0;

/** another firing drawn over the main one. slot picks its color. */
export type ComparisonSeries = { id: number; label: string; slot: number; points: KilnCurvePoint[]; bucketS: number };

/** a line ready to draw. slot's null for the main firing. */
type Series = { key: string; label: string; slot: number | null; points: ChartPoint[]; runs: ChartPoint[][]; jumpMs: number };

/** a series' reading under the crosshair. point's null when that series has no data there. */
type HoverRow = { series: Series; point: ChartPoint | null };

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
 * picks x axis ticks on round values: round local times, or round lengths of time when the
 * axis is time since the start.
 *
 * @param {number} startMs - start of the range.
 * @param {number} endMs - end of the range.
 * @param {number} plotWidthPx - how wide the plot is.
 * @param {boolean} elapsed - the axis is time since the start rather than clock time.
 * @returns {{ ticks: number[]; stepMs: number }} the tick values, and the spacing between them.
 */
function timeTicks(
  startMs: number,
  endMs: number,
  plotWidthPx: number,
  elapsed: boolean,
): { ticks: number[]; stepMs: number } {
  const maxTicks = Math.max(2, Math.floor(plotWidthPx / MIN_X_TICK_SPACING_PX));
  const stepMs =
    X_TICK_STEPS_MS.find((step) => (endMs - startMs) / step <= maxTicks) ?? X_TICK_STEPS_MS[X_TICK_STEPS_MS.length - 1];
  // clock ticks land on local round times, so they shift by the timezone
  const offsetMs = elapsed ? 0 : new Date(startMs).getTimezoneOffset() * MINUTE_MS;
  const ticks: number[] = [];
  const first = Math.ceil((startMs - offsetMs) / stepMs) * stepMs + offsetMs;
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
 * formats an x axis tick when the axis is time since the start, like "6 hr".
 *
 * @param {number} tickMs - time since the start.
 * @returns {string} the tick's label.
 */
const formatElapsedTick = (tickMs: number): string => (tickMs === 0 ? "Start" : formatDuration(tickMs));

/**
 * builds the drawable lines: the main firing first, then any comparisons. with comparisons,
 * they're all lined up by starting temperature (see alignByStartTemp).
 *
 * @param {ComparisonSeries} main - the main firing, with a null slot.
 * @param {ComparisonSeries[]} comparisons - other firings to draw over it.
 * @returns {Series[]} the main series, then the comparisons in the order given.
 */
function buildSeries(
  main: Omit<ComparisonSeries, "slot"> & { slot: null },
  comparisons: ComparisonSeries[],
): Series[] {
  const inputs = [main, ...comparisons];
  const curves = inputs.map((input) => toChartPoints(input.points));
  const placed = comparisons.length > 0 ? alignByStartTemp(curves) : curves;
  return inputs.map((input, index) => ({
    key: String(input.id),
    label: input.label,
    slot: input.slot,
    points: placed[index],
    runs: splitIntoRuns(placed[index], input.bucketS),
    jumpMs: maxJumpMs(input.bucketS),
  }));
}

/**
 * one series' line in the comparison tooltip: its color, name, temperature and rate.
 *
 * @param {object} props - component props.
 * @param {HoverRow} props.row - the series and its reading under the crosshair.
 * @returns {JSX.Element} the row.
 */
function TooltipRow({ row }: { row: HoverRow }) {
  const { series, point } = row;
  let reading = "No data";
  if (point && point.tempC === null) reading = "Probe fault";
  if (point && point.tempC !== null) reading = `${formatTemp(point.tempC)}, ${formatRate(rateAround(series.runs, point))}`;
  return (
    <div className="kiln-tooltip-row">
      <span className={`kiln-swatch ${seriesClass(series.slot)}`} aria-hidden="true" />
      <span className="kiln-tooltip-label">{series.label}</span>
      <span>{reading}</span>
    </div>
  );
}

/**
 * a firing's temperature over time, as a line filling its container's width. hovering shows
 * a crosshair with the reading and rate of rise at that time.
 *
 * with comparisons, firings are lined up by temperature on the way up, so the x axis becomes
 * time since the coldest-starting one began, there's a legend, and the tooltip lists each
 * firing at that point.
 *
 * @param {object} props - component props.
 * @param {KilnCurvePoint[]} props.points - the main curve, oldest first.
 * @param {number} props.bucketS - how much time each main point covers.
 * @param {string} props.label - what the legend calls the main firing.
 * @param {ComparisonSeries[]} [props.comparisons] - other firings to draw over it.
 * @returns {JSX.Element} the chart.
 */
export default function TemperatureChart({
  points,
  bucketS,
  label,
  comparisons = [],
}: {
  points: KilnCurvePoint[];
  bucketS: number;
  label: string;
  comparisons?: ComparisonSeries[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widthPx, setWidthPx] = useState(0);
  const [hoverMs, setHoverMs] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setWidthPx(entry.contentRect.width));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const elapsed = comparisons.length > 0;
  const [main, ...others] = useMemo(
    () => buildSeries({ id: MAIN_SERIES_ID, label, slot: null, points, bucketS }, comparisons),
    [label, points, bucketS, comparisons],
  );
  // comparisons go underneath, so the main firing's line stays on top
  const allSeries = [...others, main];

  const known = main.points.filter((point) => point.value !== null);
  const heightPx = widthPx < SMALL_WIDTH_PX ? HEIGHT_SMALL_PX : HEIGHT_PX;
  const plotWidthPx = Math.max(0, widthPx - MARGIN_LEFT_PX - MARGIN_RIGHT_PX);
  const plotHeightPx = heightPx - MARGIN_TOP_PX - MARGIN_BOTTOM_PX;
  const hasCurve = known.length >= 2 && widthPx > 0;

  const values = allSeries.flatMap((series) => series.runs.flat().map((point) => point.value as number));
  const yTicks = hasCurve ? niceTicks(Math.min(...values), Math.max(...values)) : [];
  const yMin = yTicks[0] ?? 0;
  const yMax = yTicks[yTicks.length - 1] ?? 1;
  const startMs = elapsed ? 0 : (main.points[0]?.timeMs ?? 0);
  const endMs = Math.max(...allSeries.map((series) => series.points[series.points.length - 1]?.timeMs ?? 1));
  const xFor = (timeMs: number) => MARGIN_LEFT_PX + ((timeMs - startMs) / Math.max(endMs - startMs, 1)) * plotWidthPx;
  const yFor = (value: number) => MARGIN_TOP_PX + (1 - (value - yMin) / Math.max(yMax - yMin, 1)) * plotHeightPx;
  const { ticks: xTicks, stepMs } = hasCurve
    ? timeTicks(startMs, endMs, plotWidthPx, elapsed)
    : { ticks: [], stepMs: HOUR_MS };

  const toPath = (run: ChartPoint[]) =>
    run.map((p, i) => `${i ? "L" : "M"}${xFor(p.timeMs).toFixed(1)} ${yFor(p.value as number).toFixed(1)}`).join("");
  const baselineY = MARGIN_TOP_PX + plotHeightPx;
  const lastKnown = known[known.length - 1];
  // alone, the crosshair snaps to the nearest reading. comparing, it sits where the pointer is,
  // since firings have readings at different times and can run past the main one's end
  const hoverRows: HoverRow[] =
    hoverMs === null
      ? []
      : allSeries.map((series) => ({ series, point: nearestPoint(series.points, hoverMs, series.jumpMs) }));
  const hoverX = hoverMs === null ? 0 : xFor(hoverMs);
  const mainHovered = hoverRows.find((row) => row.series === main)?.point ?? null;
  const tooltipWidthPx = elapsed ? TOOLTIP_COMPARE_WIDTH_PX : TOOLTIP_WIDTH_PX;
  const flipTooltip = hoverX + TOOLTIP_OFFSET_PX + tooltipWidthPx > widthPx;
  // on a narrow screen neither side of the crosshair may fit, so keep it inside the chart
  const tooltipLeftPx = Math.max(
    0,
    Math.min(widthPx - tooltipWidthPx, flipTooltip ? hoverX - TOOLTIP_OFFSET_PX - tooltipWidthPx : hoverX + TOOLTIP_OFFSET_PX),
  );

  /**
   * moves the crosshair to the pointer.
   *
   * @param {React.PointerEvent<SVGSVGElement>} event - the pointer event.
   */
  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left - MARGIN_LEFT_PX) / plotWidthPx));
    const timeMs = startMs + fraction * (endMs - startMs);
    if (elapsed) {
      setHoverMs(timeMs);
      return;
    }
    setHoverMs(nearestPoint(main.points, timeMs, Infinity)?.timeMs ?? null);
  };

  const ariaLabel = elapsed
    ? `Kiln temperature by time since the start, for ${allSeries.map((series) => series.label).join(", ")}. Hover for each one's readings.`
    : `Kiln temperature over time, ending at ${formatTemp(lastKnown?.tempC ?? null)}. The same data is in the table below.`;

  return (
    <>
      {elapsed && (
        <ul className="kiln-legend">
          {[main, ...others].map((series) => (
            <li key={series.key}>
              <span className={`kiln-swatch ${seriesClass(series.slot)}`} aria-hidden="true" />
              {series.label}
            </li>
          ))}
        </ul>
      )}
      <div ref={containerRef} className="kiln-chart" style={{ height: heightPx }}>
        {!hasCurve && widthPx > 0 && <p className="kiln-chart-empty">Waiting for enough readings to draw a curve.</p>}
        {hasCurve && (
          <svg
            width={widthPx}
            height={heightPx}
            role="img"
            aria-label={ariaLabel}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverMs(null)}
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
                {elapsed ? formatElapsedTick(tick) : formatTick(tick, stepMs)}
              </text>
            ))}
            {main.runs.map((run) => (
              <path
                key={run[0].timeMs}
                d={`${toPath(run)}L${xFor(run[run.length - 1].timeMs).toFixed(1)} ${baselineY}L${xFor(run[0].timeMs).toFixed(1)} ${baselineY}Z`}
                className="kiln-area"
              />
            ))}
            {allSeries.map((series) => (
              <g key={series.key} className={seriesClass(series.slot)}>
                {series.runs.map((run) => (
                  <path key={run[0].timeMs} d={toPath(run)} className="kiln-line" />
                ))}
              </g>
            ))}
            <circle
              cx={xFor(lastKnown.timeMs)}
              cy={yFor(lastKnown.value as number)}
              r={END_DOT_RADIUS_PX}
              className={`kiln-dot ${seriesClass(null)}`}
            />
            {hoverMs !== null && (
              <line x1={hoverX} x2={hoverX} y1={MARGIN_TOP_PX} y2={baselineY} className="kiln-crosshair" />
            )}
            {hoverRows.map(({ series, point }) =>
              point && point.value !== null ? (
                <circle
                  key={series.key}
                  cx={xFor(point.timeMs)}
                  cy={yFor(point.value)}
                  r={END_DOT_RADIUS_PX}
                  className={`kiln-dot ${seriesClass(series.slot)}`}
                />
              ) : null,
            )}
          </svg>
        )}
        {hasCurve && hoverMs !== null && (
          <div
            className="kiln-tooltip"
            style={{
              top: MARGIN_TOP_PX,
              left: tooltipLeftPx,
              width: tooltipWidthPx,
            }}
          >
            {elapsed ? (
              <>
                <div className="kiln-tooltip-time">{formatDuration(hoverMs)} in</div>
                {[main, ...others].map((series) => (
                  <TooltipRow key={series.key} row={hoverRows.find((row) => row.series === series) as HoverRow} />
                ))}
              </>
            ) : (
              mainHovered && (
                <>
                  <div className="kiln-tooltip-value">
                    {mainHovered.tempC === null ? "Probe fault" : formatTemp(mainHovered.tempC)}
                  </div>
                  {mainHovered.tempC !== null && (
                    <div className="kiln-tooltip-rate">{formatRate(rateAround(main.runs, mainHovered))}</div>
                  )}
                  <div className="kiln-tooltip-time">{formatDateTime(mainHovered.timeMs)}</div>
                </>
              )
            )}
          </div>
        )}
      </div>
    </>
  );
}
