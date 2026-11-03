import type { ChartPoint } from "./kilnCurve";

/**
 * predictions for the kiln calculator. the constants come from replaying the first firing
 * (nov 2026, peak 2,299 f) and comparing predictions to what actually happened.
 *
 * cooling: the rate is close to proportional to how far above room temp the kiln is, so it
 * follows an exponential curve. a straight line was 30-40% too soon on anything hours out,
 * while the curve was typically within about 5% once settled. heating: there's no such law,
 * since it depends on how the burner's set, so it's a straight line from the last hour,
 * typically within about 25%. that's all from one firing, so the ranges stay on the wide side.
 */

const WINDOW_MS = 3_600_000;
const MS_PER_HOUR = 3_600_000;
/** under this much recent data, a trend isn't worth much. */
const MIN_WINDOW_MS = 20 * 60_000;
const MIN_WINDOW_POINTS = 5;
/** the temperature the kiln cools toward. it barely matters: 20 f instead changed results by 1-2%. */
const ROOM_TEMP_F = 70;
/** moving slower than this counts as holding steady, not heating or cooling. */
const HOLDING_RATE_F_PER_H = 15;
/** how far off an estimate tends to be, as a share of the time. from the replay above. */
const COOLING_UNCERTAINTY = 0.15;
const HEATING_UNCERTAINTY = 0.3;
/** right after the peak, the rate jumped around between 87 and 385 f/hr before settling. */
const SETTLING_AFTER_PEAK_MS = 2.5 * MS_PER_HOUR;
const SETTLING_UNCERTAINTY = 0.3;
/** the cooling constant once settled, 0.15-0.18 all the way down. the last hour is misleading
 * while it's settling, since the kiln lingers near the peak before it really starts dropping. */
const TYPICAL_COOLING_CONSTANT_PER_H = 0.16;

/** the lowest temperature the calculator will predict. the curve flattens out near room temp. */
export const MIN_TARGET_F = 100;
export const MAX_TARGET_F = 2400;

export type KilnPhase = "heating" | "cooling" | "holding";

/** what's happening right now, and what predictions get made from. */
export type KilnForecast = {
  phase: KilnPhase;
  tempF: number;
  /** degrees f per hour over the last hour, negative when cooling. */
  rateFPerH: number;
  /** fraction of the gap to room temp that closes per hour. only used when cooling. */
  coolingConstantPerH: number;
  /** how far off an estimate could be, as a share of the time. */
  uncertainty: number;
  /** cooling only just started, so the rate hasn't settled yet. */
  settling: boolean;
};

/** a time estimate with its likely range, in hours. */
export type TimeEstimate = { hours: number; lowHours: number; highHours: number };

/** a temperature estimate with its likely range, in fahrenheit. */
export type TempEstimate = { tempF: number; lowF: number; highF: number };

/** why there's no estimate, if there isn't one. */
export type NoEstimateReason = "passed" | "wrong-way" | "holding";

/**
 * fits a straight line through points and returns its slope.
 *
 * @param {Array<[number, number]>} xy - the points.
 * @returns {number} the slope, or 0 if the x values are all the same.
 */
function slope(xy: Array<[number, number]>): number {
  const meanX = xy.reduce((sum, [x]) => sum + x, 0) / xy.length;
  const meanY = xy.reduce((sum, [, y]) => sum + y, 0) / xy.length;
  const denominator = xy.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0);
  if (denominator === 0) return 0;
  return xy.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0) / denominator;
}

/**
 * works out the current trend from the last hour of a firing's curve.
 *
 * @param {ChartPoint[]} points - the firing's curve, oldest first.
 * @param {number} tempF - the current temperature.
 * @param {number} nowMs - when that temperature was read.
 * @param {number} peakAtMs - when the firing peaked.
 * @returns {KilnForecast | null} the trend, or null without enough recent data.
 */
export function buildForecast(points: ChartPoint[], tempF: number, nowMs: number, peakAtMs: number): KilnForecast | null {
  const recent = points.filter((point) => point.value !== null && point.timeMs >= nowMs - WINDOW_MS);
  if (recent.length < MIN_WINDOW_POINTS) return null;
  if (recent[recent.length - 1].timeMs - recent[0].timeMs < MIN_WINDOW_MS) return null;

  const hoursAgo = (point: ChartPoint) => (point.timeMs - nowMs) / MS_PER_HOUR;
  const rateFPerH = slope(recent.map((point) => [hoursAgo(point), point.value as number]));
  const aboveRoom = recent.filter((point) => (point.value as number) > ROOM_TEMP_F);
  const measuredConstantPerH =
    aboveRoom.length >= MIN_WINDOW_POINTS
      ? -slope(aboveRoom.map((point) => [hoursAgo(point), Math.log((point.value as number) - ROOM_TEMP_F)]))
      : 0;

  let phase: KilnPhase = "holding";
  if (rateFPerH >= HOLDING_RATE_F_PER_H) phase = "heating";
  else if (rateFPerH <= -HOLDING_RATE_F_PER_H && measuredConstantPerH > 0) phase = "cooling";

  const settling = phase === "cooling" && nowMs - peakAtMs < SETTLING_AFTER_PEAK_MS;
  let uncertainty = HEATING_UNCERTAINTY;
  if (phase === "cooling") uncertainty = settling ? SETTLING_UNCERTAINTY : COOLING_UNCERTAINTY;

  return {
    phase,
    tempF,
    rateFPerH,
    coolingConstantPerH: settling ? TYPICAL_COOLING_CONSTANT_PER_H : measuredConstantPerH,
    uncertainty,
    settling,
  };
}

