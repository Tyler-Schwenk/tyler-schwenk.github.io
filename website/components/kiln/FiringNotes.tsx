"use client";

import { useMemo, useState } from "react";
import type { KilnCurvePoint } from "@/app/kiln/kilnApi";
import { maxJumpMs, nearestPoint, toChartPoints } from "@/app/kiln/kilnCurve";
import { formatDateTime, formatTemp } from "@/app/kiln/kilnFormat";
import {
  createKilnNote,
  deleteKilnNote,
  updateKilnNote,
  type KilnNote,
  type KilnNoteInput,
} from "@/app/kiln/kilnJournalApi";
import { ChoiceChips, JournalError, useJournalAction, VisibilityChips, type Choice } from "./JournalControls";

/** how long a datetime-local value is: "2026-11-02T08:07". */
const LOCAL_INPUT_LENGTH = 16;
const MS_PER_MINUTE = 60_000;

type TimeMode = "none" | "now" | "pick";

const TIME_CHOICES: Choice<TimeMode>[] = [
  { value: "none", label: "General" },
  { value: "now", label: "Right now" },
  { value: "pick", label: "Pick a time" },
];

/**
 * numbers a firing's pinned notes 1, 2, 3 in time order, so the chart's markers and the
 * list can point at each other.
 *
 * @param {KilnNote[]} notes - the firing's notes.
 * @returns {Map<number, number>} note id to its number. general notes aren't in it.
 */
export function numberPinnedNotes(notes: KilnNote[]): Map<number, number> {
  const pinned = notes
    .filter((note) => note.noted_at !== null)
    .sort((a, b) => new Date(a.noted_at as string).getTime() - new Date(b.noted_at as string).getTime());
  return new Map(pinned.map((note, index) => [note.id, index + 1]));
}

/**
 * turns a moment into what a datetime-local input shows, in the viewer's timezone.
 *
 * @param {Date} when - the moment.
 * @returns {string} like "2026-11-02T08:07".
 */
const toLocalInput = (when: Date): string =>
  new Date(when.getTime() - when.getTimezoneOffset() * MS_PER_MINUTE).toISOString().slice(0, LOCAL_INPUT_LENGTH);

/**
 * the add or edit form for a note: its text, when it's about, and who can see it.
 *
 * @param {object} props - component props.
 * @param {KilnNote} [props.note] - the note being edited. Leave out to write a new one.
 * @param {string} props.submitLabel - the save button's text.
 * @param {(input: KilnNoteInput) => Promise<boolean>} props.onSave - saves it. resolves true if it worked.
 * @param {boolean} props.busy - a save is going.
 * @param {() => void} [props.onCancel] - closes the form without saving.
 * @returns {JSX.Element} the form.
 */
