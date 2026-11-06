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
 * works out the longest jump between points that's still a slope rather than a hole in the data.
 *
 * @param {number} bucketS - how much time each point covers.
 * @returns {number} the jump in milliseconds.
 */
export const maxJumpMs = (bucketS: number): number => Math.max(bucketS * GAP_BUCKETS * 1000, MIN_GAP_MS);

/**
 * finds a curve's first reading with a temperature.
 *
 * @param {ChartPoint[]} points - the curve, oldest first.
 * @returns {ChartPoint | null} that reading, or null if every point's a fault.
 */
const firstKnown = (points: ChartPoint[]): ChartPoint | null => points.find((point) => point.value !== null) ?? null;

/**
 * works out when a curve first reaches a temperature, between readings if it falls between them.
 *
 * @param {ChartPoint[]} points - the curve, oldest first.
 * @param {number} value - the temperature, in fahrenheit.
 * @returns {number | null} the time it got there, or null if it never did.
 */
function timeToReach(points: ChartPoint[], value: number): number | null {
  let previous: ChartPoint | null = null;
  for (const point of points) {
    if (point.value === null) continue;
    if (point.value >= value && previous) {
      const fraction = (value - (previous.value as number)) / (point.value - (previous.value as number));
      return previous.timeMs + fraction * (point.timeMs - previous.timeMs);
    }
    if (point.value >= value) return point.timeMs;
    previous = point;
  }
  return null;
}

/**
 * lines firings up by temperature on the way up. the one that started coldest begins at 0, and
 * every other one begins when that coldest one reached its starting temperature. logging can
 * start partway into a firing, so lining up by start time alone would put a firing that was
 * already hot hours ahead.
 *
 * @param {ChartPoint[][]} curves - each firing's curve, oldest first.
 * @returns {ChartPoint[][]} the same curves, with timeMs as time since the coldest one started.
 */
export function alignByStartTemp(curves: ChartPoint[][]): ChartPoint[][] {
  const starts = curves.map(firstKnown);
  const anchorIndex = starts.reduce<number>((best, start, index) => {
    const bestStart = starts[best];
    return start && (!bestStart || (start.value as number) < (bestStart.value as number)) ? index : best;
  }, 0);
  const anchorStart = starts[anchorIndex];
  if (!anchorStart) return curves;
  const anchor = curves[anchorIndex];
  return curves.map((points, index) => {
    const start = starts[index];
    if (!start) return points;
    const reachedMs = timeToReach(anchor, start.value as number) ?? anchorStart.timeMs;
    const shiftMs = start.timeMs - (reachedMs - anchorStart.timeMs);
    return points.map((point) => ({ ...point, timeMs: point.timeMs - shiftMs }));
  });
}

/**
 * finds the point closest in time, as long as it's not across a hole in the data.
 *
 * @param {ChartPoint[]} points - the curve.
 * @param {number} timeMs - the time to look near.
 * @param {number} withinMs - how far away a point can be and still count.
 * @returns {ChartPoint | null} the nearest point, or null if none is close enough.
 */
export function nearestPoint(points: ChartPoint[], timeMs: number, withinMs: number): ChartPoint | null {
  let nearest: ChartPoint | null = null;
  for (const point of points) {
    if (!nearest || Math.abs(point.timeMs - timeMs) < Math.abs(nearest.timeMs - timeMs)) nearest = point;
  }
  return nearest && Math.abs(nearest.timeMs - timeMs) <= withinMs ? nearest : null;
}

/**
 * splits a curve into runs of connected points, breaking at faults and holes in the data.
 *
 * @param {ChartPoint[]} points - the curve.
 * @param {number} bucketS - how much time each point covers.
 * @returns {ChartPoint[][]} the unbroken runs.
 */
export function splitIntoRuns(points: ChartPoint[], bucketS: number): ChartPoint[][] {
  const jumpMs = maxJumpMs(bucketS);
  const runs: ChartPoint[][] = [];
  let run: ChartPoint[] = [];
  for (const point of points) {
    const previous = run[run.length - 1];
    if (point.value === null || (previous && point.timeMs - previous.timeMs > jumpMs)) {
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