/**
 * says why a temperature can't be estimated from here, if it can't.
 *
 * @param {KilnForecast} forecast - the current trend.
 * @param {number} targetF - the temperature being asked about.
 * @returns {NoEstimateReason | null} the reason, or null if it can be estimated.
 */
export function noEstimateReason(forecast: KilnForecast, targetF: number): NoEstimateReason | null {
  if (forecast.phase === "holding") return "holding";
  const isHeating = forecast.phase === "heating";
  if (isHeating ? targetF <= forecast.tempF : targetF >= forecast.tempF) return "passed";
  return null;
}

/**
 * estimates how long until the kiln reaches a temperature.
 *
 * @param {KilnForecast} forecast - the current trend.
 * @param {number} targetF - the temperature to reach.
 * @returns {TimeEstimate | null} the estimate, or null if it can't be estimated.
 */
export function estimateTime(forecast: KilnForecast, targetF: number): TimeEstimate | null {
  if (noEstimateReason(forecast, targetF) !== null || targetF <= ROOM_TEMP_F) return null;
  const hours =
    forecast.phase === "cooling"
      ? Math.log((forecast.tempF - ROOM_TEMP_F) / (targetF - ROOM_TEMP_F)) / forecast.coolingConstantPerH
      : (targetF - forecast.tempF) / forecast.rateFPerH;
  return { hours, lowHours: hours * (1 - forecast.uncertainty), highHours: hours * (1 + forecast.uncertainty) };
}

/**
 * works out the temperature after some time, following the current trend.
 *
 * @param {KilnForecast} forecast - the current trend.
 * @param {number} hours - how far ahead.
 * @returns {number} the temperature then, in fahrenheit.
 */
function tempAfter(forecast: KilnForecast, hours: number): number {
  if (forecast.phase === "cooling") {
    return ROOM_TEMP_F + (forecast.tempF - ROOM_TEMP_F) * Math.exp(-forecast.coolingConstantPerH * hours);
  }
  return forecast.tempF + forecast.rateFPerH * hours;
}

/**
 * estimates the temperature some time from now.
 *
 * @param {KilnForecast} forecast - the current trend.
 * @param {number} hours - how far ahead.
 * @returns {TempEstimate | null} the estimate, or null while it's holding steady.
 */
export function estimateTemp(forecast: KilnForecast, hours: number): TempEstimate | null {
  if (forecast.phase === "holding") return null;
  const early = tempAfter(forecast, hours * (1 - forecast.uncertainty));
  const late = tempAfter(forecast, hours * (1 + forecast.uncertainty));
  return { tempF: tempAfter(forecast, hours), lowF: Math.min(early, late), highF: Math.max(early, late) };
}

/**
 * looks up how long the same change actually took in another firing.
 *
 * @param {ChartPoint[]} points - that firing's curve, oldest first.
 * @param {KilnPhase} phase - whether to look at its way up or its way down.
 * @param {number} fromF - the starting temperature.
 * @param {number} targetF - the temperature to reach.
 * @returns {number | null} how many hours it took, or null if that firing didn't cover the change.
 */
export function referenceHours(points: ChartPoint[], phase: KilnPhase, fromF: number, targetF: number): number | null {
  const known = points.filter((point) => point.value !== null);
  if (known.length === 0 || phase === "holding") return null;
  const peakIndex = known.reduce((best, point, index) => ((point.value as number) > (known[best].value as number) ? index : best), 0);
  const stretch = phase === "cooling" ? known.slice(peakIndex) : known.slice(0, peakIndex + 1);
  const hasPassed = (point: ChartPoint, tempF: number) =>
    phase === "cooling" ? (point.value as number) <= tempF : (point.value as number) >= tempF;
  const start = stretch.find((point) => hasPassed(point, fromF));
  const end = stretch.find((point) => hasPassed(point, targetF));
  if (!start || !end || end.timeMs <= start.timeMs) return null;
  return (end.timeMs - start.timeMs) / MS_PER_HOUR;
}
