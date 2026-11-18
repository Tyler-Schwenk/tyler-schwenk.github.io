"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchDjSets, fetchDjStatus, type DjSet, type DjStreamStatus } from "@/app/opium-den/djApi";

// how quickly a visitor notices the stream going live, without hammering the pi
const POLL_INTERVAL_MS = 15000;

/** what useDjStream hands back. */
export type DjStreamState = {
  /** live status, null until the first answer (or if the pi can't be reached). */
  status: DjStreamStatus | null;
  /** finished sets, newest first. null until the first answer. */
  sets: DjSet[] | null;
  /** what last went wrong, null when things are fine. */
  error: string | null;
};

/**
 * the live dj stream's status and the recorded sets, kept fresh by polling while
 * the tab is visible. sets are reloaded each poll too, so a set shows up shortly
 * after it ends.
 *
 * @returns {DjStreamState} the status, the sets, and the last error.
 */
export function useDjStream(): DjStreamState {
  const [status, setStatus] = useState<DjStreamStatus | null>(null);
  const [sets, setSets] = useState<DjSet[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [latestStatus, latestSets] = await Promise.all([fetchDjStatus(), fetchDjSets()]);
      setStatus(latestStatus);
      setSets(latestSets);
      setError(null);
    } catch (err) {
      setError(`${(err as Error).message}. it'll keep trying.`);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { status, sets, error };
}
