"use client";

import type { ReactNode } from "react";
import { parseBackendTime } from "@/app/admin/format";
import { fetchDjChat, fetchDjLiveTrace, type DjChatMessage, type DjLiveTrace } from "@/app/opium-den/djApi";
import { usePoll } from "@/lib/usePoll";
import AlertSignup from "./AlertSignup";
import { BAR_PITCH_PX, resamplePeaks, useElementWidth, WaveBars } from "./Waveform";

// as often as the section checks the status. the room itself polls much quicker
const CHAT_POLL_INTERVAL_MS = 15000;
// the pi measures a level a second; every 10 s is plenty for a trace this size
const TRACE_POLL_INTERVAL_MS = 10000;
// how far across the paper the pen sits. the stretch past it is the blank paper still to come
const PEN_AT = 0.84;
// where pinned messages hang, newest first: over the middle, under it, then a lower lane
// over it, so the newest (hanging left off the pen) doesn't land on the one before it
const FLAG_LANES = ["top-3.5", "bottom-7", "top-[4.25rem]"];
// how many of the latest messages get pinned on phones, where there's less room
const FLAG_PHONE_COUNT = 1;
// past this far across, a flag hangs left of its line so it doesn't run off the paper
const FLAG_FLIP_AT = 0.6;
// the trace's insets: even top and bottom on the monitor; in the room it's raised to leave the floor for people
const TRACE_INSET_MONITOR = "top-6 bottom-6";
const TRACE_INSET_ROOM = "top-4 bottom-14 sm:bottom-16";
// the trace's middle line on the paper, for the pen and the paper still to come: half the inset difference above center in the room
const MIDLINE_MONITOR = "top-1/2";
const MIDLINE_ROOM = "top-[calc(50%-1.25rem)] sm:top-[calc(50%-1.5rem)]";
const MS_PER_S = 1000;
const PERCENT = 100;

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
 * the set's sound so far: the pi's loudness levels as mirrored bars, the same look as a
 * finished set's waveform, running from the left edge for as much of the set as they
 * cover (up to the pen, as they catch up). nothing but the baseline until the first
 * levels are in, or when the pi can't send them.
 *
 * @param {object} props
 * @param {DjLiveTrace | null} props.trace - the latest trace, null before it loads or if it can't.
 * @param {number} props.elapsedS - how long the set's been on.
 * @param {string} props.inset - its top and bottom placement classes.
 * @returns {JSX.Element} the trace, covering the paper up to the pen.
 */
function SoundTrace({ trace, elapsedS, inset }: { trace: DjLiveTrace | null; elapsedS: number; inset: string }) {
  const [boxRef, widthPx] = useElementWidth();
  const peaks = trace?.peaks ?? [];
  const coveredS = peaks.length * (trace?.interval_s ?? 0);
  const share = elapsedS > 0 ? Math.min(1, coveredS / elapsedS) : 0;
  const barCount = Math.min(peaks.length, Math.floor((widthPx * share) / BAR_PITCH_PX));
  const bars = barCount > 0 ? resamplePeaks(peaks, barCount) : [];

  return (
    <div ref={boxRef} className={`absolute left-0 ${inset}`} style={{ width: `${PEN_AT * PERCENT}%` }} aria-hidden="true">
      <span className="absolute inset-x-0 top-1/2 border-t border-den-ink" />
      {bars.length > 0 && (
        <WaveBars bars={bars} playedFraction={0} className="absolute inset-y-0 left-0 h-full" style={{ width: `${share * PERCENT}%` }} />
      )}
    </div>
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
      <span className="block bg-den-raised font-den-mono text-[10px] uppercase text-den-muted">{placed.message.nickname}</span>
      <span className="block bg-den-raised text-[13px] leading-tight text-den-ink">{placed.message.content}</span>
    </div>
  );
}

