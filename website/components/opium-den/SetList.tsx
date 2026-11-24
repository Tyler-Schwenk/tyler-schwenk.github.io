"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDate, formatDuration, plural } from "@/app/admin/format";
import { djSetPagePath, djSetThumbUrl, djSetTitle, djSetTrackId, type DjSet } from "@/app/opium-den/djApi";
import type { DjSetTrace } from "@/lib/useDjSetTraces";
import EqBars from "./EqBars";
import SetArt from "./SetArt";
import SetTrace from "./SetTrace";
import { PauseIcon, PlayIcon, SpinnerIcon } from "./playerIcons";

// a mark on the time ruler every half hour
const RULER_STEP_S = 1800;
// the meta column's width next to the traces, on desktop
const META_COLUMN = "md:grid-cols-[20rem_minmax(0,1fr)]";
// the longest set's share of its row, leaving room for its length label past its end.
// narrower on phones, where the label takes a bigger share
const TRACE_SCALE = "[--den-trace-scale:78%] md:[--den-trace-scale:88%]";
// past about this many characters (or with a line break) a description won't fit its two lines, so it gets a "more"
const DESCRIPTION_CLAMP_CHARS = 110;
const S_PER_H = 3600;

/**
 * the stat cells under the heading: how many sets, how many hours, how many chat
 * messages. the messages count waits until every set's chat is in, so it doesn't count up.
 *
 * @param {object} props
 * @param {DjSet[]} props.sets - the sets.
 * @param {Record<number, DjSetTrace>} props.traces - their chat, by set id.
 * @returns {JSX.Element} the cells.
 */
