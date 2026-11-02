/** which unit the page shows. everything's stored in celsius. */
export type TempUnit = "F" | "C";

const FAHRENHEIT_PER_CELSIUS = 1.8;
const FAHRENHEIT_OFFSET = 32;
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;
/** what the page shows when there's no value. */
export const NO_VALUE = "--";

/**
 * converts a temperature to the unit being shown.
 *
 * @param {number} tempC - temperature in celsius.
 * @param {TempUnit} unit - the unit to convert to.
 * @returns {number} the temperature in that unit.
 */
export const toUnit = (tempC: number, unit: TempUnit): number =>
  unit === "F" ? tempC * FAHRENHEIT_PER_CELSIUS + FAHRENHEIT_OFFSET : tempC;

/**
 * formats a temperature, like "2,345 °F".
 *
 * @param {number | null} tempC - temperature in celsius, or null for no value.
 * @param {TempUnit} unit - the unit to show.
 * @returns {string} the formatted temperature.
 */
export const formatTemp = (tempC: number | null, unit: TempUnit): string =>
  tempC === null ? NO_VALUE : `${Math.round(toUnit(tempC, unit)).toLocaleString()} °${unit}`;

/**
 * formats a rate of rise, like "+212 °F/hr". rates are differences, so no fahrenheit offset.
 *
 * @param {number | null} rateC - degrees c per hour, or null for no value.
 * @param {TempUnit} unit - the unit to show.
 * @returns {string} the formatted rate, signed.
 */
export const formatRate = (rateC: number | null, unit: TempUnit): string => {
  if (rateC === null) return NO_VALUE;
  const rate = Math.round(unit === "F" ? rateC * FAHRENHEIT_PER_CELSIUS : rateC);
  return `${rate > 0 ? "+" : ""}${rate.toLocaleString()} °${unit}/hr`;
};

/**
 * formats a length of time, like "14 hr 5 min".
 *
 * @param {number} ms - the length in milliseconds.
 * @returns {string} the formatted length.
 */
export const formatDuration = (ms: number): string => {
  const totalMinutes = Math.max(0, Math.round(ms / MS_PER_MINUTE));
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
};

/**
 * formats how long ago something was, like "3 hours ago".
 *
 * @param {number} ms - how long ago, in milliseconds.
 * @returns {string} the formatted time.
 */
export const formatAgo = (ms: number): string => {
  const minutes = Math.floor(ms / MS_PER_MINUTE);
  if (minutes < 1) return "just now";
  if (minutes < MINUTES_PER_HOUR) return `${minutes} min ago`;
  if (minutes < MINUTES_PER_DAY) {
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }
  const days = Math.floor(minutes / MINUTES_PER_DAY);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
};

/**
 * formats a date, like "Nov 2, 2026".
 *
 * @param {string | number} when - an iso string or epoch ms.
 * @returns {string} the formatted date, in the viewer's timezone.
 */
export const formatDate = (when: string | number): string =>
  new Date(when).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/**
 * formats a date and time, like "Nov 2, 8:07 AM".
 *
 * @param {string | number} when - an iso string or epoch ms.
 * @returns {string} the formatted moment, in the viewer's timezone.
 */
export const formatDateTime = (when: string | number): string =>
  new Date(when).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
