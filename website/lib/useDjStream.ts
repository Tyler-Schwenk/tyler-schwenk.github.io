"use client";

import { fetchDjSets, fetchDjStatus, type DjSet, type DjStreamStatus } from "@/app/opium-den/djApi";
import { usePoll } from "@/lib/usePoll";

// how quickly a visitor to the live section notices the stream going live, without hammering the pi
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
 * fetches the status and the sets together.
 *
 * @returns {Promise<{status: DjStreamStatus, sets: DjSet[]}>} both.
 */
async function fetchStreamAndSets(): Promise<{ status: DjStreamStatus; sets: DjSet[] }> {
  const [status, sets] = await Promise.all([fetchDjStatus(), fetchDjSets()]);
  return { status, sets };
}

/**
 * the live dj stream's status and the recorded sets, kept fresh by polling while
 * the tab is visible. sets are reloaded each poll too, so a set shows up shortly
 * after it ends.
 *
 * @returns {DjStreamState} the status, the sets, and the last error.
 */
export function useDjStream(): DjStreamState {
  const { data, error } = usePoll(fetchStreamAndSets, POLL_INTERVAL_MS);
  return { status: data?.status ?? null, sets: data?.sets ?? null, error };
}
