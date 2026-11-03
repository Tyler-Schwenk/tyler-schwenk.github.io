"use client";

import { useMemo, useState } from "react";
import type { KilnCurvePoint } from "@/app/kiln/kilnApi";
import { rateAround, splitIntoRuns, toChartPoints, type ChartPoint } from "@/app/kiln/kilnCurve";
import { formatDateTime, formatDuration, formatRate, formatTemp, NO_VALUE } from "@/app/kiln/kilnFormat";

const MINUTE_MS = 60_000;
const INTERVALS_MIN = [15, 30, 60];
const DEFAULT_INTERVAL_MIN = 30;
const CSV_MIME_TYPE = "text/csv;charset=utf-8";
const FAHRENHEIT_PER_CELSIUS = 1.8;

/** one row in the table. */
type Row = { point: ChartPoint; elapsedMs: number; rateC: number | null; isPeak: boolean };

/**
 * picks one point per interval, on round local clock times like the top of each hour. a fault
 * in an interval only shows if nothing in it has a temperature.
 *
 * @param {ChartPoint[]} points - the curve, oldest first.
 * @param {number} intervalMin - minutes between rows.
 * @returns {ChartPoint[]} the first point of each interval, oldest first.
 */
function sampleByInterval(points: ChartPoint[], intervalMin: number): ChartPoint[] {
  const intervalMs = intervalMin * MINUTE_MS;
  const offsetMs = points.length > 0 ? new Date(points[0].timeMs).getTimezoneOffset() * MINUTE_MS : 0;
  const byInterval = new Map<number, ChartPoint>();
  for (const point of points) {
    const key = Math.floor((point.timeMs - offsetMs) / intervalMs);
    const existing = byInterval.get(key);
    if (!existing || (existing.value === null && point.value !== null)) byInterval.set(key, point);
  }
  return [...byInterval.values()];
}

/**
 * saves the whole curve as a csv file, for looking at in a spreadsheet.
 *
 * @param {ChartPoint[]} points - the curve.
 * @param {ChartPoint[][]} runs - the curve's connected runs, for the rates.
 * @param {number} firingId - which firing, for the file name.
 */
function downloadCsv(points: ChartPoint[], runs: ChartPoint[][], firingId: number): void {
  const startMs = points[0]?.timeMs ?? 0;
  const rows = points.map((point) => {
    const rateC = point.value === null ? null : rateAround(runs, point);
    return [
      new Date(point.timeMs).toISOString(),
      Math.round((point.timeMs - startMs) / MINUTE_MS),
      point.value === null ? "" : point.value.toFixed(1),
      rateC === null ? "" : (rateC * FAHRENHEIT_PER_CELSIUS).toFixed(0),
    ].join(",");
  });
  const csv = ["time_utc,minutes_since_start,temp_f,rate_f_per_hr", ...rows].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: CSV_MIME_TYPE }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `kiln-firing-${firingId}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * a firing's readings as a table: one row per interval, with time since the start and the rate
 * at that point. the interval and sort order are adjustable, and the header stays put on scroll.
 *
 * @param {object} props - component props.
 * @param {KilnCurvePoint[]} props.points - the curve, oldest first.
 * @param {number} props.bucketS - how much time each point covers.
 * @param {number} props.firingId - which firing this is, for the csv's name.
 * @returns {JSX.Element} the table, collapsed to start.
 */
export default function ReadingsTable({
  points,
  bucketS,
  firingId,
}: {
  points: KilnCurvePoint[];
  bucketS: number;
  firingId: number;
}) {
  const [intervalMin, setIntervalMin] = useState(DEFAULT_INTERVAL_MIN);
  const [newestFirst, setNewestFirst] = useState(true);

  const chartPoints = useMemo(() => toChartPoints(points), [points]);
  const runs = useMemo(() => splitIntoRuns(chartPoints, bucketS), [chartPoints, bucketS]);
  const rows = useMemo<Row[]>(() => {
    const peakValue = Math.max(...chartPoints.map((point) => point.value ?? -Infinity));
    const startMs = chartPoints[0]?.timeMs ?? 0;
    const sampled = sampleByInterval(chartPoints, intervalMin);
    const peakPoint = chartPoints.find((point) => point.value === peakValue);
    // the true peak rarely lands on an interval's first point, so it goes in as its own row
    const withPeak = peakPoint && !sampled.includes(peakPoint) ? [...sampled, peakPoint].sort((a, b) => a.timeMs - b.timeMs) : sampled;
    return withPeak.map((point) => ({
      point,
      elapsedMs: point.timeMs - startMs,
      rateC: point.value === null ? null : rateAround(runs, point),
      isPeak: point === peakPoint,
    }));
  }, [chartPoints, runs, intervalMin]);
  const shownRows = newestFirst ? [...rows].reverse() : rows;

  return (
    <details className="kiln-table">
      <summary>View as table</summary>
      <div className="kiln-table-controls">
        <div className="kiln-chips" role="group" aria-label="Time between rows">
          {INTERVALS_MIN.map((minutes) => (
            <button key={minutes} type="button" aria-pressed={intervalMin === minutes} onClick={() => setIntervalMin(minutes)}>
              {minutes === 60 ? "1 hr" : `${minutes} min`}
            </button>
          ))}
        </div>
        <div className="kiln-table-actions">
          <button type="button" onClick={() => setNewestFirst(!newestFirst)}>
            {newestFirst ? "Newest first" : "Oldest first"}
          </button>
          <button type="button" onClick={() => downloadCsv(chartPoints, runs, firingId)}>
            Download CSV
          </button>
        </div>
      </div>
      {/* scrolls by itself, so a long firing doesn't push the rest of the page away */}
      <div className="kiln-table-scroll" tabIndex={0} role="region" aria-label="Readings">
        <table>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col" className="kiln-table-elapsed">
                Since start
              </th>
              <th scope="col" className="kiln-table-number">
                Temperature
              </th>
              <th scope="col" className="kiln-table-number">
                Rate
              </th>
            </tr>
          </thead>
          <tbody>
            {shownRows.map(({ point, elapsedMs, rateC, isPeak }) => (
              <tr key={point.timeMs} className={isPeak ? "kiln-table-peak" : undefined}>
                <td>{formatDateTime(point.timeMs)}</td>
                <td className="kiln-table-elapsed">{formatDuration(elapsedMs)}</td>
                <td className="kiln-table-number">
                  {point.tempC === null ? "Probe out" : formatTemp(point.tempC)}
                  {isPeak && <span className="kiln-table-tag">Peak</span>}
                </td>
                <td className="kiln-table-number">{point.tempC === null ? NO_VALUE : formatRate(rateC)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
