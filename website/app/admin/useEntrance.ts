"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminRequestError, adminRequest, delay, errorMessage, useAdminFetch } from "./adminApi";

/** What the /entrance endpoints answer (see pi/docs/api/website-backend-api.md). */
interface EntranceStatusResponse {
  playing: boolean;
  position_ms: number;
  drop_at_ms: number;
  duration_ms: number;
}

/** The song as the page sees it, plus its controls. */
export interface Entrance {
  /** The latest answer from the backend, null until the first one. */
  status: EntranceStatusResponse | null;
  /** performance.now() when position_ms was true, to count forward from. */
  anchorMs: number;
  /** Why the last request failed, if it did. */
  error: string | null;
  /** Starts the song. Failures end up in `error`. */
  start: () => Promise<void>;
  /** Stops the song. Failures end up in `error`. */
  stop: () => Promise<void>;
}

// how often to correct the countdown against the backend
const STATUS_POLL_MS = 3_000;
const HALF = 0.5;

/**
 * Follows the entrance song on the backend and starts and stops it.
 *
 * Polls while the tab's open, and right away on coming back to it, since a phone
 * freezes the page while it's asleep.
 * @returns The song's status and controls.
 */
export function useEntrance(): Entrance {
  const adminFetch = useAdminFetch();
  const [status, setStatus] = useState<EntranceStatusResponse | null>(null);
  const [anchorMs, setAnchorMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [wake, setWake] = useState(0);
  // a poll sent before a tap can land after it and say the song isn't playing yet
  const lastActionMs = useRef(0);

  const request = useCallback(
    async (path: string, failure: string, init?: RequestInit, signal?: AbortSignal) => {
      const sentMs = performance.now();
      const latest = await adminRequest<EntranceStatusResponse>(adminFetch, path, failure, { ...init, signal });
      if (!latest) throw new AdminRequestError(`${failure}: the backend sent back nothing`);
      if (sentMs < lastActionMs.current) return;
      const receivedMs = performance.now();
      // the backend read its position about halfway through the round trip
      setAnchorMs(receivedMs - (receivedMs - sentMs) * HALF);
      setStatus(latest);
      setError(null);
    },
    [adminFetch]
  );

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setWake((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    const follow = async () => {
      while (!abort.signal.aborted) {
        try {
          await request("/entrance/status", "couldn't get the song's status", undefined, abort.signal);
        } catch (err) {
          if (abort.signal.aborted || (err instanceof AdminRequestError && err.sessionExpired)) return;
          setError(errorMessage(err));
        }
        await delay(STATUS_POLL_MS, abort.signal);
      }
    };
    follow();
    return () => abort.abort();
  }, [request, wake]);

  const act = useCallback(
    async (path: string, failure: string) => {
      lastActionMs.current = performance.now();
      try {
        await request(path, failure, { method: "POST" });
      } catch (err) {
        setError(errorMessage(err));
      }
    },
    [request]
  );

  const start = useCallback(() => act("/entrance/start", "couldn't start the song"), [act]);
  const stop = useCallback(() => act("/entrance/stop", "couldn't stop the song"), [act]);

  return { status, anchorMs, error, start, stop };
}
