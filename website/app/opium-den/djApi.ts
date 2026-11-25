import { formatDate, parseBackendTime } from "@/app/admin/format";
import { API_BASE } from "@/lib/api";
import type { PlayerTrack } from "@/lib/useAudioPlayer";

/**
 * types, fetchers and urls for the backend's /dj endpoints: the live stream, the
 * recorded sets (with their replayed chat, waveforms and cover images), guest djs and the
 * live room's chat, plus the live section's site paths (see
 * pi/docs/api/website-backend-api.md#dj-stream).
 */

/** a guest dj, as their stream and sets carry them. tyler's own have none. */
export type DjGuest = {
  id: number;
  /** what the site calls them, like "Tracepoint". */
  name: string;
  /** a bit about them, plain text with line breaks. */
  bio: string | null;
  /** their photo, null without one. changes with every upload. */
  photo_id: number | null;
};

/** a guest dj's own profile, as their page gets it: plus their login and the mount their butt sends to. */
export type DjGuestMe = DjGuest & {
  username: string;
  /** without the slash, like "tracepoint". */
  mount: string;
};

// match the backend's limits (MAX_DJ_GUEST_*_LENGTH in schemas.py)
export const DJ_GUEST_NAME_MAX_LENGTH = 40;
export const DJ_GUEST_BIO_MAX_LENGTH = 1000;

/** whether the stream's on air, as /dj/status sends it. */
export type DjStreamStatus = {
  live: boolean;
  /** when butt connected, naive UTC. null when off air. */
  started_at: string | null;
  /** how many people the relay is serving right now. */
  listeners: number;
  // optional: the site deploys on push but the pi's pulled by hand, so a backend from
  // before covers existed leaves these out. check them with == null
  /** the set being recorded, null off air. */
  set_id?: number | null;
  /** that set's cover image, null until one's uploaded. */
  image_id?: number | null;
  /** the guest dj on air, null when it's tyler. optional like the two above. */
  dj?: DjGuest | null;
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
  /** its cover image, null when it hasn't got one. changes with every upload. optional like DjStreamStatus's. */
  image_id?: number | null;
  /** the guest dj who played it, null for tyler's. optional like image_id. */
  dj?: DjGuest | null;
};

/** a message in the live room's chat. created_at is naive UTC. */
export type DjChatMessage = {
  id: number;
  nickname: string;
  content: string;
  created_at: string;
};

/** a message from during a recorded set, placed on its timeline. */
export type DjSetChatMessage = DjChatMessage & {
  /** how far into the recording it belongs, in seconds. */
  offset_s: number;
};

/**
 * someone's stay in the live room during a recorded set, on its timeline. older sets,
 * from before stays were saved, have one per chatter, from their first message to the end.
 */
export type DjSetVisit = {
  nickname: string;
  /** their number in the room. under ROOM_CHARACTER_COUNT it's their character. */
  avatar: number;
  /** the photo they stood in as, null for a character. */
  photo_id: number | null;
  /** when they came in, seconds into the recording. */
  from_s: number;
  /** when they left, seconds into the recording. */
  to_s: number;
};

/** a set's loudness over time, evenly spread over the whole set. */
export type DjSetWaveform = {
  /** each 0 to 1, 1 being the loudest moment. */
  peaks: number[];
};

/** the live set's loudness so far, measured as it streams. */
export type DjLiveTrace = {
  live: boolean;
  /** how many seconds of the set each bar covers. */
  interval_s: number;
  /** oldest first, each 0 to 1, 1 being the loudest moment so far. empty off air. */
  peaks: number[];
};

/** the live stream, for an <audio> element. */
export const DJ_LIVE_URL = `${API_BASE}/dj/live`;

/** the live stream's player id. one id, so every page agrees it's the same track. */
export const LIVE_TRACK_ID = "live";

/** the live section: the live row, alerts signup and every past set. */
export const LIVE_SECTION_PATH = "/opium-den/live";

/** the live room: the stream's own page, with its chat. */
export const LIVE_ROOM_PATH = `${LIVE_SECTION_PATH}/room`;

/** the page that replays one recorded set with its chat, picked by ?id=. */
export const SET_PAGE_PATH = `${LIVE_SECTION_PATH}/set`;

/**
 * the site link to a set's replay page.
 *
 * @param {number} setId - the set's id.
 * @returns {string} like "/opium-den/live/set?id=3".
 */
export function djSetPagePath(setId: number): string {
  return `${SET_PAGE_PATH}?id=${setId}`;
}

