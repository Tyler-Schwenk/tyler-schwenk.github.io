"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

/**
 * Talking to the backend as the admin: every request carries the JWT, a 401
 * logs the page out (the token expired or the secret changed), and failures
 * become errors that say what went wrong, ready to show as-is.
 */

/** Sends one request to the backend with the admin token. Throws AdminRequestError. */
export type AdminFetch = (path: string, init?: RequestInit) => Promise<Response>;

/** A request that failed, with a message fit for showing to the admin. */
export class AdminRequestError extends Error {
  /** True when the token was rejected and the page has logged out. */
  readonly sessionExpired: boolean;

  /**
   * @param message - What failed and what to do about it.
   * @param sessionExpired - Whether it was the token.
   */
  constructor(message: string, sessionExpired = false) {
    super(message);
    this.name = "AdminRequestError";
    this.sessionExpired = sessionExpired;
  }
}

const UNREACHABLE_MESSAGE = `couldn't reach ${API_BASE} - check your connection, or whether the Pi is up (${API_BASE}/health)`;

/**
 * Builds the admin fetch for a token.
 * @param token - The admin JWT.
 * @param onUnauthorized - Called on a 401, to log out.
 * @returns A fetch that adds the token and turns failures into AdminRequestErrors.
 */
export function createAdminFetch(token: string, onUnauthorized: () => void): AdminFetch {
  return async (path, init = {}) => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      throw new AdminRequestError(UNREACHABLE_MESSAGE);
    }
    if (res.status === 401) {
      onUnauthorized();
      throw new AdminRequestError("your login expired - log in again", true);
    }
    return res;
  };
}

/**
 * The backend's reason for a failed response, if it gave one.
 * @param res - A non-ok response.
 * @returns FastAPI's `detail` when it's a string, else the status.
 */
async function failureReason(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return typeof body.detail === "string" ? body.detail : `HTTP ${res.status}`;
}

/**
 * Sends a request and reads its json, throwing on any failure.
 * @param adminFetch - From useAdminFetch.
 * @param path - Path under the API, with any query string.
 * @param failure - What failed, like "couldn't load galleries"; the backend's reason is appended.
 * @param init - Fetch options.
 * @returns The parsed body, or null for an empty one (204).
 */
export async function adminRequest<T>(
  adminFetch: AdminFetch,
  path: string,
  failure: string,
  init?: RequestInit
): Promise<T | null> {
  const res = await adminFetch(path, init);
  if (!res.ok) throw new AdminRequestError(`${failure}: ${await failureReason(res)}`);
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : null;
}

/**
 * Request options for a json body.
 * @param method - HTTP method.
 * @param body - Body to send as json.
 * @returns Fetch options.
 */
export function jsonBody(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

/**
 * The message to show for a caught error.
 * @param err - Whatever was thrown.
 * @returns Its message, or a generic one for something unexpected.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "something went wrong - check the browser console for details";
}

export const AdminFetchContext = createContext<AdminFetch | null>(null);

/**
 * The admin fetch for the logged-in session.
 * @returns The fetch provided by the admin page.
 */
export function useAdminFetch(): AdminFetch {
  const adminFetch = useContext(AdminFetchContext);
  if (!adminFetch) throw new Error("useAdminFetch needs AdminFetchContext - render it inside the admin page");
  return adminFetch;
}

/** Data loaded by useAdminData. */
export interface AdminData<T> {
  /** The latest answer, or null until the first one arrives. */
  data: T | null;
  /** Why the last load failed, if it did. */
  error: string | null;
  /** Loads it again (the old data stays up meanwhile). */
  reload: () => void;
  /** Replaces the data locally, e.g. dropping a deleted row without a reload. */
  setData: (update: (current: T | null) => T | null) => void;
}

/**
 * Loads json from the backend as the admin when mounted (and when `path` changes).
 * @param path - Path under the API, with any query string.
 * @param failure - What failed, for the error message, like "couldn't load galleries".
 * @returns The data, its error, and ways to reload or patch it.
 */
export function useAdminData<T>(path: string, failure: string): AdminData<T> {
  const adminFetch = useAdminFetch();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadCount, setLoadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    adminRequest<T>(adminFetch, path, failure)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [adminFetch, path, failure, loadCount]);

  const reload = useCallback(() => setLoadCount((count) => count + 1), []);
  return { data, error, reload, setData };
}
