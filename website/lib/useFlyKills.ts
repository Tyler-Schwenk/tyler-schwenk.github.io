"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addFlyKill,
  bumpTally,
  fetchFlyKills,
  removeFlyKill,
  type FlyKillTally,
  type FlyKiller,
} from "@/app/flies/flyKillsApi";

// picks up kills logged from other phones without hammering the pi
const POLL_INTERVAL_MS = 15000;

/** what useFlyKills hands back. */
export type FlyKillsState = {
  /** the tally, null until the first load. */
  tally: FlyKillTally | null;
  /** what last went wrong, null when things are fine. */
  error: string | null;
  /** logs a kill for someone. */
  addKill: (killer: FlyKiller) => void;
  /** takes back someone's newest kill. does nothing at zero. */
  removeKill: (killer: FlyKiller) => void;
};

/**
 * the house fly kill tally: loads it, polls for kills logged elsewhere, and
 * applies clicks straight away while the backend catches up.
 *
 * while any click is still waiting on the backend, server tallies (poll results
 * and earlier clicks' responses) are ignored. otherwise three fast clicks would show
 * 3, then 1, 2, 3 as the responses came back, and flies would vanish and drop again.
 * once the last one's back, its tally is the truth.
 *
 * @returns {FlyKillsState} the tally, the last error, and the click handlers.
 */
export function useFlyKills(): FlyKillsState {
  const [tally, setTally] = useState<FlyKillTally | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingWrites = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const latest = await fetchFlyKills();
      if (pendingWrites.current === 0) setTally(latest);
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

  const write = useCallback(
    async (killer: FlyKiller, delta: number, send: (killer: FlyKiller) => Promise<FlyKillTally>) => {
      pendingWrites.current += 1;
      setTally((current) => (current ? bumpTally(current, killer, delta) : current));
      try {
        const latest = await send(killer);
        pendingWrites.current -= 1;
        if (pendingWrites.current === 0) setTally(latest);
        setError(null);
      } catch (err) {
        pendingWrites.current -= 1;
        setTally((current) => (current ? bumpTally(current, killer, -delta) : current));
        setError(`${(err as Error).message}. check your connection and try again.`);
      }
    },
    []
  );

  const addKill = useCallback((killer: FlyKiller) => write(killer, 1, addFlyKill), [write]);

  const removeKill = useCallback(
    (killer: FlyKiller) => {
      const entry = tally?.killers.find((item) => item.killer === killer);
      if (!entry || entry.kills <= 0) return;
      write(killer, -1, removeFlyKill);
    },
    [tally, write]
  );

  return { tally, error, addKill, removeKill };
}