/** the chat endpoint: GET for the room, POST to send, DELETE /{id} to moderate. */
export const DJ_CHAT_PATH = "/dj/chat";

// match the backend's limits (MAX_DJ_CHAT_* in schemas.py)
export const DJ_CHAT_NICKNAME_MAX_LENGTH = 24;
export const DJ_CHAT_MESSAGE_MAX_LENGTH = 280;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_FORBIDDEN = 403;

/** a chat send turned away because another browser is already chatting under that name this set. */
export class ChatNameTakenError extends Error {
  /**
   * @param {string} message - the backend's reason, ready to show.
   */
  constructor(message: string) {
    super(message);
    this.name = "ChatNameTakenError";
  }
}

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
 * the admin api path for a set's cover image: PUT a file to set it, DELETE to take it off.
 *
 * @param {number} setId - the set's id.
 * @returns {string} like "/dj/sets/3/image".
 */
export function djSetImagePath(setId: number): string {
  return `${DJ_SETS_PATH}/${setId}/image`;
}

/**
 * a set's cover image. the image id goes in the query so each upload gets its own url,
 * which the backend lets browsers cache for good.
 *
 * @param {number} setId - the set's id.
 * @param {number} imageId - the image's id, from the set or the live status.
 * @param {boolean} [thumbnail] - the ~400 px version, for lists and the player.
 * @returns {string} absolute url.
 */
export function djSetImageUrl(setId: number, imageId: number, thumbnail = false): string {
  const size = thumbnail ? "&thumbnail=true" : "";
  return `${API_BASE}${djSetImagePath(setId)}?v=${imageId}${size}`;
}

/** the guest dj endpoints: login, their own profile (/me) and photos (/{id}/photo). */
export const DJ_GUESTS_PATH = "/dj/guests";

/**
 * a guest dj's photo. the photo id goes in the query so each upload gets its own url,
 * cached for good like set covers.
 *
 * @param {number} guestId - the guest's id.
 * @param {number} photoId - the photo's id.
 * @param {boolean} [thumbnail] - the ~400 px version.
 * @returns {string} absolute url.
 */
export function djGuestPhotoUrl(guestId: number, photoId: number, thumbnail = false): string {
  const size = thumbnail ? "&thumbnail=true" : "";
  return `${API_BASE}${DJ_GUESTS_PATH}/${guestId}/photo?v=${photoId}${size}`;
}

/**
 * a guest dj's photo thumbnail, which stands in for a cover on their sets without one.
 *
 * @param {DjGuest | null | undefined} dj - the guest, if it's a guest's.
 * @returns {string | null} the url, or null for tyler's or a guest without a photo.
 */
function djGuestThumbUrl(dj: DjGuest | null | undefined): string | null {
  return dj?.photo_id == null ? null : djGuestPhotoUrl(dj.id, dj.photo_id, true);
}

/**
 * a set's cover thumbnail: its cover, or its guest dj's photo if it hasn't got one.
 *
 * @param {DjSet} set - the set.
 * @returns {string | null} the url, or null.
 */
export function djSetThumbUrl(set: DjSet): string | null {
  return set.image_id == null ? djGuestThumbUrl(set.dj) : djSetImageUrl(set.id, set.image_id, true);
}

/**
 * who played a set or the stream, for a byline. tyler's are his own den's, so they
 * don't get one.
 *
 * @param {DjGuest | null | undefined} dj - the guest dj, if it's a guest's.
 * @returns {string | null} like "Tracepoint", or null for tyler's.
 */
