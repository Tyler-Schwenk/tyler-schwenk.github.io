"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useAgentLongPoll } from "./kioskControl";
import { SURFCAM_AGENT_URL } from "./surfCams";

/**
 * Trash night: fart-pi's trash reminder knows when it's trash time, and the
 * surfcam agent on the kiosk relays that here (pi/services/surfcam-agent/trash_alert.py).
 * While it's trash time the display drops everything for the trash alert, and
 * once someone confirms (any key on the kiosk keyboard, or fart-pi's own
 * button) it shows the happy cormorant until the agent's thanks_until_ms, then
 * goes back to whatever it was doing.
 */

/** The agent's trash status, as served by GET /trash. */
interface TrashStatus {
  version: number;
  alert: boolean;
  /** When the thanks screen ends (epoch ms), or null when it isn't up. */
  thanks_until_ms: number | null;
}

/** What the display should show instead of its rotation, if anything. */
export type TrashTakeover = { kind: "alert" } | { kind: "thanks"; untilMs: number };

const TRASH_STATUS_PATH = "/trash";
const TRASH_DONE_PATH = "/trash/done";

// the page is statically exported, so there's no clock at build time
const readFalseOnServer = () => false;

/**
 * Whether a moment is still in the future, re-rendering when it passes.
 * @param untilMs - Epoch ms, or null for never.
 * @returns True until untilMs.
 */
function useStillBefore(untilMs: number | null): boolean {
  const subscribe = useCallback(
    (onPass: () => void) => {
      if (untilMs === null) return () => {};
      let timer: ReturnType<typeof setTimeout>;
      // a timer that fires a hair early just re-arms for the remaining ms
      const arm = () => {
        timer = setTimeout(() => {
          onPass();
          if (Date.now() < untilMs) arm();
        }, Math.max(0, untilMs - Date.now()));
      };
      arm();
      return () => clearTimeout(timer);
    },
    [untilMs]
  );
  const read = useCallback(() => untilMs !== null && Date.now() < untilMs, [untilMs]);
  return useSyncExternalStore(subscribe, read, readFalseOnServer);
}

/**
 * Whether trash night is taking over the display right now. The thanks screen
 * wins over the alert. Always null away from the kiosk (there's no agent).
 * @returns The takeover, or null for the normal display.
 */
export function useTrashTakeover(): TrashTakeover | null {
  const status = useAgentLongPoll<TrashStatus>(TRASH_STATUS_PATH);
  const thanksUntilMs = status?.thanks_until_ms ?? null;
  const thanksUp = useStillBefore(thanksUntilMs);
  if (thanksUp && thanksUntilMs !== null) return { kind: "thanks", untilMs: thanksUntilMs };
  if (status?.alert) return { kind: "alert" };
  return null;
}

/**
 * Tells the agent the trash is out, which has fart-pi play its thanks. The new
 * status comes back through useTrashTakeover's long-poll, so nothing's returned.
 */
export function confirmTrash(): void {
  fetch(`${SURFCAM_AGENT_URL}${TRASH_DONE_PATH}`, { method: "POST" }).catch((err) => {
    // a missed confirm leaves the alert up, so another key press just tries again
    console.warn(`display: couldn't confirm the trash with the surfcam agent: ${err}`);
  });
}
