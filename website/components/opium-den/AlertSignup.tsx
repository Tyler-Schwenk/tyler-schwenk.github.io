"use client";

import { useState, type FormEvent } from "react";
import { DJ_ALERT_EMAIL_MAX_LENGTH, signUpForDjAlerts } from "@/app/opium-den/djApi";

// 16px text on phones: ios zooms the whole page into any input smaller than that
const EMAIL_INPUT_CLASS =
  "min-w-0 flex-1 border border-den-ink bg-den-raised px-3 py-2 text-base text-den-ink placeholder:text-den-faint focus:border-den-accent focus:outline-none sm:text-sm";

/**
 * the live alerts signup: an email box that asks the backend to send a confirmation.
 * once it's sent, the form turns into "check your inbox" (and your spam). starts as a small mono
 * link with a red underline that opens it, unless `startOpen`, so it stays out of the way on busy pages.
 * `prominent` makes that link a big ink pill instead, for when signing up is the main thing
 * to do, like the live monitor off air.
 *
 * @param {object} props
 * @param {boolean} [props.startOpen] - show the form straight away instead of the link.
 * @param {boolean} [props.prominent] - the link's a big pill button, "get notified when we go live".
 * @param {string} [props.className] - extra classes for the outer element.
 * @returns {JSX.Element} the signup.
 */
export default function AlertSignup({
  startOpen = false,
  prominent = false,
  className = "",
}: {
  startOpen?: boolean;
  prominent?: boolean;
  className?: string;
}) {
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

  if (!open && prominent) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-full bg-den-ink px-6 py-3 text-base font-semibold text-den-bg transition hover:bg-den-accent active:scale-95 ${className}`}
      >
        Get notified when we go live &rarr;
      </button>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`border-b border-den-accent font-den-mono text-[11px] uppercase transition-colors hover:text-den-accent-soft ${className}`}
      >
        Get an email when I go live
      </button>
    );
  }

  if (sentTo) {
    return (
      <div role="status" className={`text-sm text-den-muted ${className}`}>
        <p>
          Check your inbox at <span className="text-den-ink">{sentTo}</span> and tap the link to confirm.
        </p>
        {/* a plain gmail address sending a link to a personal site tends to get flagged */}
        <p className="mt-1 text-den-accent-soft">
          Make sure to check your spam! The email has a shady looking link from me in it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={className}>
      <label htmlFor="den-alert-email" className="block text-sm font-semibold">
        Get an email when I go live
      </label>
      <p className="mt-0.5 font-den-mono text-[11px] text-den-muted">
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
          className="min-h-10 shrink-0 bg-den-ink px-4 text-sm font-medium text-den-bg transition hover:bg-den-accent disabled:opacity-40"
        >
          {sending ? "Sending..." : "Sign up"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-den-accent-soft">{error}</p>}
    </form>
  );
}
