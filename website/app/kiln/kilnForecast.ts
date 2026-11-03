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
 *
 * firings aren't all run the same: jude can keep some gas on to hold the heat up before letting
 * it fall. nobody can predict when he'll stop, so while it's held up the answers are "if it's let
 * drop right now" limits, not estimates. the drop gets spotted from the curve, not the clock.
 *
 * the kiln's outdoors, so it cools toward the forecast outdoor temp. that barely matters up high
 * but a lot near the end, so the ranges allow for it being off. finished firings teach it what a
 * full drop looks like, which is what the held up limits are based on.
 */

const WINDOW_MS = 3_600_000;
const MS_PER_HOUR = 3_600_000;
/** under this much recent data, a trend isn't worth much. */
const MIN_WINDOW_MS = 20 * 60_000;
const MIN_WINDOW_POINTS = 5;
/** what to assume for the outdoors when there's no forecast. */
export const DEFAULT_OUTSIDE_F = 70;
/** how far off the outdoor temp could be, from the forecast's error, wind, and the day's swing. */
const OUTSIDE_MARGIN_F = 10;
/** moving slower than this counts as holding steady, not heating or cooling. */
const HOLDING_RATE_F_PER_H = 15;
/** how far off an estimate tends to be, as a share of the time. from the replay above. */
const COOLING_UNCERTAINTY = 0.15;
const HEATING_UNCERTAINTY = 0.3;
/** the cooling constant in a full drop before any firing's finished. 0.14-0.18 all the way down in the first one. */
const DEFAULT_COOLING_CONSTANT_PER_H = 0.16;
/** above this, the outdoor temp's too small a part of the gap to throw off what past firings teach. */
const MIN_LEARNING_TEMP_F = 500;
const LEARNING_STEP_MS = 15 * 60_000;
/** under this many hour-long stretches of full drop, a firing doesn't say much. */
const MIN_LEARNING_WINDOWS = 4;
/** under this it's being held up. the first firing's hold stayed near 0.03-0.09. */
const FULL_DROP_MIN_CONSTANT_PER_H = 0.11;
/** holds happen up high. the constant drifts down near room temp, which isn't a hold. */
const MIN_HELD_UP_TEMP_F = 1000;

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
  /** fraction of the gap to the outdoor temp that closes per hour. only used when cooling. */
  coolingConstantPerH: number;
  /** the temperature it's cooling toward. */
  outsideF: number;
  /** how far off an estimate could be, as a share of the time. */
  uncertainty: number;
  /** high up and not in a full drop, so estimates only say what'd happen if it's let drop now. */
  heldUp: boolean;
};

/** a time estimate with its likely range, in hours. */
export type TimeEstimate = { hours: number; lowHours: number; highHours: number };

/** a temperature estimate with its likely range, in fahrenheit. */
export type TempEstimate = { tempF: number; lowF: number; highF: number };

/** why there's no estimate, if there isn't one. */
export type NoEstimateReason = "passed" | "holding" | "near-outside";

/** what a typical full drop looks like, for when the current one can't be measured yet. */
export type TypicalDrop = {
  coolingConstantPerH: number;
  uncertainty: number;
  /** how many finished firings it's learned from. 0 means it's the built-in default. */
  firingCount: number;
};

export const DEFAULT_TYPICAL_DROP: TypicalDrop = {
  coolingConstantPerH: DEFAULT_COOLING_CONSTANT_PER_H,
  uncertainty: COOLING_UNCERTAINTY,
  firingCount: 0,
};

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
 * measures how fast the gap to the outdoor temp is closing, from a stretch of curve.
 *
 * @param {ChartPoint[]} stretch - the points to measure.
 * @param {number} outsideF - the temperature it's cooling toward.
 * @param {number} nowMs - the time the measurement is relative to.
 * @returns {number | null} the fraction closing per hour, or null with too few points.
 */
function measureCoolingConstant(stretch: ChartPoint[], outsideF: number, nowMs: number): number | null {
  const aboveOutside = stretch.filter((point) => point.value !== null && point.value > outsideF);
  if (aboveOutside.length < MIN_WINDOW_POINTS) return null;
  return -slope(aboveOutside.map((point) => [(point.timeMs - nowMs) / MS_PER_HOUR, Math.log((point.value as number) - outsideF)]));
}

/**
 * finds the middle value of a list.
 *
 * @param {number[]} values - the values, at least one.
 * @returns {number} the median.
 */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * measures one finished firing's full drop, skipping any hold after the peak.
 *
 * @param {ChartPoint[]} points - the firing's curve, oldest first.
 * @returns {number | null} its typical cooling constant, or null if it doesn't show enough of a drop.
 */
export function measureFullDrop(points: ChartPoint[]): number | null {
  const known = points.filter((point) => point.value !== null);
  if (known.length === 0) return null;
  const peakIndex = known.reduce((best, point, index) => ((point.value as number) > (known[best].value as number) ? index : best), 0);
  const cooling = known.slice(peakIndex).filter((point) => (point.value as number) >= MIN_LEARNING_TEMP_F);
  if (cooling.length === 0) return null;

  const lastMs = cooling[cooling.length - 1].timeMs;
  const constants: number[] = [];
  for (let startMs = cooling[0].timeMs; startMs + WINDOW_MS <= lastMs; startMs += LEARNING_STEP_MS) {
    const stretch = cooling.filter((point) => point.timeMs >= startMs && point.timeMs < startMs + WINDOW_MS);
    const constant = measureCoolingConstant(stretch, DEFAULT_OUTSIDE_F, startMs);
    if (constant !== null && constant >= FULL_DROP_MIN_CONSTANT_PER_H) constants.push(constant);
  }
  return constants.length >= MIN_LEARNING_WINDOWS ? median(constants) : null;
}

