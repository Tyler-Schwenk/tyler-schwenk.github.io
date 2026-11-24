"use client";

import { useRef } from "react";
import type { MouseEvent, PointerEvent } from "react";

/** how long you hold before it counts as a long press */
const LONG_PRESS_MS = 500;
/** finger drift allowed while holding, so a scroll that starts on the element doesn't fire it */
const MOVE_TOLERANCE_PX = 10;

/**
 * handlers that turn a press-and-hold on an element into a callback. once it fires, the click
 * that follows the release is swallowed, so holding a link doesn't also follow it, and the
 * phone's own long-press menu (copy link, preview, etc) is blocked.
 *
 * @param {() => void} onLongPress - called once the press has been held long enough.
 * @returns {object} pointer, click and context menu handlers to spread onto the element.
 */
export function useLongPress(onLongPress: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const firedRef = useRef(false);

  /** stops a pending press without firing it */
  const cancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    firedRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY };
    cancel();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      firedRef.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!timerRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) cancel();
  };

  // capture phase so it beats the link's own navigation
  const onClickCapture = (e: MouseEvent) => {
    if (!firedRef.current) return;
    firedRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onClickCapture,
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  };
}
