"use client";

import { useState } from "react";
import KitchenModal from "./KitchenModal";
import KitchenButton from "./KitchenButton";
import { KitchenInput, KitchenLabel } from "./KitchenFormControls";

interface AdminLoginModalProps {
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<string | null>;
}

/**
 * Small login form for the admin account (see useAdminAuth) so edit/delete
 * controls can be unlocked from a phone.
 *
 * @param {AdminLoginModalProps} props - Component props.
 * @param {() => void} props.onClose - Called when the modal should close.
 * @param {(email: string, password: string) => Promise<string | null>} props.onLogin - Login action; resolves to an error message or null on success.
 * @returns {JSX.Element} The login modal.
 */
export default function AdminLoginModal({ onClose, onLogin }: AdminLoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Attempts the login and closes the modal on success. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const err = await onLogin(email.trim(), password);
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    onClose();
  }

  return (
    <KitchenModal title="Admin Login" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <KitchenLabel htmlFor="admin-email">Email</KitchenLabel>
          <KitchenInput
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div>
          <KitchenLabel htmlFor="admin-password">Password</KitchenLabel>
          <KitchenInput
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && (
          <p className="text-[13px] text-[var(--k-fg-danger-strong)] bg-[var(--k-danger-soft)] border border-[var(--k-border-danger-subtle)] rounded-[3px] px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <KitchenButton type="button" variant="ghost" onClick={onClose}>
            Cancel
          </KitchenButton>
          <KitchenButton type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Logging in..." : "Log In"}
          </KitchenButton>
        </div>
      </form>
    </KitchenModal>
  );
}