/**
 * the paper while the set's on: polls the set's loudness and the room's chat (only
 * mounted while live, so both are fetched the moment the stream's known to be on), and
 * draws the sound up to the pen with the chat as ticks along the top. on the monitor the
 * latest few messages are pinned on; in the room the trace sits higher and the stage (the
 * people, with their own chat bubbles) stands along the bottom instead.
 *
 * @param {object} props
 * @param {number} props.startMs - when the set started.
 * @param {number} props.nowMs - now, ticking.
 * @param {ReactNode} [props.stage] - the room's people, drawn over the paper.
 * @returns {JSX.Element} the paper.
 */
function TracingPaper({ startMs, nowMs, stage }: { startMs: number; nowMs: number; stage?: ReactNode }) {
  const { data: trace } = usePoll(fetchDjLiveTrace, TRACE_POLL_INTERVAL_MS);
  const { data: messages } = usePoll(fetchDjChat, CHAT_POLL_INTERVAL_MS);
  const placed = placeMessages(messages ?? [], startMs, nowMs);
  // newest first, one per lane. the room's people say theirs in bubbles instead
  const flags = stage ? [] : placed.slice(-FLAG_LANES.length).reverse();
  const midline = stage ? MIDLINE_ROOM : MIDLINE_MONITOR;

  return (
    <div className={`den-grid relative overflow-hidden ${stage ? "h-48 sm:h-56" : "h-52 sm:h-60"}`}>
      <SoundTrace trace={trace} elapsedS={(nowMs - startMs) / MS_PER_S} inset={stage ? TRACE_INSET_ROOM : TRACE_INSET_MONITOR} />
      <div className="absolute left-0 top-0 h-2.5" style={{ width: `${PEN_AT * PERCENT}%` }} aria-hidden="true">
        {placed.map(({ message, at }) => (
          <span key={message.id} className="absolute top-0 h-full w-px bg-den-ink" style={{ left: `${at * PERCENT}%` }} />
        ))}
      </div>
      {/* the paper still to come, past the pen */}
      <span
        className={`absolute right-0 border-t border-dashed border-den-ink/40 ${midline}`}
        style={{ left: `${PEN_AT * PERCENT}%` }}
        aria-hidden="true"
      />
      {flags.map((flag, i) => (
        <Flag key={flag.message.id} placed={flag} lane={FLAG_LANES[i]} phone={i < FLAG_PHONE_COUNT} />
      ))}
      <span className="absolute inset-y-0 w-px bg-den-accent" style={{ left: `${PEN_AT * PERCENT}%` }} aria-hidden="true">
        <span
          className={`absolute left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-den-accent ring-[5px] ring-den-accent/20 ${midline}`}
        />
      </span>
      {stage}
    </div>
  );
}

/**
 * the live monitor's chart paper. while the stream's on, the set so far runs from the
 * left edge to the pen: its sound, measured by the pi as it streams (GET /dj/live/trace),
 * with a tick along the top for every chat message and the latest few pinned on where
 * they were said. the pen is "now", and the paper past it is still to come. off air it
 * says so and asks people to sign up for live alerts, the main thing to do then.
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
    // grows rather than clips when the signup opens into its form
    <div className="den-grid flex min-h-52 flex-col items-center justify-center px-4 py-8 text-center sm:min-h-60">
      <p className="text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">Off air right now.</p>
      <p className="mt-2 max-w-md text-balance text-sm text-den-muted">
        Leave your email and you&apos;ll hear the moment the decks are on.
      </p>
      <div className="mt-5 flex w-full max-w-md justify-center text-left">
        <AlertSignup prominent className="w-full sm:w-auto" />
      </div>
    </div>
  );
}

/**
 * the live room's stage while the set's on: the set's trace so far, raised up a bit to
 * leave the room's people the floor (they can stand over its bottom edge).
 *
 * @param {object} props
 * @param {number} props.startMs - when the set started.
 * @param {number} props.nowMs - now, ticking.
 * @param {ReactNode} props.children - the people.
 * @returns {JSX.Element} the stage.
 */
export function LiveRoomStage({ startMs, nowMs, children }: { startMs: number; nowMs: number; children: ReactNode }) {
  return <TracingPaper startMs={startMs} nowMs={nowMs} stage={children} />;
}

/** how far across the pen sits, for the axis under the paper. */
export const LIVE_PEN_AT = PEN_AT;
