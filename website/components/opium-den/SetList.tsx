"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDate, formatDuration } from "@/app/admin/format";
import { djSetPagePath, djSetThumbUrl, djSetTitle, djSetTrackId, type DjSet } from "@/app/opium-den/djApi";
import EqBars from "./EqBars";
import SetArt from "./SetArt";
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
 * what sits over a row's cover: nothing until you hover (then play), bouncing bars for
 * the one playing (pause on hover), or a spinner while it buffers.
 *
 * @param {object} props
 * @param {boolean} props.current - it's the loaded track.
 * @param {boolean} props.playing - and it's playing.
 * @param {boolean} props.loading - and it's buffering.
 * @returns {JSX.Element} the overlay's contents.
 */
function ArtOverlay({ current, playing, loading }: { current: boolean; playing: boolean; loading: boolean }) {
  if (current && loading) return <SpinnerIcon className="h-5 w-5" />;
  if (current && playing) {
    return (
      <>
        <EqBars active className="h-4 w-4 group-hover/art:hidden" />
        <PauseIcon className="hidden h-5 w-5 group-hover/art:block" />
      </>
    );
  }
  // touchscreens can't hover, so they always get the play icon
  return <PlayIcon className="hidden h-5 w-5 group-hover/art:block pointer-coarse:block" />;
}

/**
 * one set: its cover plays or pauses it, and the title opens its page (the waveform and
 * its chat replaying). its description, if it has one, opens underneath.
 *
 * @param {object} props
 * @param {DjSet} props.set - the set.
 * @param {boolean} props.current - it's the loaded track.
 * @param {boolean} props.playing - the player's playing.
 * @param {boolean} props.loading - the player's buffering.
 * @param {() => void} props.onToggle - play or pause this set.
 * @returns {JSX.Element} the row.
 */
function SetRow({
  set,
  current,
  playing,
  loading,
  onToggle,
}: {
  set: DjSet;
  current: boolean;
  playing: boolean;
  loading: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const title = djSetTitle(set);
  // the playing one keeps its overlay up, so the bars show over the cover
  const overlayShown = current && (playing || loading);

  return (
    <li className="py-3">
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={onToggle}
          aria-label={`${current && playing ? "Pause" : "Play"} ${title}`}
          className="group/art relative shrink-0"
        >
          <SetArt src={djSetThumbUrl(set)} className="h-14 w-14 rounded-md" />
          <span
            className={`absolute inset-0 flex items-center justify-center rounded-md bg-black/50 text-den-accent-soft transition-opacity group-hover/art:opacity-100 ${
              overlayShown ? "opacity-100" : "opacity-0 pointer-coarse:bg-black/30 pointer-coarse:opacity-100"
            }`}
          >
            <ArtOverlay current={current} playing={playing} loading={loading} />
          </span>
        </button>

        <Link href={djSetPagePath(set.id)} className="group min-w-0 flex-1">
          <span
            className={`block truncate transition-colors ${
              current ? "text-den-accent-soft" : "text-den-ink group-hover:text-den-accent-soft"
            }`}
          >
            {title}
          </span>
          <span className="mt-0.5 block truncate text-sm text-den-faint">
            {set.title ? formatDate(set.started_at) : "untitled set"}
            {set.description && !open && <span> · {set.description}</span>}
          </span>
        </Link>

        <span className="shrink-0 text-sm tabular-nums text-den-faint">{formatDuration(set.duration_s)}</span>
      </div>

      {set.description && (
        <div className="mt-1 pl-[4.375rem]">
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
          {sets.map((set) => {
            const current = currentId === djSetTrackId(set.id);
            return (
              <SetRow
                key={set.id}
                set={set}
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
