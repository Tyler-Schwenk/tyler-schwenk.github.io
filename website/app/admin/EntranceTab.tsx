"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "./format";
import { Button, Card, Muted, ProgressBar } from "./ui";
import { useEntrance } from "./useEntrance";

/**
 * The entrance song: a button that plays it on the big speakers, and a
 * countdown to the drop big enough to read while walking to the door. See
 * pi/docs/services/entrance-song.md.
 */

// fast enough that the tenths look alive
const COUNTDOWN_TICK_MS = 100;
const MS_PER_S = 1_000;
// time to get your hand on the door, so the number changes colour
const GET_READY_MS = 10_000;

/**
 * The current time on performance.now()'s clock, ticking only while active.
 * @param active - Whether to tick.
 * @returns performance.now() as of the last tick.
 */
function usePerformanceNow(active: boolean): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(performance.now());
    tick();
    const timer = setInterval(tick, COUNTDOWN_TICK_MS);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/**
 * Keeps the phone's screen on while active, so it can't lock during the countdown.
 * Does nothing where the browser doesn't support it. The browser drops the lock when
 * the page is hidden, so it's requested again on coming back.
 * @param active - Whether to hold the lock.
 */
function useScreenAwake(active: boolean): void {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;
    const acquire = async () => {
      try {
        const acquired = await navigator.wakeLock.request("screen");
        if (released) acquired.release();
        else lock = acquired;
      } catch {
        // refused (low battery, say). the countdown still works, the screen may just dim
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release();
    };
  }, [active]);
}

/**
 * The live readout: seconds to the drop, then how long's left once it's hit.
 * @param props.positionMs - How far into the song it is.
 * @param props.dropAtMs - When the drop is.
 * @param props.durationMs - When it ends.
 */
function Countdown({ positionMs, dropAtMs, durationMs }: { positionMs: number; dropAtMs: number; durationMs: number }) {
  const toDropMs = dropAtMs - positionMs;
  const dropped = toDropMs <= 0;
  const remainingS = Math.max(0, durationMs - positionMs) / MS_PER_S;
  const numberColour = !dropped && toDropMs <= GET_READY_MS ? "text-orange-400" : "text-white";
  return (
    <Card className="p-5 text-center">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{dropped ? "Dropped" : "Drop in"}</div>
      <div className={`mt-1 text-8xl font-bold tabular-nums ${numberColour}`}>
        {dropped ? formatDuration(Math.ceil(remainingS)) : (toDropMs / MS_PER_S).toFixed(1)}
      </div>
      <div className="mt-1 text-sm text-slate-400">
        {dropped ? "left in the song" : `seconds, then ${formatDuration((durationMs - dropAtMs) / MS_PER_S)} more`}
      </div>
      <ProgressBar fraction={Math.min(1, positionMs / durationMs)} />
    </Card>
  );
}

/**
 * The entrance song tab.
 */
export default function EntranceTab() {
  const { status, anchorMs, error, start, stop } = useEntrance();
  const playing = status?.playing ?? false;
  const nowMs = usePerformanceNow(playing);
  useScreenAwake(playing);

  if (!status) return <Muted>{error ?? "Checking on the speakers..."}</Muted>;

  const positionMs = status.position_ms + Math.max(0, nowMs - anchorMs);
  return (
    <div className="flex flex-col gap-4">
      {playing ? (
        <>
          <Countdown positionMs={positionMs} dropAtMs={status.drop_at_ms} durationMs={status.duration_ms} />
          <Button variant="danger" className="min-h-16" onClick={stop}>
            <span className="text-base">Stop</span>
          </Button>
        </>
      ) : (
        <>
          <Button variant="primary" className="min-h-32" onClick={start}>
            <span className="text-2xl">Play entrance song</span>
          </Button>
          <p className="text-center text-sm text-slate-400">
            Plays out loud on the big speakers right away. Drop at {formatDuration(status.drop_at_ms / MS_PER_S)}, over at{" "}
            {formatDuration(status.duration_ms / MS_PER_S)}.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
