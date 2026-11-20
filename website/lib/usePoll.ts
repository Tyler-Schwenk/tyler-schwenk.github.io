"use client";

import { useEffect, useRef, useState } from "react";

/** what usePoll hands back. */
export type Poll<T> = {
  /** the latest answer, null until the first one arrives. */
  data: T | null;
  /** what last went wrong, null when the last fetch worked. */
  error: string | null;
  /** replaces the data locally, like adding a message you just sent before the next poll. */
  setData: (update: (current: T | null) => T | null) => void;
};

/**
 * fetches something now and then every so often while the tab's visible. a failed fetch
 * keeps the last good data and reports why; the next tick tries again.
 *
 * @param {() => Promise<T>} fetcher - gets the data. throws with a readable message on failure.
 * @param {number} intervalMs - time between fetches.
 * @returns {Poll<T>} the data, the last error, and a way to patch the data locally.
 */
export function usePoll<T>(fetcher: () => Promise<T>, intervalMs: number): Poll<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  // the interval shouldn't restart just because the caller passed a new arrow function
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const latest = await fetcherRef.current();
        if (cancelled) return;
        setData(latest);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(`${(err as Error).message}. it'll keep trying.`);
      }
    };
    tick();
    const timer = setInterval(() => {
      if (!document.hidden) tick();
    }, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intervalMs]);

  return { data, error, setData };
}
