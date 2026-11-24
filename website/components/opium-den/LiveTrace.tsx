"use client";

import { parseBackendTime } from "@/app/admin/format";
import { fetchDjChat, type DjChatMessage } from "@/app/opium-den/djApi";
import { usePoll } from "@/lib/usePoll";

// as often as the section checks the status. the room itself polls much quicker
const CHAT_POLL_INTERVAL_MS = 15000;
// how far across the paper the pen sits. the stretch past it is the blank paper still to come
const PEN_AT = 0.84;
// how many slices the time so far is cut into for the chat trace
const TRACE_BINS = 72;
// a slice with this many messages (or the busiest, if busier) draws full height, so a
// lone message reads as a blip rather than a spike
const TRACE_FULL_SCALE_MSGS = 4;
const TRACE_BAR_WIDTH = 0.45;
// the busiest slice's bar, as a share of the paper's height
const TRACE_HEIGHT_RATIO = 0.7;
// where pinned messages hang, newest first: over the middle, under it, then a lower lane
// over it, so the newest (hanging left off the pen) doesn't land on the one before it
const FLAG_LANES = ["top-3.5", "bottom-7", "top-[4.25rem]"];
// how many of the latest messages get pinned on phones, where there's less room
const FLAG_PHONE_COUNT = 1;
// past this far across, a flag hangs left of its line so it doesn't run off the paper
const FLAG_FLIP_AT = 0.6;
const PERCENT = 100;
const VIEW_H = 100;

/** a chat message placed on the trace: how far along it is, 0 to 1 of the time so far. */
type PlacedMessage = { message: DjChatMessage; at: number };

/**
 * places the room's messages from this set along the time so far.
 *
 * @param {DjChatMessage[]} messages - the room's recent chat.
 * @param {number} startMs - when the set started.
 * @param {number} nowMs - now.
 * @returns {PlacedMessage[]} this set's messages, oldest first, each with its spot.
 */
function placeMessages(messages: DjChatMessage[], startMs: number, nowMs: number): PlacedMessage[] {
  const spanMs = Math.max(1, nowMs - startMs);
  return messages
    .map((message) => ({ message, ms: parseBackendTime(message.created_at).getTime() }))
    .filter(({ ms }) => ms >= startMs && ms <= nowMs)
    .map(({ message, ms }) => ({ message, at: (ms - startMs) / spanMs }));
}

/**
 * the chat trace: how many messages came in during each slice of the set so far, as bars
 * mirrored about the middle. busy stretches spike, quiet ones stay flat.
 *
 * @param {object} props
 * @param {PlacedMessage[]} props.placed - this set's messages.
 * @returns {JSX.Element} the svg, covering the paper up to the pen.
 */
