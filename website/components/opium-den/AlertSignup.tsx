"use client";

import { useState, type FormEvent } from "react";
import { DJ_ALERT_EMAIL_MAX_LENGTH, signUpForDjAlerts } from "@/app/opium-den/djApi";

// 16px text on phones: ios zooms the whole page into any input smaller than that
const EMAIL_INPUT_CLASS =
  "min-w-0 flex-1 rounded-md border border-den-line bg-den-bg px-3 py-2 text-base text-den-ink placeholder:text-den-faint focus:border-den-accent/60 focus:outline-none sm:text-sm";

/**
 * the live alerts signup: an email box that asks the backend to send a confirmation.
 * once it's sent, the form turns into "check your inbox". starts as a small red text
 * link that opens it, unless `startOpen`, so it stays out of the way on busy pages.
 *
 * @param {object} props
 * @param {boolean} [props.startOpen] - show the form straight away instead of the link.
 * @param {string} [props.className] - extra classes for the outer element.
 * @returns {JSX.Element} the signup.
 */
export default function AlertSignup({ startOpen = false, className = "" }: { startOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(startOpen);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!address || sending) return;
    setSending(true);
    try {
      await signUpForDjAlerts(address);
      setSentTo(address);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-sm text-den-accent-soft underline-offset-4 transition-colors hover:text-den-ink hover:underline ${className}`}
      >
        Get an email when I go live
      </button>
    );
  }

  if (sentTo) {
    return (
      <p role="status" className={`text-sm text-den-muted ${className}`}>
        Check your inbox at <span className="text-den-ink">{sentTo}</span> and tap the link to confirm.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={className}>
      <label htmlFor="den-alert-email" className="block text-sm font-medium">
        Get an email when I go live
      </label>
      <p className="mt-0.5 text-xs text-den-muted">
        you&apos;ll confirm by email first, and every email has an unsubscribe link.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          id="den-alert-email"
          type="email"
          required
          autoFocus={!startOpen}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          maxLength={DJ_ALERT_EMAIL_MAX_LENGTH}
          className={EMAIL_INPUT_CLASS}
        />
        <button
          type="submit"
          disabled={!email.trim() || sending}
          className="min-h-10 shrink-0 rounded-md bg-den-accent px-4 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-40"
        >
          {sending ? "Sending..." : "Sign up"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-den-accent-soft">{error}</p>}
    </form>
  );
}
