"use client";

import { useCallback, useLayoutEffect, useRef, type RefObject, type UIEventHandler } from "react";

// how close to the bottom still counts as "reading the latest", so new lines follow along
const STICK_TO_BOTTOM_PX = 48;

/** what useStickToBottom hands back: the ref for the scrolling list, and its onScroll. */
export type StickToBottom<T extends HTMLElement> = [RefObject<T | null>, UIEventHandler<T>];

/**
 * keeps a chat list scrolled to its newest line as lines arrive, like a stream's chat,
 * unless the reader has scrolled up to read something. scrolling back down picks it up
 * again.
 *
 * @param {unknown} latest - changes whenever the newest line does, like its id.
 * @returns {StickToBottom<T>} [ref, onScroll] for the list.
 */
export function useStickToBottom<T extends HTMLElement>(latest: unknown): StickToBottom<T> {
  const ref = useRef<T | null>(null);
  const stickRef = useRef(true);

  useLayoutEffect(() => {
    const list = ref.current;
    if (list && stickRef.current) list.scrollTop = list.scrollHeight;
  }, [latest]);

  const onScroll = useCallback(() => {
    const list = ref.current;
    if (!list) return;
    stickRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < STICK_TO_BOTTOM_PX;
  }, []);

  return [ref, onScroll];
}
