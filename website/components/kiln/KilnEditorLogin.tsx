"use client";

import { useState } from "react";
import type { AdminAuth } from "@/lib/useAdminAuth";

/**
 * the kiln editor's login, tucked at the bottom of the page. logged out it's a link that
 * opens a username and password form. logged in it says so, with a log out button.
 *
 * @param {object} props - component props.
 * @param {AdminAuth} props.auth - the kiln editor login, from useAdminAuth.
 * @returns {JSX.Element | null} the control, or nothing until the stored login's been read.
 */
export default function KilnEditorLogin({ auth }: { auth: AdminAuth }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!auth.ready) return null;

  if (auth.isAdmin) {
    return (
      <div className="kiln-login">
        <span>Logged in. You can add notes and photos to any firing.</span>
        <button type="button" className="kiln-link-button" onClick={auth.logout}>
          Log out
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="kiln-login">
        <button type="button" className="kiln-link-button" onClick={() => setOpen(true)}>
          Jude&apos;s login
        </button>
      </div>
    );
  }

  /**
   * logs in, closing the form if it worked.
   *
   * @param {React.FormEvent} event - the submit.
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const failure = await auth.login(username.trim(), password);
    setBusy(false);
    setError(failure);
    if (!failure) {
      setPassword("");
      setOpen(false);
    }
  };

  return (
    <form className="kiln-login kiln-login-form" onSubmit={handleSubmit}>
      <input
        className="kiln-input"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        placeholder="Username"
        autoComplete="username"
        autoCapitalize="none"
        aria-label="Username"
      />
      <input
        className="kiln-input"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        autoComplete="current-password"
        aria-label="Password"
      />
      <button type="submit" className="kiln-button" disabled={busy || !username.trim() || !password}>
        {busy ? "Logging in" : "Log in"}
      </button>
      <button type="button" className="kiln-link-button" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error && (
        <p className="kiln-journal-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
