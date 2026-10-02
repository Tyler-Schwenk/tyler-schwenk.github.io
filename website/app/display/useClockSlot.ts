"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Wall-clock slots for the display page. Time is cut into fixed-length slots
 * counted from the epoch, so every screen on the same clock agrees on the
 * current slot without talking to each other, and a reloaded page lands
 * straight on the right one. An offset shifts the slot boundaries, which is
 * how two screens can take turns changing.
 */

/**
 * Slot number for a moment in time.
 * @param nowMs - Epoch time in ms.
 * @param intervalMs - Slot length in ms.
 * @param offsetMs - Shifts every boundary this much later.
 * @returns How many full slots have passed since the (offset) epoch.
 */
export function clockSlotAt(nowMs: number, intervalMs: number, offsetMs = 0): number {
  return Math.floor((nowMs - offsetMs) / intervalMs);
}

/**
 * How long until the next slot starts.
 * @param intervalMs - Slot length in ms.
 * @param offsetMs - Shifts every boundary this much later.
 * @returns Milliseconds until the next boundary.
 */
export function msUntilNextClockSlot(intervalMs: number, offsetMs = 0): number {
  const intoSlotMs = (((Date.now() - offsetMs) % intervalMs) + intervalMs) % intervalMs;
  return intervalMs - intoSlotMs;
}

// the page is statically exported, so there's no clock at build time; on the server the
// slot reads as null and callers render a blank screen until hydration
const readNothingOnServer = () => null;

/**
 * Current wall-clock slot, re-rendering at every slot boundary.
 * @param intervalMs - Slot length in ms.
 * @param offsetMs - Shifts every boundary this much later.
 * @returns The slot number, or null before hydration.
 */
export function useClockSlot(intervalMs: number, offsetMs = 0): number | null {
  const subscribe = useCallback(
    (onSlotChange: () => void) => {
      let timer: ReturnType<typeof setTimeout>;
      // a timer that fires a hair early just re-arms for the remaining ms
      const armNext = () => {
        timer = setTimeout(() => {
          onSlotChange();
          armNext();
        }, msUntilNextClockSlot(intervalMs, offsetMs));
      };
      armNext();
      return () => clearTimeout(timer);
    },
    [intervalMs, offsetMs]
  );
  const readSlot = useCallback(
    () => clockSlotAt(Date.now(), intervalMs, offsetMs),
    [intervalMs, offsetMs]
  );
  return useSyncExternalStore(subscribe, readSlot, readNothingOnServer);
}
