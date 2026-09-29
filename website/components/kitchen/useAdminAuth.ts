"use client";

import { useCallback, useEffect, useState } from "react";
import { ADMIN_TOKEN_STORAGE_KEY, API_BASE } from "./types";

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

interface AdminAuth {
  token: string | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
}

/**
 * Tracks the admin JWT for The Kitchen's edit/delete controls.
 *
 * The token is the same one used by the gallery admin tooling (see
 * pi/services/website-backend/app/routers/auth.py) -- it's just stashed in
 * localStorage here so edit/delete buttons can show up after logging in
 * from a phone. An already-expired stored token is discarded on mount so
 * the "Admin" login button shows up again instead of dead edit controls.
 *
 * @returns {AdminAuth} Current token/admin state plus login and logout actions.
 */
export function useAdminAuth(): AdminAuth {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // deliberately deferred to after mount -- reading localStorage during
    // render would mismatch the static-exported (server) HTML, which has no
    // window and always renders as logged-out
    const stored = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    if (stored && isTokenExpired(stored)) {
      window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(stored);
  }, []);

  /**
   * Logs in against the backend and stores the returned JWT.
   *
   * @param {string} email - Admin email.
   * @param {string} password - Admin password.
   * @returns {Promise<string | null>} An error message, or null on success.
   */
  const login = useCallback(async (email: string, password: string) => {
    const body = new URLSearchParams({ username: email, password });
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return typeof data.detail === "string" ? data.detail : "login failed - check your email and password";
    }

    const data = await res.json();
    window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, data.access_token);
    setToken(data.access_token);
    return null;
  }, []);

  /** Clears the stored admin token, hiding edit/delete controls again. */
  const logout = useCallback(() => {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setToken(null);
  }, []);

  return { token, isAdmin: token !== null, login, logout };
}