export function djByline(dj: DjGuest | null | undefined): string | null {
  return dj?.name ?? null;
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
 * a recorded set as something the player can play, opening out to its replay page.
 *
 * @param {DjSet} set - the set.
 * @returns {PlayerTrack} the track, keyed so the list and the set page agree it's the same one.
 */
export function djSetTrack(set: DjSet): PlayerTrack {
  const when = set.title ? formatDate(set.started_at) : "untitled set";
  const byline = djByline(set.dj);
  return {
    id: djSetTrackId(set.id),
    title: djSetTitle(set),
    subtitle: byline ? `${byline} · ${when}` : when,
    src: djSetAudioUrl(set.id),
    live: false,
    href: djSetPagePath(set.id),
    artSrc: djSetThumbUrl(set),
  };
}

/**
 * when the live set started, if the status knows.
 *
 * @param {DjStreamStatus | null} status - latest status.
 * @returns {number | null} ms since the epoch, or null off air or when it's unknown.
 */
export function djLiveStartedMs(status: DjStreamStatus | null): number | null {
  if (!status?.live || !status.started_at) return null;
  const ms = parseBackendTime(status.started_at).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * the live stream's cover: the recording set's image if one's been uploaded, or else the
 * guest dj's photo when it's a guest on.
 *
 * @param {DjStreamStatus | null} status - latest status.
 * @returns {string | null} the thumbnail url, or null.
 */
export function djLiveThumbUrl(status: DjStreamStatus | null): string | null {
  if (status?.set_id == null) return null;
  if (status.image_id == null) return djGuestThumbUrl(status.dj);
  return djSetImageUrl(status.set_id, status.image_id, true);
}

/**
 * the live stream as something the player can play, opening out to the live room.
 *
 * @param {DjStreamStatus | null} status - latest status, for the set's cover image.
 * @returns {PlayerTrack} the track. always LIVE_TRACK_ID, whatever set's on.
 */
export function djLiveTrack(status: DjStreamStatus | null): PlayerTrack {
  const byline = djByline(status?.dj);
  return {
    id: LIVE_TRACK_ID,
    title: "Live from the den",
    subtitle: byline ? `${byline} live now` : "live now",
    src: DJ_LIVE_URL,
    live: true,
    href: LIVE_ROOM_PATH,
    artSrc: djLiveThumbUrl(status),
  };
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
 * one finished set.
 *
 * @param {number} setId - the set's id.
 * @returns {Promise<DjSet>} the set.
 */
export function fetchDjSet(setId: number): Promise<DjSet> {
  return fetchDjJson<DjSet>(`${DJ_SETS_PATH}/${setId}`, "load this set");
}

/**
 * the chat from while a set was live, each message placed on the set's timeline.
 *
 * @param {number} setId - the set's id.
 * @returns {Promise<DjSetChatMessage[]>} oldest first.
 */
export function fetchDjSetChat(setId: number): Promise<DjSetChatMessage[]> {
  return fetchDjJson<DjSetChatMessage[]>(`${DJ_SETS_PATH}/${setId}/chat`, "load this set's chat");
}

/**
 * who was in the live room while a set was on, each stay placed on the set's timeline.
 *
 * @param {number} setId - the set's id.
 * @returns {Promise<DjSetVisit[]>} in the order they came in.
 */
export function fetchDjSetPeople(setId: number): Promise<DjSetVisit[]> {
  return fetchDjJson<DjSetVisit[]>(`${DJ_SETS_PATH}/${setId}/people`, "load who was in the room");
}

/**
 * a set's waveform. the first request for an older set can take a few seconds while the
 * pi works it out.
 *
 * @param {number} setId - the set's id.
 * @returns {Promise<DjSetWaveform>} the peaks.
 */
export function fetchDjSetWaveform(setId: number): Promise<DjSetWaveform> {
  return fetchDjJson<DjSetWaveform>(`${DJ_SETS_PATH}/${setId}/waveform`, "load this set's waveform");
}

/**
 * the live set's loudness so far, for the live monitor's trace. the bars start when the
 * recording did and run back to back.
 *
 * @returns {Promise<DjLiveTrace>} the trace.
 */
export function fetchDjLiveTrace(): Promise<DjLiveTrace> {
  return fetchDjJson<DjLiveTrace>("/dj/live/trace", "load the live trace");
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
 * sends a message to the live room's chat. only works while the stream's live. the first
 * send with a name in a set claims it for this browser's owner key, and for the rest of
 * that set only that key can use it.
 *
 * @param {string} nickname - the chatter's name.
 * @param {string} content - the message.
 * @param {string} ownerKey - this browser's secret key, which holds its name for the set.
 * @returns {Promise<DjChatMessage>} the stored message, with its id.
 * @throws {ChatNameTakenError} when someone else has the name this set.
 * @throws {Error} with a readable reason when it's off air, rate limited or invalid.
 */
export async function sendDjChat(nickname: string, content: string, ownerKey: string): Promise<DjChatMessage> {
  const response = await fetch(`${API_BASE}${DJ_CHAT_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, content, owner_key: ownerKey }),
  });
  if (response.status === HTTP_FORBIDDEN) throw new ChatNameTakenError(await chatSendFailure(response));
  if (!response.ok) throw new Error(await chatSendFailure(response));
  return (await response.json()) as DjChatMessage;
}

/** the live room's who's-here endpoints: who's in (GET), check in (POST), leave (POST /leave), photos (/photos). */
export const DJ_ROOM_PATH = "/dj/room";

/** room photos: upload (POST), one photo (GET /{id}), and the admin's list (GET) and remove (DELETE /{id}). */
export const DJ_ROOM_PHOTOS_PATH = `${DJ_ROOM_PATH}/photos`;

/** someone in the live room, as /dj/room sends them. */
export type DjRoomPerson = {
  nickname: string;
  /** unique in the room. under ROOM_CHARACTER_COUNT it's their character; photos get numbers from there up. */
  avatar: number;
  /** the photo they're standing in as, null for a character. */
  photo_id: number | null;
};

/** how someone wants to look in the room: a character they picked, or a photo they uploaded. null leaves it to the pi. */
export type DjRoomLook = { avatar: number } | { photoId: number } | null;

/** an uploaded room photo, as the upload and the admin's list send it. */
export type DjRoomPhoto = {
  id: number;
  created_at: string;
};

/**
 * a room photo's url. ids are never reused, so it's cached for good.
 *
 * @param {number} photoId - the photo.
 * @returns {string} absolute url.
 */
export function djRoomPhotoUrl(photoId: number): string {
  return `${API_BASE}${DJ_ROOM_PHOTOS_PATH}/${photoId}`;
}

/**
 * who's in the live room right now, without coming in (for the way in's picker).
 *
 * @returns {Promise<DjRoomPerson[]>} everyone in it, in the order they came in. empty off air.
 */
export async function fetchDjRoom(): Promise<DjRoomPerson[]> {
  return (await fetchDjJson<{ people: DjRoomPerson[] }>(DJ_ROOM_PATH, "see who's in the room")).people;
}

/**
 * why a room check-in failed, in words someone can act on.
 *
 * @param {Response} response - the failed response.
 * @returns {Promise<string>} the reason.
 */
async function roomFailure(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}));
  if (typeof body.detail === "string") return `${body.detail}.`;
  return `couldn't get into the room (the pi said ${response.status}). it'll keep trying.`;
}

/**
 * puts this browser in the live room under its chat name and look (or keeps it there),
 * and gets back everyone in it. the page calls it every few seconds while it's open;
 * stopping is how you leave, or leaveDjRoom to leave right away. it also claims the name
 * for the set, like a first chat message does. the room's only open while live.
 *
 * @param {string} nickname - the chat name.
 * @param {string} ownerKey - this browser's secret key (the chat's).
 * @param {DjRoomLook} look - the character or photo asked for, or null to keep whatever they had.
 * @returns {Promise<DjRoomPerson[]>} everyone in the room, in the order they came in.
 * @throws {ChatNameTakenError} when someone else has the name or the character, or the photo's gone.
 * @throws {Error} with a readable reason when the room's full or closed, or the pi's unreachable.
 */
export async function checkInDjRoom(nickname: string, ownerKey: string, look: DjRoomLook): Promise<DjRoomPerson[]> {
  const response = await fetch(`${API_BASE}${DJ_ROOM_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nickname,
      owner_key: ownerKey,
      avatar: look && "avatar" in look ? look.avatar : null,
      photo_id: look && "photoId" in look ? look.photoId : null,
    }),
  });
  if (response.status === HTTP_FORBIDDEN) throw new ChatNameTakenError(await roomFailure(response));
  if (!response.ok) throw new Error(await roomFailure(response));
  return ((await response.json()) as { people: DjRoomPerson[] }).people;
}

/**
 * uploads a picture to stand in the live room as. only works while live.
 *
 * @param {File} file - the picture.
 * @param {string} ownerKey - this browser's secret key, which owns it.
 * @returns {Promise<DjRoomPhoto>} the stored photo, with its id.
 * @throws {Error} with a readable reason when it's too big, isn't a picture, or the room's closed.
 */
export async function uploadDjRoomPhoto(file: File, ownerKey: string): Promise<DjRoomPhoto> {
  const form = new FormData();
  form.append("file", file);
  form.append("owner_key", ownerKey);
  const response = await fetch(`${API_BASE}${DJ_ROOM_PHOTOS_PATH}`, { method: "POST", body: form });
  if (response.status === HTTP_TOO_MANY_REQUESTS) throw new Error("that's a lot of pictures -- wait a minute and try again.");
  if (!response.ok) throw new Error(await roomFailure(response));
  return (await response.json()) as DjRoomPhoto;
}

/**
 * takes this browser out of the live room right away. keepalive so it still goes out
 * while the page is closing. best effort: if it's lost, the check-ins just time out.
 *
 * @param {string} ownerKey - this browser's secret key.
 */
export function leaveDjRoom(ownerKey: string): void {
  fetch(`${API_BASE}${DJ_ROOM_PATH}/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ owner_key: ownerKey }),
    keepalive: true,
  }).catch(() => {
    // it times out on the pi anyway
  });
}

/** the live alerts endpoints: signup, confirm, unsubscribe, and the admin's list and send. */
export const DJ_ALERTS_PATH = "/dj/alerts";

/** the site page that confirms or unsubscribes from an email's link, and signs people up otherwise. */
export const ALERTS_PAGE_PATH = `${LIVE_SECTION_PATH}/alerts`;

// match the backend (MAX_DJ_ALERT_*_LENGTH, MAX_EMAIL_LENGTH in schemas.py, and
// DEFAULT_ALERT_SUBJECT in routers/dj_alerts.py)
export const DJ_ALERT_EMAIL_MAX_LENGTH = 254;
export const DJ_ALERT_SUBJECT_MAX_LENGTH = 120;
export const DJ_ALERT_BODY_MAX_LENGTH = 2000;
export const DJ_ALERT_DEFAULT_SUBJECT = "Tyler's live in the den";

/**
 * a guest dj's default alert subject (GUEST_ALERT_SUBJECT in routers/dj_alerts.py).
 *
 * @param {string} name - the guest's name.
 * @returns {string} like "Tracepoint's live in the den".
 */
export function djGuestAlertSubject(name: string): string {
  return `${name}'s live in the den`;
}

/** someone signed up for live alerts, as the admin page lists them. times are naive UTC. */
export type DjAlertSubscriber = {
  id: number;
  email: string;
  created_at: string;
  /** when they clicked the confirmation link. only confirmed people get alerts. */
  confirmed_at: string | null;
};

/** how sending an alert went. */
export type DjAlertSendResult = {
  sent: number;
  /** addresses the mail server refused. always empty for a guest dj, who only gets the count. */
  failed: string[];
  /** how many the mail server refused. optional: a backend from before guest djs leaves it out. */
  failed_count?: number;
  /** the recording set the alert's subject and message were made the title and description of, if one was. */
  labelled_set_id: number | null;
};

/**
 * why a public alerts request failed, in words the visitor can act on.
 *
 * @param {Response} response - the failed response.
 * @returns {Promise<string>} the reason.
 */
async function alertsFailure(response: Response): Promise<string> {
  if (response.status === HTTP_TOO_MANY_REQUESTS) return "too many tries from here, wait a minute and try again.";
  const body = await response.json().catch(() => ({}));
  if (typeof body.detail === "string") return `${body.detail}.`;
  // pydantic's 422 for an address that doesn't look like one
  if (Array.isArray(body.detail)) return "that doesn't look like an email address.";
  return `something went wrong (the pi said ${response.status}). try again in a moment.`;
}

/**
 * posts to a public alerts endpoint, throwing a readable error when it fails.
 *
 * @param {string} path - path under /dj/alerts, with any query string.
 * @param {unknown} [body] - json body, if any.
 * @returns {Promise<Response>} the ok response.
 * @throws {Error} with a reason fit to show.
 */
async function postAlerts(path: string, body?: unknown): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${DJ_ALERTS_PATH}${path}`, {
      method: "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("couldn't reach the pi. check your connection and try again.");
  }
  if (!response.ok) throw new Error(await alertsFailure(response));
  return response;
}

/**
 * signs an address up for live alerts. the backend emails it a confirmation link, and it
 * answers the same whether the address is new or already on the list.
 *
 * @param {string} email - the address.
 * @returns {Promise<void>} resolves once the confirmation's on its way.
 * @throws {Error} with a readable reason (bad address, rate limited, mail down).
 */
export async function signUpForDjAlerts(email: string): Promise<void> {
  await postAlerts("/signup", { email });
}

/**
 * confirms a signup, from the token in the confirmation email's link.
 *
 * @param {string} token - the token.
 * @returns {Promise<string>} the confirmed address.
 * @throws {Error} with a readable reason, like the link not matching a signup anymore.
 */
export async function confirmDjAlerts(token: string): Promise<string> {
  const response = await postAlerts(`/confirm?token=${encodeURIComponent(token)}`);
  return ((await response.json()) as { email: string }).email;
}

/**
 * unsubscribes, from the token in an alert's link. fine to call twice.
 *
 * @param {string} token - the token.
 * @returns {Promise<void>} resolves once they're off the list.
 * @throws {Error} with a readable reason if the pi can't be reached.
 */
export async function unsubscribeFromDjAlerts(token: string): Promise<void> {
  await postAlerts(`/unsubscribe?token=${encodeURIComponent(token)}`);
}
