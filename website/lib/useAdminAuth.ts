"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "./api";

const MS_PER_S = 1000;

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
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
}

/**
 * Tracks the admin JWT (see pi/services/website-backend/app/routers/auth.py)
 * in localStorage, so admin controls survive a reload and work from a phone.
 * Each page that uses it passes its own storage key, so logging into one
 * doesn't log you into another. An already-expired stored token is discarded
 * on mount so the login shows again instead of dead admin controls.
 *
 * @param {string} storageKey - localStorage key to keep the token under.
 * @returns {AdminAuth} Current token/admin state plus login and logout actions.
 */
export function useAdminAuth(storageKey: string): AdminAuth {
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
   * @param {string} email - Admin email.
   * @param {string} password - Admin password.
   * @returns {Promise<string | null>} An error message, or null on success.
   */
  const login = useCallback(
    async (email: string, password: string) => {
      const body = new URLSearchParams({ username: email, password });
      let res: Response;
      try {
        res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
      } catch {
        return `couldn't reach ${API_BASE} - check your connection, or whether the Pi is up (${API_BASE}/health)`;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return typeof data.detail === "string" ? data.detail : "login failed - check your email and password";
      }

      const data = await res.json();
      window.localStorage.setItem(storageKey, data.access_token);
      setToken(data.access_token);
      return null;
    },
    [storageKey]
  );

  /** Clears the stored admin token, hiding admin controls again. */
  const logout = useCallback(() => {
    window.localStorage.removeItem(storageKey);
    setToken(null);
  }, [storageKey]);

  return { token, isAdmin: token !== null, ready, login, logout };
}
