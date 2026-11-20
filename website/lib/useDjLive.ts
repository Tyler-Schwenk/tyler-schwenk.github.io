"use client";

import { fetchDjStatus } from "@/app/opium-den/djApi";
import { usePoll } from "@/lib/usePoll";

// slow on purpose: it's a flourish on the home page, not the player
const POLL_INTERVAL_MS = 30000;

/**
 * whether the dj stream's on air, for the home page: the den's board gets music notes and
 * the radio tower switches to its broadcasting sprite with a LIVE! tag. checks on load and
 * then every 30 s while the tab's visible, so they light up if a set starts while someone's
 * on the page. stays false until it knows, and if the backend can't be reached.
 *
 * @returns {boolean} true while the stream's live.
 */
export function useDjLive(): boolean {
  const { data } = usePoll(fetchDjStatus, POLL_INTERVAL_MS);
  return Boolean(data?.live);
}