function ChatActivity({ placed }: { placed: PlacedMessage[] }) {
  const counts = new Array<number>(TRACE_BINS).fill(0);
  placed.forEach(({ at }) => {
    counts[Math.min(TRACE_BINS - 1, Math.floor(at * TRACE_BINS))] += 1;
  });
  const busiest = Math.max(TRACE_FULL_SCALE_MSGS, ...counts);
  const mid = VIEW_H / 2;

  return (
    <svg
      viewBox={`0 0 ${TRACE_BINS} ${VIEW_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="absolute inset-y-0 left-0 h-full"
      style={{ width: `${PEN_AT * PERCENT}%` }}
    >
      <line x1={0} x2={TRACE_BINS} y1={mid} y2={mid} className="stroke-den-ink" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
      {counts.map((count, i) =>
        count === 0 ? null : (
          <rect
            key={i}
            x={i + (1 - TRACE_BAR_WIDTH) / 2}
            width={TRACE_BAR_WIDTH}
            y={mid - (count / busiest) * TRACE_HEIGHT_RATIO * mid}
            height={(count / busiest) * TRACE_HEIGHT_RATIO * VIEW_H}
            className="fill-den-ink"
          />
        ),
      )}
    </svg>
  );
}

/**
 * one message pinned to the trace at its moment: a line down from it, the name, the text.
 * each sits in its own lane (FLAG_LANES) so neighbours don't collide.
 *
 * @param {object} props
 * @param {PlacedMessage} props.placed - the message and its spot.
 * @param {string} props.lane - its lane's placement class.
 * @param {boolean} props.phone - it's one of the few shown on phones too.
 * @returns {JSX.Element} the flag.
 */
function Flag({ placed, lane, phone }: { placed: PlacedMessage; lane: string; phone: boolean }) {
  const left = placed.at * PEN_AT;
  const flipped = left > FLAG_FLIP_AT;
  return (
    <div
      className={`absolute max-w-[min(13rem,45%)] ${lane} ${phone ? "" : "hidden sm:block"} ${
        flipped ? "-translate-x-full border-r pr-2 text-right" : "border-l pl-2"
      } border-den-ink`}
      style={{ left: `${left * PERCENT}%` }}
    >
      <span className="block font-den-mono text-[10px] uppercase text-den-muted">{placed.message.nickname}</span>
      <span className="block bg-den-raised text-[13px] leading-tight text-den-ink">{placed.message.content}</span>
    </div>
  );
}

/**
 * the paper while the set's on: polls the room's chat (only mounted while live, so it
 * fetches the moment the stream's known to be on) and traces it up to the pen.
 *
 * @param {object} props
 * @param {number} props.startMs - when the set started.
 * @param {number} props.nowMs - now, ticking.
 * @returns {JSX.Element} the paper.
 */
function TracingPaper({ startMs, nowMs }: { startMs: number; nowMs: number }) {
  const { data: messages } = usePoll(fetchDjChat, CHAT_POLL_INTERVAL_MS);
  const placed = placeMessages(messages ?? [], startMs, nowMs);
  // newest first, one per lane
  const flags = placed.slice(-FLAG_LANES.length).reverse();

  return (
    <div className="den-grid relative h-52 overflow-hidden sm:h-60">
      <ChatActivity placed={placed} />
      {/* the paper still to come, past the pen */}
      <span
        className="absolute right-0 top-1/2 border-t border-dashed border-den-ink/40"
        style={{ left: `${PEN_AT * PERCENT}%` }}
        aria-hidden="true"
      />
      {flags.map((flag, i) => (
        <Flag
          key={flag.message.id}
          placed={flag}
          lane={FLAG_LANES[i]}
          phone={i < FLAG_PHONE_COUNT}
        />
      ))}
      {messages && placed.length === 0 && (
        <p className="absolute left-3 top-3 font-den-mono text-[11px] text-den-muted">
          the chat&apos;s quiet so far. it&apos;s drawn here as it comes in.
        </p>
      )}
      <span className="absolute inset-y-0 w-px bg-den-accent" style={{ left: `${PEN_AT * PERCENT}%` }} aria-hidden="true">
        <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-den-accent ring-[5px] ring-den-accent/20" />
      </span>
    </div>
  );
}

/**
 * the live monitor's chart paper. while the stream's on, the set so far runs from the
 * left edge to the pen, drawn as the room's chat activity (the stream itself has no
 * waveform until it's recorded), with the latest few messages pinned on where they were
 * said. the pen is "now", and the paper past it is still to come. off air it's a flat
 * line.
 *
 * @param {object} props
 * @param {boolean} props.live - the stream's on.
 * @param {number | null} props.startMs - when the set started, null when unknown.
 * @param {number} props.nowMs - now, ticking.
 * @returns {JSX.Element} the paper.
 */
export default function LiveTrace({ live, startMs, nowMs }: { live: boolean; startMs: number | null; nowMs: number }) {
  if (live && startMs !== null) return <TracingPaper startMs={startMs} nowMs={nowMs} />;
  return (
    <div className="den-grid relative grid h-52 place-items-center px-4 text-center sm:h-60">
      <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-den-ink/40" aria-hidden="true" />
      <div className="relative bg-den-raised px-3 py-1">
        <p className="text-2xl font-semibold tracking-tight">Flat line.</p>
        <p className="mt-1 font-den-mono text-[11px] text-den-muted">
          nobody&apos;s on the decks. the trace starts the moment i go live.
        </p>
      </div>
    </div>
  );
}

/** how far across the pen sits, for the axis under the paper. */
export const LIVE_PEN_AT = PEN_AT;
