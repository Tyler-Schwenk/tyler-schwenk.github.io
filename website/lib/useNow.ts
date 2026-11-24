"use client";

import { useEffect, useState } from "react";

/**
 * the current time, ticking along while it's wanted, for clocks on screen like how long
 * the stream's been on. stops ticking (and holds its last value) while `running` is false.
 *
 * @param {number} intervalMs - how often it ticks.
 * @param {boolean} [running] - whether it ticks at all.
 * @returns {number} the time in ms since the epoch.
 */
export function useNow(intervalMs: number, running = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, running]);
  return now;
}
