"use client";

import { useEffect, useState } from "react";
import { fetchMonitorState, type MonitorState } from "@/app/monitor/monitorApi";

// the agents report every 30 s, so polling faster would just fetch the same numbers
const POLL_INTERVAL_MS = 30_000;

/** what useMonitor hands back. */
export type MonitorHookState = {
  /** the last stats that came back, null until the first load. */
  state: MonitorState | null;
  /** what last went wrong, null when the last poll worked. */
  error: string | null;
};

/**
 * every house machine's stats, polled from the backend. on a failed poll it
 * keeps the last stats it had and reports the error, so a blip doesn't blank
 * the page or the display.
 *
 * @returns {MonitorHookState} the stats and the last error.
 */
export function useMonitor(): MonitorHookState {
  const [state, setState] = useState<MonitorState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const latest = await fetchMonitorState();
        if (cancelled) return;
        setState(latest);
        setError(null);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    };
    refresh();
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return { state, error };
}
