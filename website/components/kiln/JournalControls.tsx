"use client";

import { useCallback, useState } from "react";
import { KilnJournalError } from "@/app/kiln/kilnJournalApi";

/** the http status the backend answers an expired or bad login with. */
const UNAUTHORIZED_STATUS = 401;

/** one option in a ChoiceChips row. */
export type Choice<T extends string> = { value: T; label: string };

/**
 * a row of chips where exactly one is picked, like a segmented control.
 *
 * @param {object} props - component props.
 * @param {string} props.label - what the choice is, for screen readers.
 * @param {Choice<T>[]} props.choices - the options.
 * @param {T} props.value - the picked one.
 * @param {(value: T) => void} props.onChange - called with the new pick.
 * @returns {JSX.Element} the chips.
 */
export function ChoiceChips<T extends string>({
  label,
  choices,
  value,
  onChange,
}: {
  label: string;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="kiln-chips" role="group" aria-label={label}>
      {choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          aria-pressed={choice.value === value}
          onClick={() => onChange(choice.value)}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

type Visibility = "private" | "public";

const VISIBILITY_CHOICES: Choice<Visibility>[] = [
  { value: "private", label: "Private" },
  { value: "public", label: "Public" },
];

/**
 * picks whether something shows for people who aren't logged in.
 *
 * @param {object} props - component props.
 * @param {boolean} props.isPublic - the current setting.
 * @param {(isPublic: boolean) => void} props.onChange - called with the new setting.
 * @returns {JSX.Element} the private/public chips.
 */
export function VisibilityChips({ isPublic, onChange }: { isPublic: boolean; onChange: (isPublic: boolean) => void }) {
  return (
    <ChoiceChips
      label="Who can see it"
      choices={VISIBILITY_CHOICES}
      value={isPublic ? "public" : "private"}
      onChange={(value) => onChange(value === "public")}
    />
  );
}

/** a write in progress, its last error, and the function that starts one. */
export type JournalAction = {
  busy: boolean;
  error: string | null;
  /** runs the write. resolves true if it worked. */
  run: (write: () => Promise<unknown>) => Promise<boolean>;
};

/**
 * runs journal writes one at a time, keeping track of whether one's going and what went
 * wrong. an expired login logs the editor out, so they see the login form again.
 *
 * @param {() => void} onAuthExpired - logs the editor out.
 * @returns {JournalAction} the state and the runner.
 */
export function useJournalAction(onAuthExpired: () => void): JournalAction {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (write: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await write();
        return true;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Something went wrong. Try again.";
        setError(message);
        if (caught instanceof KilnJournalError && caught.status === UNAUTHORIZED_STATUS) onAuthExpired();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onAuthExpired],
  );

  return { busy, error, run };
}

/**
 * shows a write's error, if there is one.
 *
 * @param {object} props - component props.
 * @param {string | null} props.error - the message.
 * @returns {JSX.Element | null} the message, or nothing.
 */
export function JournalError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="kiln-journal-error" role="alert">
      {error}
    </p>
  );
}
