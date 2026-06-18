"use client";

import { useState } from "react";

const API_BASE = "https://api.tyler-schwenk.com";

type ContactType = "phone" | "email";
type SubmitState = "idle" | "submitting" | "success" | "error";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_SEPARATORS_PATTERN = /[\s\-().]/g;
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;
const MAX_FRIENDS_COUNT = 50;

/**
 * Validates a contact value against its chosen type.
 *
 * Mirrors the backend rules so users get instant feedback before submitting.
 *
 * @param {ContactType} type - Whether value is a phone or email.
 * @param {string} value - The raw contact value.
 * @returns {string | null} An error message, or null if valid.
 */
function validateContact(type: ContactType, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return type === "email" ? "enter your email" : "enter your phone number";
  }
  if (type === "email") {
    return EMAIL_PATTERN.test(trimmed)
      ? null
      : "that doesn't look like a valid email - check for typos";
  }
  const digits = trimmed.replace(PHONE_SEPARATORS_PATTERN, "").replace(/^\+/, "");
  const validPhone =
    /^\d+$/.test(digits) &&
    digits.length >= MIN_PHONE_DIGITS &&
    digits.length <= MAX_PHONE_DIGITS;
  return validPhone
    ? null
    : "that doesn't look like a valid phone number - include the area code";
}

/**
 * Inline RSVP form for an event. Collects a phone or email, a friend count,
 * and follow-up preferences, then posts them to the backend.
 *
 * @param {object} props - Component props.
 * @param {string} props.eventSlug - Slug of the event being RSVP'd to.
 * @returns {JSX.Element} The RSVP form section.
 */
export default function EventRsvpForm({ eventSlug }: { eventSlug: string }) {
  const [contactType, setContactType] = useState<ContactType>("phone");
  const [contactValue, setContactValue] = useState("");
  const [friendsCount, setFriendsCount] = useState(0);
  const [wantsAddress, setWantsAddress] = useState(true);
  const [wantsReminder, setWantsReminder] = useState(false);
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string | null>(null);

  /**
   * Validates input and posts the RSVP to the backend.
   *
   * @param {React.FormEvent} e - The form submit event.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const contactError = validateContact(contactType, contactValue);
    if (contactError) {
      setError(contactError);
      setState("error");
      return;
    }

    setState("submitting");
    try {
      const res = await fetch(`${API_BASE}/events/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_slug: eventSlug,
          contact_type: contactType,
          contact_value: contactValue.trim(),
          friends_count: friendsCount,
          wants_address: wantsAddress,
          wants_reminder: wantsReminder,
        }),
      });

      if (res.status === 429) {
        setError("too many submissions from your network - give it a minute and try again");
        setState("error");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : "something went wrong - try again in a moment";
        setError(detail);
        setState("error");
        return;
      }

      setState("success");
    } catch {
      setError("couldn't reach the server - check your connection and try again");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="border-t border-slate-700 pt-8">
        <h2 className="text-lg font-semibold text-white mb-3">RSVP</h2>
        <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-5 text-green-200">
          <p className="font-semibold">You&apos;re on the list.</p>
          <p className="text-sm mt-1 text-green-200/80">
            We&apos;ll reach out
            {wantsAddress ? " with the address the day before" : ""}
            {wantsAddress && wantsReminder ? " and" : ""}
            {wantsReminder ? " with a reminder ahead of time" : ""}.
          </p>
        </div>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 transition";

  return (
    <div className="border-t border-slate-700 pt-8">
      <h2 className="text-lg font-semibold text-white mb-2">RSVP</h2>
      <p className="text-sm text-slate-400 mb-5">
        Drop your contact and we&apos;ll keep you posted on the details.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <ContactTypeToggle value={contactType} onChange={setContactType} />

        <div>
          <label htmlFor="rsvp-contact" className="block text-xs uppercase tracking-wide text-slate-400 mb-2">
            {contactType === "phone" ? "Phone number" : "Email address"}
          </label>
          <input
            id="rsvp-contact"
            type={contactType === "phone" ? "tel" : "email"}
            inputMode={contactType === "phone" ? "tel" : "email"}
            value={contactValue}
            onChange={(e) => setContactValue(e.target.value)}
            placeholder={contactType === "phone" ? "(555) 123-4567" : "you@example.com"}
            className={inputClass}
            autoComplete={contactType === "phone" ? "tel" : "email"}
          />
        </div>

        <div>
          <label htmlFor="rsvp-friends" className="block text-xs uppercase tracking-wide text-slate-400 mb-2">
            I&apos;m bringing this many friends
          </label>
          <input
            id="rsvp-friends"
            type="number"
            min={0}
            max={MAX_FRIENDS_COUNT}
            value={friendsCount}
            onChange={(e) => setFriendsCount(clampFriends(e.target.value))}
            className={`${inputClass} max-w-[8rem]`}
          />
        </div>

        <div className="space-y-3">
          <CheckboxRow
            id="rsvp-address"
            checked={wantsAddress}
            onChange={setWantsAddress}
            label="Just give me the address the day before"
          />
          <CheckboxRow
            id="rsvp-reminder"
            checked={wantsReminder}
            onChange={setWantsReminder}
            label="Feel free to send a reminder a week or two ahead"
          />
        </div>

        {error && (
          <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={state === "submitting"}
          className="inline-flex items-center justify-center rounded-full bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {state === "submitting" ? "Sending..." : "Submit RSVP"}
        </button>
      </form>
    </div>
  );
}

/**
 * Clamps a raw number-input string to the allowed friend range.
 *
 * @param {string} raw - The input's string value.
 * @returns {number} A whole number between 0 and the max.
 */
function clampFriends(raw: string): number {
  const n = Math.floor(Number(raw));
  if (Number.isNaN(n) || n < 0) {
    return 0;
  }
  return Math.min(n, MAX_FRIENDS_COUNT);
}

/**
 * Segmented toggle for choosing phone vs email contact.
 *
 * @param {object} props - Component props.
 * @param {ContactType} props.value - Currently selected contact type.
 * @param {(t: ContactType) => void} props.onChange - Selection handler.
 * @returns {JSX.Element} The toggle control.
 */
function ContactTypeToggle({
  value,
  onChange,
}: {
  value: ContactType;
  onChange: (t: ContactType) => void;
}) {
  const options: ContactType[] = ["phone", "email"];
  return (
    <div className="inline-flex rounded-full border border-slate-600 bg-slate-800/60 p-1">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded-full px-5 py-1.5 text-sm font-medium capitalize transition ${
            value === opt
              ? "bg-indigo-500 text-white"
              : "text-slate-300 hover:text-white"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/**
 * A labeled checkbox row styled for the dark event page.
 *
 * @param {object} props - Component props.
 * @param {string} props.id - Input id, also ties the label.
 * @param {boolean} props.checked - Current checked state.
 * @param {(v: boolean) => void} props.onChange - Change handler.
 * @param {string} props.label - Visible label text.
 * @returns {JSX.Element} The checkbox row.
 */
function CheckboxRow({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 text-slate-200 cursor-pointer">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-400"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}