function NoteForm({
  note,
  submitLabel,
  onSave,
  busy,
  onCancel,
}: {
  note?: KilnNote;
  submitLabel: string;
  onSave: (input: KilnNoteInput) => Promise<boolean>;
  busy: boolean;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState(note?.body ?? "");
  const [timeMode, setTimeMode] = useState<TimeMode>(note?.noted_at ? "pick" : "none");
  const [pickedTime, setPickedTime] = useState(note?.noted_at ? toLocalInput(new Date(note.noted_at)) : "");
  const [isPublic, setIsPublic] = useState(note?.is_public ?? false);

  /**
   * switches between general, now and a picked time. picking starts from now.
   *
   * @param {TimeMode} mode - the new mode.
   */
  const changeTimeMode = (mode: TimeMode) => {
    if (mode === "pick" && !pickedTime) setPickedTime(toLocalInput(new Date()));
    setTimeMode(mode);
  };

  /**
   * works out the moment to save, from the picked mode.
   *
   * @returns {string | null} iso utc, or null for a general note.
   */
  const notedAt = (): string | null => {
    if (timeMode === "now") return new Date().toISOString();
    if (timeMode === "pick" && pickedTime) return new Date(pickedTime).toISOString();
    return null;
  };

  const canSave = body.trim() !== "" && !(timeMode === "pick" && !pickedTime) && !busy;

  /**
   * saves the note, and clears the form after adding a new one.
   *
   * @param {React.FormEvent} event - the submit.
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    const saved = await onSave({ body: body.trim(), noted_at: notedAt(), is_public: isPublic });
    if (saved && !note) {
      setBody("");
      setTimeMode("none");
    }
  };

  return (
    <form className="kiln-note-form" onSubmit={handleSubmit}>
      <textarea
        className="kiln-input"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="What's happening, what's in there, how it came out..."
        rows={3}
        aria-label="Note"
      />
      <div className="kiln-note-form-row">
        <span className="kiln-note-form-label">When</span>
        <ChoiceChips label="When the note's about" choices={TIME_CHOICES} value={timeMode} onChange={changeTimeMode} />
        {timeMode === "pick" && (
          <input
            type="datetime-local"
            className="kiln-input kiln-input-time"
            value={pickedTime}
            onChange={(event) => setPickedTime(event.target.value)}
            aria-label="The note's time"
          />
        )}
      </div>
      <div className="kiln-note-form-row">
        <span className="kiln-note-form-label">Who sees it</span>
        <VisibilityChips isPublic={isPublic} onChange={setIsPublic} />
      </div>
      <div className="kiln-note-form-actions">
        <button type="submit" className="kiln-button" disabled={!canSave}>
          {busy ? "Saving" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="kiln-link-button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * one note in the list. the editor gets buttons to edit it, flip who sees it, or delete it.
 *
 * @param {object} props - component props.
 * @param {KilnNote} props.note - the note.
 * @param {number | undefined} props.number - its marker number on the chart, if it's pinned.
 * @param {string | null} props.tempLabel - the kiln's temperature at the note's time, if known.
 * @param {string | null} props.token - the kiln editor's jwt, or null for the public view.
 * @param {() => void} props.onChanged - reloads the notes after a change.
 * @param {() => void} props.onAuthExpired - logs the editor out.
 * @returns {JSX.Element} the note.
 */
function NoteItem({
  note,
  number,
  tempLabel,
  token,
  onChanged,
  onAuthExpired,
}: {
  note: KilnNote;
  number: number | undefined;
  tempLabel: string | null;
  token: string | null;
  onChanged: () => void;
  onAuthExpired: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const action = useJournalAction(onAuthExpired);

  /**
   * runs a change to this note, then reloads.
   *
   * @param {(token: string) => Promise<unknown>} write - the change.
   * @returns {Promise<boolean>} true if it worked.
   */
  const change = async (write: (token: string) => Promise<unknown>): Promise<boolean> => {
    if (!token) return false;
    const worked = await action.run(() => write(token));
    if (worked) onChanged();
    return worked;
  };

  /**
   * saves an edit and closes the form.
   *
   * @param {KilnNoteInput} input - the edited note.
   * @returns {Promise<boolean>} true if it worked.
   */
  const saveEdit = async (input: KilnNoteInput): Promise<boolean> => {
    const worked = await change((auth) => updateKilnNote(note.id, input, auth));
    if (worked) setEditing(false);
    return worked;
  };

  /** deletes the note, after checking. */
  const remove = () => {
    if (window.confirm("Delete this note? It can't be undone.")) change((auth) => deleteKilnNote(note.id, auth));
  };

  if (editing) {
    return (
      <li className="kiln-note">
        <NoteForm note={note} submitLabel="Save" onSave={saveEdit} busy={action.busy} onCancel={() => setEditing(false)} />
        <JournalError error={action.error} />
      </li>
    );
  }

  return (
    <li className="kiln-note">
      <div className="kiln-note-meta">
        {number !== undefined && <span className="kiln-note-number">{number}</span>}
        <span>{note.noted_at ? formatDateTime(note.noted_at) : "About the whole firing"}</span>
        {tempLabel && <span>{tempLabel}</span>}
        {!note.is_public && <span className="kiln-table-tag">Private</span>}
      </div>
      <p className="kiln-note-body">{note.body}</p>
      {token && (
        <div className="kiln-journal-actions">
          <button type="button" disabled={action.busy} onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            type="button"
            disabled={action.busy}
            onClick={() => change((auth) => updateKilnNote(note.id, { is_public: !note.is_public }, auth))}
          >
            {note.is_public ? "Make private" : "Make public"}
          </button>
          <button type="button" disabled={action.busy} onClick={remove}>
            Delete
          </button>
        </div>
      )}
      <JournalError error={action.error} />
    </li>
  );
}

/**
 * the notes on a firing. everyone sees the public ones. the kiln editor sees all of them,
 * and gets a form to add more. pinned notes are numbered to match the chart's markers.
 *
 * @param {object} props - component props.
 * @param {number} props.firingId - the firing.
 * @param {KilnNote[]} props.notes - its notes, from useFiringJournal.
 * @param {KilnCurvePoint[]} props.points - its curve, to show the temperature at each note.
 * @param {number} props.bucketS - how much time each curve point covers.
 * @param {string | null} props.token - the kiln editor's jwt, or null for the public view.
 * @param {() => void} props.onChanged - reloads the notes after a change.
 * @param {() => void} props.onAuthExpired - logs the editor out.
 * @returns {JSX.Element | null} the section, or nothing for a viewer with no notes to see.
 */
export default function FiringNotes({
  firingId,
  notes,
  points,
  bucketS,
  token,
  onChanged,
  onAuthExpired,
}: {
  firingId: number;
  notes: KilnNote[];
  points: KilnCurvePoint[];
  bucketS: number;
  token: string | null;
  onChanged: () => void;
  onAuthExpired: () => void;
}) {
  const action = useJournalAction(onAuthExpired);
  const numbers = useMemo(() => numberPinnedNotes(notes), [notes]);
  const chartPoints = useMemo(() => toChartPoints(points), [points]);
  const general = notes.filter((note) => note.noted_at === null);
  const pinned = notes
    .filter((note) => note.noted_at !== null)
    .sort((a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0));

  if (!token && notes.length === 0) return null;

  /**
   * the temperature at a note's time, when the curve has a reading near it.
   *
   * @param {KilnNote} note - the note.
   * @returns {string | null} like "1,234 °F", or null.
   */
  const tempAt = (note: KilnNote): string | null => {
    if (!note.noted_at) return null;
    const point = nearestPoint(chartPoints, new Date(note.noted_at).getTime(), maxJumpMs(bucketS));
    return point && point.tempC !== null ? formatTemp(point.tempC) : null;
  };

  /**
   * adds a note.
   *
   * @param {KilnNoteInput} input - the new note.
   * @returns {Promise<boolean>} true if it worked.
   */
  const add = async (input: KilnNoteInput): Promise<boolean> => {
    if (!token) return false;
    const worked = await action.run(() => createKilnNote(firingId, input, token));
    if (worked) onChanged();
    return worked;
  };

  return (
    <section className="kiln-section" aria-label="Notes">
      <h2 className="kiln-section-title">
        Notes
        {token && <span className="kiln-section-note">Private notes only show while you&apos;re logged in</span>}
      </h2>
      {token && (
        <>
          <NoteForm submitLabel="Add note" onSave={add} busy={action.busy} />
          <JournalError error={action.error} />
        </>
      )}
      {notes.length === 0 ? (
        <p className="kiln-empty">No notes on this firing yet.</p>
      ) : (
        <ol className="kiln-notes">
          {[...general, ...pinned].map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              number={numbers.get(note.id)}
              tempLabel={tempAt(note)}
              token={token}
              onChanged={onChanged}
              onAuthExpired={onAuthExpired}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