/**
 * works out what a typical full drop looks like from finished firings.
 *
 * @param {ChartPoint[][]} firings - the curves of finished firings.
 * @returns {TypicalDrop} the typical drop, with a wider range the more the firings disagree.
 */
export function learnTypicalDrop(firings: ChartPoint[][]): TypicalDrop {
  const constants = firings.map(measureFullDrop).filter((constant): constant is number => constant !== null);
  if (constants.length === 0) return DEFAULT_TYPICAL_DROP;
  const coolingConstantPerH = median(constants);
  const spread = (Math.max(...constants) - Math.min(...constants)) / coolingConstantPerH;
  return { coolingConstantPerH, uncertainty: Math.max(COOLING_UNCERTAINTY, spread), firingCount: constants.length };
}

/**
 * works out the current trend from the last hour of a firing's curve.
 *
 * @param {ChartPoint[]} points - the firing's curve, oldest first.
 * @param {number} tempF - the current temperature.
 * @param {number} nowMs - when that temperature was read.
 * @param {number} outsideF - the temperature it'd cool toward.
 * @param {TypicalDrop} typicalDrop - what a full drop usually looks like, used while it's held up.
 * @returns {KilnForecast | null} the trend, or null without enough recent data.
 */
export function buildForecast(
  points: ChartPoint[],
  tempF: number,
  nowMs: number,
  outsideF: number,
  typicalDrop: TypicalDrop,
): KilnForecast | null {
  const recent = points.filter((point) => point.value !== null && point.timeMs >= nowMs - WINDOW_MS);
  if (recent.length < MIN_WINDOW_POINTS) return null;
  if (recent[recent.length - 1].timeMs - recent[0].timeMs < MIN_WINDOW_MS) return null;

  const hoursAgo = (point: ChartPoint) => (point.timeMs - nowMs) / MS_PER_HOUR;
  const rateFPerH = slope(recent.map((point) => [hoursAgo(point), point.value as number]));
  const measuredConstantPerH = measureCoolingConstant(recent, outsideF, nowMs) ?? 0;

  let phase: KilnPhase = "holding";
  if (rateFPerH >= HOLDING_RATE_F_PER_H) phase = "heating";
  else if (rateFPerH <= -HOLDING_RATE_F_PER_H && measuredConstantPerH > 0) phase = "cooling";

  const heldUp = phase !== "heating" && tempF >= MIN_HELD_UP_TEMP_F && measuredConstantPerH < FULL_DROP_MIN_CONSTANT_PER_H;

  return {
    phase,
    tempF,
    rateFPerH,
    coolingConstantPerH: heldUp ? typicalDrop.coolingConstantPerH : measuredConstantPerH,
    outsideF,
    uncertainty: heldUp ? typicalDrop.uncertainty : phase === "heating" ? HEATING_UNCERTAINTY : COOLING_UNCERTAINTY,
    heldUp,
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
  if (forecast.phase === "holding" && (!forecast.heldUp || targetF >= forecast.tempF)) return "holding";
  const isHeating = forecast.phase === "heating";
  if (isHeating ? targetF <= forecast.tempF : targetF >= forecast.tempF) return "passed";
  // the curve flattens out here and never gets there, so any time would be made up
  if (!isHeating && targetF <= forecast.outsideF + OUTSIDE_MARGIN_F) return "near-outside";
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
  if (noEstimateReason(forecast, targetF) !== null) return null;
  if (forecast.phase === "heating") {
    const hours = (targetF - forecast.tempF) / forecast.rateFPerH;
    return { hours, lowHours: hours * (1 - forecast.uncertainty), highHours: hours * (1 + forecast.uncertainty) };
  }
  const hoursWith = (outsideF: number) =>
    Math.log((forecast.tempF - outsideF) / (targetF - outsideF)) / forecast.coolingConstantPerH;
  return {
    hours: hoursWith(forecast.outsideF),
    lowHours: hoursWith(forecast.outsideF - OUTSIDE_MARGIN_F) * (1 - forecast.uncertainty),
    highHours: hoursWith(forecast.outsideF + OUTSIDE_MARGIN_F) * (1 + forecast.uncertainty),
  };
}

/**
 * works out the temperature after some time, following the current trend.
 *
 * @param {KilnForecast} forecast - the current trend.
 * @param {number} hours - how far ahead.
 * @param {number} outsideF - the temperature it's cooling toward.
 * @returns {number} the temperature then, in fahrenheit.
 */
function tempAfter(forecast: KilnForecast, hours: number, outsideF: number): number {
  if (forecast.phase !== "heating") {
    return outsideF + (forecast.tempF - outsideF) * Math.exp(-forecast.coolingConstantPerH * hours);
  }
  return forecast.tempF + forecast.rateFPerH * hours;
}

/**
 * estimates the temperature some time from now.
 *
 * @param {KilnForecast} forecast - the current trend.
 * @param {number} hours - how far ahead.
 * @returns {TempEstimate | null} the estimate, or null while it's holding steady down low.
 */
export function estimateTemp(forecast: KilnForecast, hours: number): TempEstimate | null {
  if (forecast.phase === "holding" && !forecast.heldUp) return null;
  const margin = forecast.phase === "heating" ? 0 : OUTSIDE_MARGIN_F;
  const early = tempAfter(forecast, hours * (1 - forecast.uncertainty), forecast.outsideF + margin);
  const late = tempAfter(forecast, hours * (1 + forecast.uncertainty), forecast.outsideF - margin);
  return { tempF: tempAfter(forecast, hours, forecast.outsideF), lowF: Math.min(early, late), highF: Math.max(early, late) };
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
