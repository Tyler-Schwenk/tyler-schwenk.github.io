import { formatDate } from "@/app/admin/format";
import { API_BASE } from "@/lib/api";
import type { PlayerTrack } from "@/lib/useAudioPlayer";

/**
 * types, fetchers and urls for the backend's /dj endpoints: the live stream, the
 * recorded sets and the live room's chat (see pi/docs/api/website-backend-api.md#dj-stream).
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

/** a message in the live room's chat. created_at is naive UTC. */
export type DjChatMessage = {
  id: number;
  nickname: string;
  content: string;
  created_at: string;
};

/** the live stream, for an <audio> element. */
export const DJ_LIVE_URL = `${API_BASE}/dj/live`;

/** the live stream as something the player can play. one id, so every page agrees it's the same track. */
export const LIVE_TRACK: PlayerTrack = {
  id: "live",
  title: "Live from the den",
  subtitle: "live now",
  src: DJ_LIVE_URL,
  live: true,
};

/** where the live room lives on the site. */
export const LIVE_ROOM_PATH = "/opium-den/live";

/** the chat endpoint: GET for the room, POST to send, DELETE /{id} to moderate. */
export const DJ_CHAT_PATH = "/dj/chat";

// match the backend's limits (MAX_DJ_CHAT_* in schemas.py)
export const DJ_CHAT_NICKNAME_MAX_LENGTH = 24;
export const DJ_CHAT_MESSAGE_MAX_LENGTH = 280;
const HTTP_TOO_MANY_REQUESTS = 429;

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

/**
 * the live room's recent chat, oldest first.
 *
 * @returns {Promise<DjChatMessage[]>} up to the last 100 messages from the last few hours.
 */
export function fetchDjChat(): Promise<DjChatMessage[]> {
  return fetchDjJson<DjChatMessage[]>(DJ_CHAT_PATH, "load the chat");
}

/**
 * why a chat send failed, in words a chatter can act on.
 *
 * @param {Response} response - the failed response.
 * @returns {Promise<string>} the reason.
 */
async function chatSendFailure(response: Response): Promise<string> {
  if (response.status === HTTP_TOO_MANY_REQUESTS) return "slow down a little, you're sending messages too fast.";
  const body = await response.json().catch(() => ({}));
  // the backend's own sentence for things like the chat being closed off air
  if (typeof body.detail === "string") return `${body.detail}.`;
  return `couldn't send that (the pi said ${response.status}). try again in a moment.`;
}


/**
 * sends a message to the live room's chat. only works while the stream's live.
 *
 * @param {string} nickname - the chatter's name.
 * @param {string} content - the message.
 * @returns {Promise<DjChatMessage>} the stored message, with its id.
 * @throws {Error} with a readable reason when it's off air, rate limited or invalid.
 */
export async function sendDjChat(nickname: string, content: string): Promise<DjChatMessage> {
  const response = await fetch(`${API_BASE}${DJ_CHAT_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, content }),
  });
  if (!response.ok) throw new Error(await chatSendFailure(response));
  return (await response.json()) as DjChatMessage;
}
