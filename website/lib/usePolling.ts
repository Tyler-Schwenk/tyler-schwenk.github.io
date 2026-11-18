"use client";

import { useEffect } from "react";

/**
 * runs something now and on an interval, skipping ticks while the tab's hidden.
 *
 * @param {() => void} task - what to run.
 * @param {number} intervalMs - how often.
 * @param {unknown} key - restarts the schedule (and runs the task right away) when it changes.
 */
export function usePolling(task: () => void, intervalMs: number, key: unknown): void {
  useEffect(() => {
    task();
    const timer = setInterval(() => {
      if (!document.hidden) task();
    }, intervalMs);
    return () => clearInterval(timer);
    // the task closes over nothing that changes without `key` changing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, key]);
}
