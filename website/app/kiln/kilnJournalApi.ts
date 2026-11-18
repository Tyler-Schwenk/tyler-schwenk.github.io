import { API_BASE } from "@/lib/api";

/** the kiln editor login (pi/services/website-backend/app/routers/kiln_journal.py). */
export const KILN_LOGIN_PATH = "/kiln/auth/login";
/** where the kiln page keeps the editor's token, separate from the admin page's. */
export const KILN_TOKEN_KEY = "kiln-editor-token";

/** a note on a firing. times are iso utc. noted_at is null for a general note. */
export type KilnNote = {
  id: number;
  firing_id: number;
  body: string;
  noted_at: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string | null;
};

/** what the note form sends. noted_at is null for a general note. */
export type KilnNoteInput = {
  body: string;
  noted_at: string | null;
  is_public: boolean;
};

/** a photo from a firing. its image comes from kilnPhotoUrl. */
export type KilnPhoto = {
  id: number;
  firing_id: number;
  width: number | null;
  height: number | null;
  is_public: boolean;
  created_at: string;
};

/** a failed journal request. status 401 means the login's expired. */
export class KilnJournalError extends Error {
  status: number;

  /**
   * @param {string} message - what went wrong, readable as is.
   * @param {number} status - the http status, 0 when the backend couldn't be reached.
   */
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * builds the headers for a request, with the editor's token if there is one.
 *
 * @param {string | null} token - the kiln editor's jwt, or null for the public view.
 * @returns {HeadersInit} the headers.
 */
const authHeaders = (token: string | null): HeadersInit => (token ? { Authorization: `Bearer ${token}` } : {});

/**
 * sends a request to the kiln journal and turns failures into readable errors.
 *
 * @param {string} path - path under /kiln.
 * @param {string | null} token - the kiln editor's jwt, or null for the public view.
 * @param {RequestInit} [init] - method, body and so on.
 * @returns {Promise<Response>} the successful response.
 * @throws {KilnJournalError} when the backend can't be reached or answers with an error.
 */
async function journalRequest(path: string, token: string | null, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/kiln${path}`, {
      ...init,
      cache: "no-store",
      headers: { ...authHeaders(token), ...init.headers },
    });
  } catch {
    throw new KilnJournalError("Couldn't reach the kiln server. Check your connection and try again.", 0);
  }
  if (res.ok) return res;
  const data = await res.json().catch(() => ({}));
  const detail = typeof data.detail === "string" ? data.detail : `the server said ${res.status}`;
  const message = res.status === 401 ? "Your login has expired. Log in again." : `That didn't work: ${detail}.`;
  throw new KilnJournalError(message, res.status);
}

/**
 * sends json and returns the json answer.
 *
 * @param {string} path - path under /kiln.
 * @param {string} token - the kiln editor's jwt.
 * @param {string} method - POST or PATCH.
 * @param {unknown} body - what to send.
 * @returns {Promise<T>} the parsed answer.
 */
async function sendJson<T>(path: string, token: string, method: string, body: unknown): Promise<T> {
  const res = await journalRequest(path, token, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * gets a firing's notes. without a token, only the public ones.
 *
 * @param {number} firingId - the firing's id.
 * @param {string | null} token - the kiln editor's jwt, or null.
 * @returns {Promise<KilnNote[]>} general notes first, then pinned ones by time.
 */
export const fetchKilnNotes = async (firingId: number, token: string | null): Promise<KilnNote[]> =>
  (await journalRequest(`/firings/${firingId}/notes`, token)).json();

/**
 * gets a firing's photos. without a token, only the public ones.
 *
 * @param {number} firingId - the firing's id.
 * @param {string | null} token - the kiln editor's jwt, or null.
 * @returns {Promise<KilnPhoto[]>} oldest upload first.
 */
export const fetchKilnPhotos = async (firingId: number, token: string | null): Promise<KilnPhoto[]> =>
  (await journalRequest(`/firings/${firingId}/photos`, token)).json();

/**
 * adds a note to a firing.
 *
 * @param {number} firingId - the firing's id.
 * @param {KilnNoteInput} note - the note.
 * @param {string} token - the kiln editor's jwt.
 * @returns {Promise<KilnNote>} the saved note.
 */
export const createKilnNote = (firingId: number, note: KilnNoteInput, token: string): Promise<KilnNote> =>
  sendJson(`/firings/${firingId}/notes`, token, "POST", note);

/**
 * changes a note. only the fields given change.
 *
 * @param {number} noteId - the note's id.
 * @param {Partial<KilnNoteInput>} changes - the new values.
 * @param {string} token - the kiln editor's jwt.
 * @returns {Promise<KilnNote>} the note as it is now.
 */
export const updateKilnNote = (noteId: number, changes: Partial<KilnNoteInput>, token: string): Promise<KilnNote> =>
  sendJson(`/notes/${noteId}`, token, "PATCH", changes);

/**
 * deletes a note.
 *
 * @param {number} noteId - the note's id.
 * @param {string} token - the kiln editor's jwt.
 * @returns {Promise<void>} resolves once it's gone.
 */
export const deleteKilnNote = async (noteId: number, token: string): Promise<void> => {
  await journalRequest(`/notes/${noteId}`, token, { method: "DELETE" });
};

/**
 * uploads one photo to a firing.
 *
 * @param {number} firingId - the firing's id.
 * @param {File} file - the image.
 * @param {boolean} isPublic - whether people who aren't logged in can see it.
 * @param {string} token - the kiln editor's jwt.
 * @returns {Promise<KilnPhoto>} the saved photo.
 */
export const uploadKilnPhoto = async (firingId: number, file: File, isPublic: boolean, token: string): Promise<KilnPhoto> => {
  const form = new FormData();
  form.append("file", file);
  form.append("is_public", String(isPublic));
  return (await journalRequest(`/firings/${firingId}/photos`, token, { method: "POST", body: form })).json();
};

/**
 * makes a photo public or private.
 *
 * @param {number} photoId - the photo's id.
 * @param {boolean} isPublic - the new setting.
 * @param {string} token - the kiln editor's jwt.
 * @returns {Promise<KilnPhoto>} the photo as it is now.
 */
export const updateKilnPhoto = (photoId: number, isPublic: boolean, token: string): Promise<KilnPhoto> =>
  sendJson(`/photos/${photoId}`, token, "PATCH", { is_public: isPublic });

/**
 * deletes a photo.
 *
 * @param {number} photoId - the photo's id.
 * @param {string} token - the kiln editor's jwt.
 * @returns {Promise<void>} resolves once it's gone.
 */
export const deleteKilnPhoto = async (photoId: number, token: string): Promise<void> => {
  await journalRequest(`/photos/${photoId}`, token, { method: "DELETE" });
};

/**
 * the address of a photo's image. private ones need the token, so they go through
 * fetchKilnPhotoBlob instead of an img src.
 *
 * @param {number} photoId - the photo's id.
 * @param {boolean} thumbnail - the small version.
 * @returns {string} the url.
 */
export const kilnPhotoUrl = (photoId: number, thumbnail: boolean): string =>
  `${API_BASE}/kiln/photos/${photoId}/file${thumbnail ? "?thumbnail=true" : ""}`;

/**
 * gets a private photo's image with the editor's token.
 *
 * @param {number} photoId - the photo's id.
 * @param {boolean} thumbnail - the small version.
 * @param {string} token - the kiln editor's jwt.
 * @returns {Promise<Blob>} the image.
 */
export const fetchKilnPhotoBlob = async (photoId: number, thumbnail: boolean, token: string): Promise<Blob> =>
  (await journalRequest(`/photos/${photoId}/file${thumbnail ? "?thumbnail=true" : ""}`, token)).blob();
