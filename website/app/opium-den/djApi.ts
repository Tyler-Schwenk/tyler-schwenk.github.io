import { formatDate } from "@/app/admin/format";
import { API_BASE } from "@/lib/api";

/**
 * types, fetchers and urls for the backend's /dj endpoints: the live stream and the
 * recorded sets (see pi/docs/api/website-backend-api.md#dj-stream).
 */

/** whether the stream's on air, as /dj/status sends it. */
export type DjStreamStatus = {
  live: boolean;
  /** when butt connected, naive UTC. null when off air. */
  started_at: string | null;
  /** how many people the relay is serving right now. */
  listeners: number;
};

/** a finished recorded set. times are naive UTC. */
export type DjSet = {
  id: number;
  title: string | null;
  /** notes added from the admin page, plain text with line breaks. */
  description: string | null;
  started_at: string;
  ended_at: string;
  duration_s: number;
  size_bytes: number;
};

/** the live stream, for an <audio> element. */
export const DJ_LIVE_URL = `${API_BASE}/dj/live`;

/** the admin api path for the set list and each set (renaming, deleting). */
export const DJ_SETS_PATH = "/dj/sets";

/**
 * the mp3 for a recorded set.
 *
 * @param {number} setId - the set's id.
 * @returns {string} absolute url, seekable.
 */
export function djSetAudioUrl(setId: number): string {
  return `${API_BASE}${DJ_SETS_PATH}/${setId}/audio`;
}

/**
 * the player's id for a set, so the list can tell which row is the one playing.
 *
 * @param {number} setId - the set's id.
 * @returns {string} like "set-3".
 */
export function djSetTrackId(setId: number): string {
  return `set-${setId}`;
}

/**
 * what a set's called on the page: its title, or when it was recorded if it hasn't got one.
 *
 * @param {DjSet} set - the set.
 * @returns {string} like "sunday warmup" or "Nov 18, 8:55 AM".
 */
export function djSetTitle(set: DjSet): string {
  return set.title || formatDate(set.started_at);
}

/**
 * fetches json from the dj endpoints, or throws with what went wrong.
 *
 * @param {string} path - path under the api.
 * @param {string} action - what we were doing, for the error message.
 * @returns {Promise<T>} the parsed body.
 */
async function fetchDjJson<T>(path: string, action: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`couldn't ${action} (the pi said ${response.status})`);
  }
  return (await response.json()) as T;
}

/**
 * whether the stream's live right now.
 *
 * @returns {Promise<DjStreamStatus>} the status.
 */
export function fetchDjStatus(): Promise<DjStreamStatus> {
  return fetchDjJson<DjStreamStatus>("/dj/status", "check whether the stream is live");
}

/**
 * every finished set, newest first.
 *
 * @returns {Promise<DjSet[]>} the sets.
 */
export function fetchDjSets(): Promise<DjSet[]> {
  return fetchDjJson<DjSet[]>(DJ_SETS_PATH, "load the past sets");
}
