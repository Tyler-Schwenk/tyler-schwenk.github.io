"use client";

import { useCallback, useEffect, useState } from "react";
import { ADMIN_TOKEN_STORAGE_KEY, API_BASE } from "./types";

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
 * from a phone.
 *
 * @returns {AdminAuth} Current token/admin state plus login and logout actions.
 */
export function useAdminAuth(): AdminAuth {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // deliberately deferred to after mount -- reading localStorage during
    // render would mismatch the static-exported (server) HTML, which has no
    // window and always renders as logged-out
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY));
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
