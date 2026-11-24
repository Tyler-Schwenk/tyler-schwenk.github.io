"use client";

import Link from "next/link";
import { formatDuration, parseBackendTime } from "@/app/admin/format";
import { djLiveThumbUrl, LIVE_ROOM_PATH, type DjStreamStatus } from "@/app/opium-den/djApi";
import { useNow } from "@/lib/useNow";
import LiveTrace, { LIVE_PEN_AT } from "./LiveTrace";
import SetArt from "./SetArt";
import { PauseIcon, PlayIcon, SpinnerIcon } from "./playerIcons";

const CLOCK_TICK_MS = 1000;
const MS_PER_S = 1000;
const PERCENT = 100;
// the pill buttons in the monitor's header
const PILL_CLASS = "inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition";

/**
 * a moment as a short clock time, like "8:04 PM".
 *
 * @param {number} ms - the moment.
 * @returns {string} the time.
 */
function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * when the set started, if the status knows.
 *
 * @param {DjStreamStatus | null} status - latest status.
 * @returns {number | null} ms since the epoch, or null.
 */
function startedMs(status: DjStreamStatus | null): number | null {
  if (!status?.live || !status.started_at) return null;
  const ms = parseBackendTime(status.started_at).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * the time axis under the paper: when it started, halfway, and "now" at the pen.
 *
 * @param {object} props
 * @param {number | null} props.startMs - when the set started, null off air.
 * @param {number} props.nowMs - now.
 * @returns {JSX.Element} the axis.
 */
function TimeAxis({ startMs, nowMs }: { startMs: number | null; nowMs: number }) {
  if (startMs === null) {
    return <div className="h-7 border-t border-den-line" aria-hidden="true" />;
  }
  const halfway = startMs + (nowMs - startMs) / 2;
  return (
    <div className="relative h-7 border-t border-den-line font-den-mono text-[11px] text-den-muted" aria-hidden="true">
      <span className="absolute left-3 top-1.5">{clockTime(startMs)}</span>
      <span className="absolute top-1.5 hidden -translate-x-1/2 sm:block" style={{ left: `${(LIVE_PEN_AT / 2) * PERCENT}%` }}>
        {clockTime(halfway)}
      </span>
      <span className="absolute top-1.5 -translate-x-1/2 text-den-accent-soft" style={{ left: `${LIVE_PEN_AT * PERCENT}%` }}>
        now
      </span>
    </div>
  );
}

/**
 * the top of the live section, the way into the live room, drawn like a seismograph's
 * monitor. a header reads out the stream (on air, when it started, how long it's been
 * going, who's listening) with the set's cover once one's uploaded, a red listen button
 * to play it right here and a way into the room. under it, chart paper with the set so
 * far traced out as the room's chat (LiveTrace), and a time axis. off air the readout
 * says so, the paper's a flat line, and there's a link to the room, whose chat from the
 * last set stays readable for a while.
 *
 * @param {object} props
 * @param {DjStreamStatus | null} props.status - latest status, null before the first answer.
 * @param {string | null} props.error - why the last status check failed, if it did.
 * @param {boolean} props.playing - the live stream is what's playing right now.
 * @param {boolean} props.loading - and it's still connecting.
 * @param {() => void} props.onToggle - play or pause the live stream.
 * @returns {JSX.Element} the monitor.
 */
export default function LiveHero({
  status,
  error,
  playing,
  loading,
  onToggle,
}: {
  status: DjStreamStatus | null;
  error: string | null;
  playing: boolean;
  loading: boolean;
  onToggle: () => void;
}) {
  const live = Boolean(status?.live);
  const startMs = startedMs(status);
  const nowMs = useNow(CLOCK_TICK_MS, live);
  const cover = djLiveThumbUrl(status);

  return (
    <section className="border border-den-ink bg-den-raised">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-den-line px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          {live && cover && <SetArt src={cover} className="h-9 w-9" />}
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-den-mono text-[11px] uppercase">
            {live ? (
              <>
                <span className="inline-flex items-center gap-2 font-medium text-den-accent-soft">
                  <span className="den-rec-blink h-2 w-2 rounded-full bg-den-accent" aria-hidden="true" />
                  On air
                </span>
                {startMs !== null && <span>started {clockTime(startMs)}</span>}
                {startMs !== null && (
                  <span>
                    elapsed <b className="font-medium">{formatDuration((nowMs - startMs) / MS_PER_S)}</b>
                  </span>
                )}
                {status && status.listeners > 0 && <span>{status.listeners} listening</span>}
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-2 text-den-muted">
                  <span className="h-2 w-2 rounded-full bg-den-faint" aria-hidden="true" />
                  Off air
                </span>
                <span className="normal-case text-den-muted">streams here whenever i&apos;m practicing on the decks</span>
              </>
            )}
          </p>
        </div>

        <div className="flex w-full gap-2 sm:w-auto">
          {live ? (
            <>
              <button
                type="button"
                onClick={onToggle}
                aria-label={playing ? "Pause the live stream" : "Play the live stream"}
                className={`${PILL_CLASS} flex-1 border-den-accent bg-den-accent text-white hover:brightness-110 active:scale-95 sm:flex-none`}
              >
                {loading ? <SpinnerIcon className="h-4 w-4" /> : playing ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
                {playing ? "Pause" : "Listen"}
              </button>
              <Link
                href={LIVE_ROOM_PATH}
                className={`${PILL_CLASS} flex-1 border-den-ink bg-den-ink text-den-bg hover:bg-den-ink/85 sm:flex-none`}
              >
                Enter the room &rarr;
              </Link>
            </>
          ) : (
            <Link href={LIVE_ROOM_PATH} className={`${PILL_CLASS} flex-1 border-den-ink hover:bg-den-ink hover:text-den-bg sm:flex-none`}>
              The room &rarr;
            </Link>
          )}
        </div>
        {error && !status && <p className="w-full font-den-mono text-[11px] text-den-muted">{error}</p>}
      </div>

      <LiveTrace live={live} startMs={startMs} nowMs={nowMs} />
      <TimeAxis startMs={live ? startMs : null} nowMs={nowMs} />
    </section>
  );
}
