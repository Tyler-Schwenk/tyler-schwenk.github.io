"use client";

import { useCallback, useRef, useState } from "react";

/** what useScrub hands back. */
export type Scrub = {
  /** where to draw the knob: the drag position while dragging, the real value otherwise. */
  value: number;
  /** follows the drag without committing it. */
  move: (value: number) => void;
  /** commits the drag, if there is one. */
  release: () => void;
};

/**
 * holds a slider's drag position until it's let go, so dragging a seek bar seeks once
 * instead of on every step. each seek on a phone can mean a fresh range request to the
 * pi, which stutters.
 *
 * @param {number} value - the real value, like the current playback time.
 * @param {(value: number) => void} commit - called with the final position on release.
 * @returns {Scrub} the position to show and the slider handlers.
 */
export function useScrub(value: number, commit: (value: number) => void): Scrub {
  const [dragValue, setDragValue] = useState<number | null>(null);
  // release can fire from several events in a row, and the second must see the first's reset
  const dragRef = useRef<number | null>(null);

  const move = useCallback((next: number) => {
    dragRef.current = next;
    setDragValue(next);
  }, []);

  const release = useCallback(() => {
    const pending = dragRef.current;
    if (pending === null) return;
    dragRef.current = null;
    setDragValue(null);
    commit(pending);
  }, [commit]);

  return { value: dragValue ?? value, move, release };
}
