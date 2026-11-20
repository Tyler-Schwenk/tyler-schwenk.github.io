"use client";

import { useState } from "react";
import { formatDate, formatDuration } from "@/app/admin/format";
import { djSetTitle, djSetTrackId, type DjSet } from "@/app/opium-den/djApi";
import EqBars from "./EqBars";
import { PauseIcon, PlayIcon, SpinnerIcon } from "./playerIcons";

const S_PER_MIN = 60;
const S_PER_H = 3600;

/**
 * the header line's total, like "4 sets · 3.5 hours".
 *
 * @param {DjSet[]} sets - the sets.
 * @returns {string} the count and total length.
 */
function summary(sets: DjSet[]): string {
  const totalS = sets.reduce((sum, set) => sum + set.duration_s, 0);
  const hours = totalS / S_PER_H;
  const length = hours >= 1 ? `${hours.toFixed(1)} hours` : `${Math.round(totalS / S_PER_MIN)} min`;
  return `${sets.length} ${sets.length === 1 ? "set" : "sets"} · ${length}`;
}

/**
 * the number column of a row: the set's number, a play/pause button on hover, and the
 * bouncing bars for the one that's playing.
 *
 * @param {object} props
 * @param {number} props.index - its position in the list, from 1.
 * @param {boolean} props.current - it's the loaded track.
 * @param {boolean} props.playing - and it's playing.
 * @param {boolean} props.loading - and it's buffering.
 * @returns {JSX.Element} the cell.
 */
function RowMarker({
  index,
  current,
  playing,
  loading,
}: {
  index: number;
  current: boolean;
  playing: boolean;
  loading: boolean;
}) {
  if (current && loading) return <SpinnerIcon className="h-4 w-4 text-den-accent" />;
  if (current && playing) {
    return (
      <>
        <EqBars active className="h-3.5 w-3.5 text-den-accent group-hover:hidden" />
        <PauseIcon className="hidden h-4 w-4 text-den-accent group-hover:block" />
      </>
    );
  }
  return (
    <>
      <span className={`text-sm tabular-nums group-hover:hidden ${current ? "text-den-accent" : "text-den-faint"}`}>
        {index}
      </span>
      <PlayIcon className="hidden h-4 w-4 text-den-accent group-hover:block" />
    </>
  );
}

/**
 * one set: tap the row to play or pause it, and open its description if it has one.
 *
 * @param {object} props
 * @param {DjSet} props.set - the set.
 * @param {number} props.index - its position, from 1.
 * @param {boolean} props.current - it's the loaded track.
 * @param {boolean} props.playing - the player's playing.
 * @param {boolean} props.loading - the player's buffering.
 * @param {() => void} props.onToggle - play or pause this set.
 * @returns {JSX.Element} the row.
 */
function SetRow({
  set,
  index,
  current,
  playing,
  loading,
  onToggle,
}: {
  set: DjSet;
  index: number;
  current: boolean;
  playing: boolean;
  loading: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const title = djSetTitle(set);

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-label={`${current && playing ? "Pause" : "Play"} ${title}`}
        className="group grid w-full grid-cols-[1.5rem_1fr_auto] items-center gap-4 py-3.5 text-left"
      >
        <span className="flex h-5 items-center justify-start">
          <RowMarker index={index} current={current} playing={playing} loading={loading} />
        </span>
        <span className="min-w-0">
          <span className={`block truncate transition-colors ${current ? "text-den-accent-soft" : "text-den-ink group-hover:text-den-accent-soft"}`}>{title}</span>
          <span className="mt-0.5 block truncate text-sm text-den-faint">
            {set.title ? formatDate(set.started_at) : "untitled set"}
            {set.description && !open && <span> · {set.description}</span>}
          </span>
        </span>
        <span className="text-sm tabular-nums text-den-faint">{formatDuration(set.duration_s)}</span>
      </button>

      {set.description && (
        <div className="-mt-1.5 pb-3.5 pl-10">
          {open && <p className="mb-1 whitespace-pre-line text-sm leading-relaxed text-den-muted">{set.description}</p>}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="text-xs text-den-faint underline-offset-4 transition-colors hover:text-den-accent-soft hover:underline"
          >
            {open ? "less" : "about this set"}
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * every recorded set as a track list, newest first, like a playlist page.
 *
 * @param {object} props
 * @param {DjSet[]} props.sets - the sets.
 * @param {string | null} props.currentId - the loaded track's id, to highlight it.
 * @param {boolean} props.playing - the player's playing.
 * @param {boolean} props.loading - the player's buffering.
 * @param {(set: DjSet) => void} props.onToggle - play or pause a set.
 * @returns {JSX.Element} the list.
 */
export default function SetList({
  sets,
  currentId,
  playing,
  loading,
  onToggle,
}: {
  sets: DjSet[];
  currentId: string | null;
  playing: boolean;
  loading: boolean;
  onToggle: (set: DjSet) => void;
}) {
  return (
    <section className="mt-16">
      <div className="flex items-baseline justify-between gap-3 border-b border-den-accent/40 pb-3">
        <h2 className="text-base font-semibold">Past sets</h2>
        {sets.length > 0 && <span className="text-sm text-den-faint">{summary(sets)}</span>}
      </div>
      {sets.length === 0 ? (
        <p className="py-6 text-sm text-den-faint">
          no sets recorded yet. they show up here when a live session ends.
        </p>
      ) : (
        <ol className="mt-1 divide-y divide-den-line">
          {sets.map((set, i) => {
            const current = currentId === djSetTrackId(set.id);
            return (
              <SetRow
                key={set.id}
                set={set}
                index={i + 1}
                current={current}
                playing={current && playing}
                loading={current && loading}
                onToggle={() => onToggle(set)}
              />
            );
          })}
        </ol>
      )}
    </section>
  );
}
