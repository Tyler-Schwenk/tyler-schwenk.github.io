import type { KilnCurvePoint } from "./kilnApi";
import { toFahrenheit } from "./kilnFormat";

/** a jump past this many buckets between points is a hole in the data, not a slope. */
const GAP_BUCKETS = 3;
/** the shortest jump that counts as a hole. on a short firing a bucket is shorter than the
 * logger's 5 s between readings, so going by buckets alone would break the line at every point. */
const MIN_GAP_MS = 30_000;
/** how far either side of a point its rate looks. readings 5 s apart are mostly noise. */
const RATE_HALF_WINDOW_MS = 10 * 60_000;
/** less data than this, right after a gap or at the very start, is too little to call a rate. */
const RATE_MIN_SPAN_MS = 2 * 60_000;
const MS_PER_HOUR = 3_600_000;

/** a curve point ready to use. value's in fahrenheit, and both temps are null on a probe fault. */
export type ChartPoint = { timeMs: number; value: number | null; tempC: number | null };

/**
 * converts a firing's curve from the api into chart points.
 *
 * @param {KilnCurvePoint[]} points - the curve, oldest first.
 * @returns {ChartPoint[]} the same points with parsed times and fahrenheit values.
 */
export const toChartPoints = (points: KilnCurvePoint[]): ChartPoint[] =>
  points.map((point) => ({
    timeMs: new Date(point.recorded_at).getTime(),
    tempC: point.thermocouple_c,
    value: point.thermocouple_c === null ? null : toFahrenheit(point.thermocouple_c),
  }));

/**
 * splits a curve into runs of connected points, breaking at faults and holes in the data.
 *
 * @param {ChartPoint[]} points - the curve.
 * @param {number} bucketS - how much time each point covers.
 * @returns {ChartPoint[][]} the unbroken runs.
 */
export function splitIntoRuns(points: ChartPoint[], bucketS: number): ChartPoint[][] {
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
 * works out how fast the temperature was changing around one point. it stays inside the point's
 * unbroken run, so a rate never reaches across a gap in the data.
 *
 * @param {ChartPoint[][]} runs - the curve's connected runs.
 * @param {ChartPoint} point - the point.
 * @returns {number | null} degrees c per hour, or null if there's too little data around it.
 */
export function rateAround(runs: ChartPoint[][], point: ChartPoint): number | null {
  const run = runs.find((candidate) => candidate.includes(point));
  if (!run) return null;
  const nearby = run.filter((other) => Math.abs(other.timeMs - point.timeMs) <= RATE_HALF_WINDOW_MS);
  const first = nearby[0];
  const last = nearby[nearby.length - 1];
  const spanMs = last.timeMs - first.timeMs;
  if (spanMs < RATE_MIN_SPAN_MS) return null;
  return (((last.tempC as number) - (first.tempC as number)) * MS_PER_HOUR) / spanMs;
}
