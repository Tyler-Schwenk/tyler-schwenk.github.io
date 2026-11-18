"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "./api";

const MS_PER_S = 1000;
/** the backend's rate limiter answers with this, and no `detail` to show. */
const TOO_MANY_REQUESTS_STATUS = 429;

/**
 * Checks whether a JWT's `exp` claim has passed. Only reads the
 * payload client-side (no signature check) -- the backend is still the real
 * gatekeeper, this just stops us showing admin controls for a dead token.
 *
 * @param {string} token - The stored JWT.
 * @returns {boolean} True if the token is expired or unreadable; false if it's still valid.
 */
function isTokenExpired(token: string): boolean {
  try {
    const payloadB64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(window.atob(payloadB64));
    return typeof payload.exp !== "number" || payload.exp * MS_PER_S <= Date.now();
  } catch {
    return true;
  }
}

export interface AdminAuth {
  token: string | null;
  isAdmin: boolean;
  /** False until the stored token has been read, so pages don't flash a login form at a logged-in admin. */
  ready: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => void;
}

/** the admin login (pi/services/website-backend/app/routers/auth.py). */
const ADMIN_LOGIN_PATH = "/auth/login";

/**
 * Tracks a login's JWT in localStorage, so admin controls survive a reload and
 * work from a phone. Each page that uses it passes its own storage key, so
 * logging into one doesn't log you into another. An already-expired stored
 * token is discarded on mount so the login shows again instead of dead admin
 * controls.
 *
 * @param {string} storageKey - localStorage key to keep the token under.
 * @param {string} [loginPath] - backend endpoint that swaps a username and
 *   password for a token. Defaults to the admin login; the kiln page passes
 *   its own, for the kiln editor login.
 * @returns {AdminAuth} Current token/admin state plus login and logout actions.
 */
export function useAdminAuth(storageKey: string, loginPath: string = ADMIN_LOGIN_PATH): AdminAuth {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // deliberately deferred to after mount -- reading localStorage during
    // render would mismatch the static-exported (server) HTML, which has no
    // window and always renders as logged-out
    const stored = window.localStorage.getItem(storageKey);
    if (stored && isTokenExpired(stored)) {
      window.localStorage.removeItem(storageKey);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(stored);
    }
    setReady(true);
  }, [storageKey]);

  /**
   * Logs in against the backend and stores the returned JWT.
   *
   * @param {string} username - Admin email, or the username for logins that use one.
   * @param {string} password - The password.
   * @returns {Promise<string | null>} An error message, or null on success.
   */
  const login = useCallback(
    async (username: string, password: string) => {
      const body = new URLSearchParams({ username, password });
      let res: Response;
      try {
        res = await fetch(`${API_BASE}${loginPath}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
      } catch {
        return `couldn't reach ${API_BASE} - check your connection, or whether the Pi is up (${API_BASE}/health)`;
      }

      if (res.status === TOO_MANY_REQUESTS_STATUS) {
        return "too many login tries - wait a minute and try again";
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return typeof data.detail === "string" ? data.detail : "login failed - check your username and password";
      }

      const data = await res.json();
      window.localStorage.setItem(storageKey, data.access_token);
      setToken(data.access_token);
      return null;
    },
    [storageKey, loginPath]
  );

  /** Clears the stored admin token, hiding admin controls again. */
  const logout = useCallback(() => {
    window.localStorage.removeItem(storageKey);
    setToken(null);
  }, [storageKey]);

  return { token, isAdmin: token !== null, ready, login, logout };
}