function Stats({ sets, traces }: { sets: DjSet[]; traces: Record<number, DjSetTrace> }) {
  const hours = (sets.reduce((sum, set) => sum + set.duration_s, 0) / S_PER_H).toFixed(1);
  const chats = sets.map((set) => traces[set.id]?.messages);
  const messages = chats.every(Boolean) ? chats.reduce((sum, chat) => sum + (chat?.length ?? 0), 0) : null;
  const cells: [string, string | number | null][] = [
    ["sets", sets.length],
    ["hours", hours],
    ["chat msgs", messages],
  ];
  return (
    <dl className="grid max-w-md grid-cols-3 border-l border-t border-den-line border-t-den-ink">
      {cells.map(([label, value]) => (
        <div key={label} className="border-b border-r border-den-line px-3.5 py-3">
          <dd className="text-3xl font-semibold leading-none tracking-[-0.04em] tabular-nums">{value ?? "–"}</dd>
          <dt className="mt-1.5 font-den-mono text-[11px] uppercase text-den-muted">{label}</dt>
        </div>
      ))}
    </dl>
  );
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
 * the half-hour marks over the traces, on the same scale they're drawn at.
 *
 * @param {object} props
 * @param {number} props.longestS - the longest listed set's length.
 * @returns {JSX.Element} the ruler.
 */
function TimeRuler({ longestS }: { longestS: number }) {
  const marks: number[] = [];
  for (let s = 0; s <= longestS; s += RULER_STEP_S) marks.push(s);
  return (
    <div className="relative hidden h-5 md:block" aria-hidden="true">
      {marks.map((s) => (
        <span
          key={s}
          className="absolute bottom-0 h-5 border-l border-den-faint pl-1 font-den-mono text-[11px] text-den-muted"
          style={{ left: `calc(var(--den-trace-scale) * ${(s / longestS).toFixed(4)})` }}
        >
          {s === 0 ? "0" : formatDuration(s).replace(/:00$/, "")}
        </span>
      ))}
    </div>
  );
}

/**
 * one set: its cover plays or pauses it, its title opens its page (the waveform and its
 * chat replaying), and its trace, drawn to scale, seeks it. the description shows its
 * first couple of lines, with a "more" toggle when it's long enough to be cut off.
 *
 * @param {object} props
 * @param {DjSet} props.set - the set.
 * @param {DjSetTrace | undefined} props.trace - its waveform and chat, once they've started loading.
 * @param {number} props.longestS - the longest listed set's length, for the scale.
 * @param {boolean} props.current - it's the loaded track.
 * @param {boolean} props.playing - the player's playing.
 * @param {boolean} props.loading - the player's buffering.
 * @param {number} props.positionS - where playback is.
 * @param {() => void} props.onToggle - play or pause this set.
 * @param {(seconds: number) => void} props.onSeek - plays this set from there.
 * @returns {JSX.Element} the row.
 */
function SetRow({
  set,
  trace,
  longestS,
  current,
  playing,
  loading,
  positionS,
  onToggle,
  onSeek,
}: {
  set: DjSet;
  trace: DjSetTrace | undefined;
  longestS: number;
  current: boolean;
  playing: boolean;
  loading: boolean;
  positionS: number;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const title = djSetTitle(set);
  // the playing one keeps its overlay up, so the bars show over the cover
  const overlayShown = current && (playing || loading);
  const description = set.description ?? "";
  const clipped = description.length > DESCRIPTION_CLAMP_CHARS || description.includes("\n");
  const meta = [set.title ? formatDate(set.started_at) : "untitled set"];
  if (trace?.messages) meta.push(plural(trace.messages.length, "msg"));

  return (
    <li className={`grid gap-4 border-b border-den-line py-5 md:items-center md:gap-7 ${META_COLUMN}`}>
      <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-start gap-3.5 md:grid-cols-[4rem_minmax(0,1fr)]">
        <button
          type="button"
          onClick={onToggle}
          aria-label={`${current && playing ? "Pause" : "Play"} ${title}`}
          className="group/art relative"
        >
          <SetArt src={djSetThumbUrl(set)} className="h-[3.25rem] w-[3.25rem] md:h-16 md:w-16" />
          <span
            className={`absolute inset-0 flex items-center justify-center bg-den-ink/55 text-den-bg transition-opacity group-hover/art:opacity-100 ${
              overlayShown ? "opacity-100" : "opacity-0 pointer-coarse:bg-den-ink/30 pointer-coarse:opacity-100"
            }`}
          >
            <ArtOverlay current={current} playing={playing} loading={loading} />
          </span>
        </button>

        <div className="min-w-0">
          <Link
            href={djSetPagePath(set.id)}
            className={`block text-[1.1875rem] font-semibold leading-tight tracking-tight transition-colors ${
              current ? "text-den-accent-soft" : "hover:text-den-accent-soft"
            }`}
          >
            {title}
          </Link>
          <p className="mt-1 font-den-mono text-[11px] uppercase text-den-muted">{meta.join(" · ")}</p>
          {set.description && (
            <>
              <p className={`mt-1.5 text-[13px] leading-snug text-den-muted ${open ? "whitespace-pre-line" : "line-clamp-2"}`}>
                {set.description}
              </p>
              {clipped && (
                <button
                  type="button"
                  onClick={() => setOpen(!open)}
                  aria-expanded={open}
                  className="mt-1 font-den-mono text-[11px] text-den-faint underline-offset-4 transition-colors hover:text-den-accent-soft hover:underline"
                >
                  {open ? "less" : "more"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <SetTrace
        durationS={set.duration_s}
        longestS={longestS}
        trace={trace}
        current={current}
        positionS={positionS}
        onSeek={onSeek}
        title={title}
      />
    </li>
  );
}

/**
 * past sets: the section's stats (sets, hours, chat messages), then every recorded set,
 * newest first, each drawn to scale as its waveform: the longest set runs nearly the
 * width of the row and the rest are cut to match, so you can see at a glance which went
 * long, and the chat ticks above each show where people were talking. a half-hour ruler
 * runs along the top on desktop.
 *
 * @param {object} props
 * @param {DjSet[]} props.sets - the sets.
 * @param {Record<number, DjSetTrace>} props.traces - their waveforms and chat, by set id.
 * @param {string | null} props.currentId - the loaded track's id, to highlight it.
 * @param {boolean} props.playing - the player's playing.
 * @param {boolean} props.loading - the player's buffering.
 * @param {number} props.positionS - where playback is in the loaded track.
 * @param {(set: DjSet) => void} props.onToggle - play or pause a set.
 * @param {(set: DjSet, seconds: number) => void} props.onSeek - play a set from a point.
 * @returns {JSX.Element} the list.
 */
export default function SetList({
  sets,
  traces,
  currentId,
  playing,
  loading,
  positionS,
  onToggle,
  onSeek,
}: {
  sets: DjSet[];
  traces: Record<number, DjSetTrace>;
  currentId: string | null;
  playing: boolean;
  loading: boolean;
  positionS: number;
  onToggle: (set: DjSet) => void;
  onSeek: (set: DjSet, seconds: number) => void;
}) {
  const longestS = Math.max(0, ...sets.map((set) => set.duration_s));

  return (
    <section className={`mt-20 ${TRACE_SCALE}`}>
      <h2 className="text-[2.5rem] font-extrabold leading-none tracking-[-0.045em] sm:text-[2.75rem]">Past sets</h2>
      <div className="mt-5">
        <Stats sets={sets} traces={traces} />
      </div>
      {/* the ruler lines up over the traces, past the meta column */}
      <div className={`mt-8 grid gap-7 border-b border-den-ink pb-1 ${META_COLUMN}`}>
        <span className="hidden md:block" />
        {longestS > 0 && <TimeRuler longestS={longestS} />}
      </div>
      {sets.length === 0 ? (
        <p className="py-6 font-den-mono text-xs text-den-muted">
          no sets recorded yet. they show up here when a live session ends.
        </p>
      ) : (
        <ol>
          {sets.map((set) => {
            const current = currentId === djSetTrackId(set.id);
            return (
              <SetRow
                key={set.id}
                set={set}
                trace={traces[set.id]}
                longestS={longestS}
                current={current}
                playing={current && playing}
                loading={current && loading}
                positionS={current ? positionS : 0}
                onToggle={() => onToggle(set)}
                onSeek={(seconds) => onSeek(set, seconds)}
              />
            );
          })}
        </ol>
      )}
    </section>
  );
}
