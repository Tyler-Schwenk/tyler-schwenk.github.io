/**
 * Small text helpers for the admin page.
 */

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * 1024;
const S_PER_MIN = 60;
const MIN_PER_H = 60;
const MS_PER_S = 1000;

// a timestamp already carrying a zone (Z or +hh:mm) at the end
const TIMEZONE_SUFFIX_PATTERN = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

/**
 * Turns a name into a url slug.
 * @param text - Like "Jordan 2026".
 * @returns Like "jordan-2026".
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A file size for people.
 * @param bytes - Size in bytes.
 * @returns Like "2.4 MB".
 */
export function formatBytes(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  if (bytes < BYTES_PER_MB) return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
  return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
}

/**
 * A backend timestamp in local time.
 * @param iso - ISO timestamp; the backend stores UTC without a zone, so one without is read as UTC.
 * @returns Like "Oct 5, 3:12 PM", or "" if it can't be read.
 */
export function formatDate(iso: string): string {
  const date = new Date(TIMEZONE_SUFFIX_PATTERN.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day}, ${time}`;
}

/**
 * A video length for people.
 * @param seconds - Length in seconds.
 * @returns Like "3:07".
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / S_PER_MIN);
  const rest = Math.floor(seconds % S_PER_MIN);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/**
 * How long ago something happened, roughly.
 * @param ms - Elapsed time in ms.
 * @returns Like "12 s", "4 min" or "3 h".
 */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / MS_PER_S));
  if (seconds < S_PER_MIN) return `${seconds} s`;
  const minutes = Math.round(seconds / S_PER_MIN);
  if (minutes < MIN_PER_H) return `${minutes} min`;
  return `${Math.round(minutes / MIN_PER_H)} h`;
}

/**
 * "1 photo" / "3 photos".
 * @param count - How many.
 * @param singular - Singular noun.
 * @param pluralForm - Plural noun, when it's not just the singular plus s.
 * @returns The count with the right noun.
 */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
