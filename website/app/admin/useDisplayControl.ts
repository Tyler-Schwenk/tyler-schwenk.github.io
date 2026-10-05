"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { replayControl, type ControlLog, type ControlState } from "@/app/display/kioskControl";
import { CONTROL_CONFIG } from "@/app/display/displayConfig";
import { AdminRequestError, adminRequest, errorMessage, jsonBody, useAdminFetch, type AdminFetch } from "./adminApi";

/** What GET /display-control/state answers (see pi/docs/api/website-backend-api.md). */
interface KioskStateResponse {
  revision: number;
  online: boolean;
  kiosk_seen_ms: number | null;
  now_ms: number;
  /** The kiosk's key log, plus the milkdrop preset its page says is playing. */
  log: (ControlLog & { preset: string | null }) | null;
}

/** The kiosk as the remote sees it, plus a way to press its keys. */
export interface DisplayControl {
  /** What the screens are doing, replayed from the kiosk's key log; null until the kiosk has sent one. */
  state: ControlState | null;
  /** The milkdrop preset playing on the kiosk, or null when milkdrop isn't on screen. */
  playingPreset: string | null;
  /** Whether the kiosk's agent has checked in recently. */
  online: boolean;
  /** When the agent last checked in, on the backend's clock. */
  kioskSeenMs: number | null;
  /** Add to Date.now() to get the backend's clock (which the kiosk shares, both being on NTP). */
  clockOffsetMs: number;
  /** False until the first answer. */
  loaded: boolean;
  /** Why the state couldn't be fetched, while it can't. */
  error: string | null;
  /** Presses keys on the kiosk, in order, as one change. Throws AdminRequestError. */
  sendKeys: (keys: string[]) => Promise<void>;
}

// after a failed long-poll (backend restarting, phone offline) wait this long before retrying
const STATE_RETRY_DELAY_MS = 3_000;

/**
 * Waits, unless aborted first.
 * @param ms - How long.
 * @param signal - Cuts the wait short.
 * @returns Resolves when the time is up or the signal fires.
 */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/**
 * Long-polls the kiosk's state until aborted (or the login expires), reporting
 * each answer and each failure. Failures are retried after STATE_RETRY_DELAY_MS.
 * @param adminFetch - From useAdminFetch.
 * @param signal - Stops the loop.
 * @param handlers.onState - Called with each answer.
 * @param handlers.onError - Called with what went wrong, on each failure.
 */
async function followKioskState(
  adminFetch: AdminFetch,
  signal: AbortSignal,
  handlers: { onState: (latest: KioskStateResponse) => void; onError: (message: string) => void }
): Promise<void> {
  let revision = -1;
  while (!signal.aborted) {
    try {
      const latest = await fetchKioskState(adminFetch, revision, signal);
      revision = latest.revision;
      handlers.onState(latest);
    } catch (err) {
      if (signal.aborted || (err instanceof AdminRequestError && err.sessionExpired)) return;
      handlers.onError(errorMessage(err));
      await delay(STATE_RETRY_DELAY_MS, signal);
    }
  }
}

/**
 * One long-poll of the kiosk's state.
 * @param adminFetch - From useAdminFetch.
 * @param after - The revision already seen, or -1.
 * @param signal - Aborts the request.
 * @returns The state once it differs from `after` (or the backend's wait runs out).
 */
async function fetchKioskState(adminFetch: AdminFetch, after: number, signal: AbortSignal): Promise<KioskStateResponse> {
  const failure = "couldn't get the kiosk's state";
  const latest = await adminRequest<KioskStateResponse>(adminFetch, `/display-control/state?after=${after}`, failure, {
    signal,
  });
  if (!latest) throw new AdminRequestError(`${failure}: the backend sent back nothing`);
  return latest;
}

/**
 * Follows what the display kiosk is showing and lets the remote press its keys.
 *
 * Long-polls the backend, which holds each request until the kiosk's key log
 * changes, so a press (from here or the kiosk's own keyboard) shows up within
 * a moment. The log is replayed through the display page's own state machine,
 * so this always agrees with the screens. Coming back to the tab restarts the
 * poll straight away, since a phone drops requests while it's asleep.
 * @returns The kiosk's state and sendKeys.
 */
export function useDisplayControl(): DisplayControl {
  const adminFetch = useAdminFetch();
  const [response, setResponse] = useState<KioskStateResponse | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [wake, setWake] = useState(0);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setWake((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    followKioskState(adminFetch, abort.signal, {
      onState: (latest) => {
        setResponse(latest);
        setClockOffsetMs(latest.now_ms - Date.now());
        setError(null);
      },
      onError: setError,
    });
    return () => abort.abort();
  }, [adminFetch, wake]);

  const log = response?.log ?? null;
  const state = useMemo(() => (log ? replayControl(log, CONTROL_CONFIG) : null), [log]);

  const sendKeys = useCallback(
    async (keys: string[]) => {
      await adminRequest(adminFetch, "/display-control/keys", "couldn't send that to the kiosk", jsonBody("POST", { keys }));
    },
    [adminFetch]
  );

  return {
    state,
    playingPreset: log?.preset ?? null,
    online: response?.online ?? false,
    kioskSeenMs: response?.kiosk_seen_ms ?? null,
    clockOffsetMs,
    loaded: response !== null,
    error,
    sendKeys,
  };
}
