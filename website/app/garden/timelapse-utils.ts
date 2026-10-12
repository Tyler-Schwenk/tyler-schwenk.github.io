import { TIMELAPSE_TIMESTAMPS } from "./timelapse-timestamps";

const MONTH_ABBREVIATIONS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MS_PER_DAY = 86_400_000;
const SECONDS_PER_MINUTE = 60;
// matches the generated labels, e.g. "Apr 13, 2026"
const DATE_LABEL_PATTERN = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/;

/** a month-sized jump point on the timeline */
export interface TimelapseChapter {
  label: string;
  startSeconds: number;
}

/**
 * Parses a generated date label into a UTC timestamp. Done by hand instead of
 * `new Date(label)` since non-ISO date parsing isn't consistent across browsers.
 *
 * @param {string} label - Date label like "Apr 13, 2026".
 * @returns {number | null} UTC milliseconds, or null if the label doesn't match the format.
 */
function parseDateLabel(label: string): number | null {
  const match = DATE_LABEL_PATTERN.exec(label);
  if (!match) return null;
  const monthIndex = MONTH_ABBREVIATIONS.indexOf(match[1]);
  if (monthIndex < 0) return null;
  return Date.UTC(Number(match[3]), monthIndex, Number(match[2]));
}

const FIRST_DATE_LABEL = TIMELAPSE_TIMESTAMPS[0]?.date ?? "";
const LAST_DATE_LABEL = TIMELAPSE_TIMESTAMPS[TIMELAPSE_TIMESTAMPS.length - 1]?.date ?? "";
const FIRST_DATE_MS = parseDateLabel(FIRST_DATE_LABEL);

/**
 * Returns the date label for a playback position — the last entry whose
 * startSeconds is <= the position, so it's always the most recent date.
 *
 * @param {number} seconds - Video playback position in seconds.
 * @returns {string} Date label, e.g. "Apr 13, 2026".
 */
export function getDateAtTime(seconds: number): string {
  let label = FIRST_DATE_LABEL;
  for (const entry of TIMELAPSE_TIMESTAMPS) {
    if (entry.startSeconds > seconds) break;
    label = entry.date;
  }
  return label;
}

/**
 * Returns how many days into the garden a date label is, counting the first
 * photo as day 1.
 *
 * @param {string} label - Date label like "Apr 13, 2026".
 * @returns {number | null} 1-based day number, or null if either date can't be parsed.
 */
export function getDayNumber(label: string): number | null {
  const dateMs = parseDateLabel(label);
  if (dateMs === null || FIRST_DATE_MS === null) return null;
  return Math.round((dateMs - FIRST_DATE_MS) / MS_PER_DAY) + 1;
}

/**
 * Builds one chapter per calendar month, starting at that month's first frame.
 * The year gets appended only when the footage spans more than one year.
 *
 * @returns {TimelapseChapter[]} Chapters in playback order.
 */
function buildChapters(): TimelapseChapter[] {
  const years = new Set(TIMELAPSE_TIMESTAMPS.map((entry) => entry.date.slice(-4)));
  const showYear = years.size > 1;
  const chapters: TimelapseChapter[] = [];
  let lastKey = "";
  for (const entry of TIMELAPSE_TIMESTAMPS) {
    const month = entry.date.slice(0, 3);
    const year = entry.date.slice(-4);
    const key = `${month} ${year}`;
    if (key === lastKey) continue;
    lastKey = key;
    chapters.push({ label: showYear ? key : month, startSeconds: entry.startSeconds });
  }
  return chapters;
}

export const TIMELAPSE_CHAPTERS = buildChapters();

/** first and latest dates in the footage, plus how many days that covers */
export const TIMELAPSE_SPAN = {
  firstDate: FIRST_DATE_LABEL,
  lastDate: LAST_DATE_LABEL,
  totalDays: getDayNumber(LAST_DATE_LABEL),
};

/**
 * Finds the index of the chapter that contains a playback position.
 *
 * @param {number} seconds - Video playback position in seconds.
 * @returns {number} Index into TIMELAPSE_CHAPTERS (0 if before the first chapter).
 */
export function getChapterIndexAtTime(seconds: number): number {
  let index = 0;
  TIMELAPSE_CHAPTERS.forEach((chapter, i) => {
    if (chapter.startSeconds <= seconds) index = i;
  });
  return index;
}

/**
 * Finds the start of the previous or next day relative to a playback position.
 * Going back from partway through a day lands on that day's start first,
 * same as how "previous track" works on a music player.
 *
 * @param {number} seconds - Current playback position in seconds.
 * @param {1 | -1} direction - 1 for the next day, -1 for the previous one.
 * @returns {number | null} Start time of the target day, or null if there isn't one.
 */
export function getAdjacentDayStart(seconds: number, direction: 1 | -1): number | null {
  if (direction === 1) {
    const next = TIMELAPSE_TIMESTAMPS.find((entry) => entry.startSeconds > seconds);
    return next?.startSeconds ?? null;
  }
  const earlier = TIMELAPSE_TIMESTAMPS.filter((entry) => entry.startSeconds < seconds);
  return earlier[earlier.length - 1]?.startSeconds ?? null;
}

/**
 * Formats seconds as a m:ss clock.
 *
 * @param {number} seconds - Duration in seconds.
 * @returns {string} Clock string, e.g. "4:07".
 */
export function formatClock(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safe / SECONDS_PER_MINUTE);
  const remainder = safe % SECONDS_PER_MINUTE;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}
