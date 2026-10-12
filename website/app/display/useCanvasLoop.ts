"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Draws one animation frame. dtS is seconds since the last frame (0 on the first). */
export type CanvasDraw = (ctx: CanvasRenderingContext2D, width: number, height: number, dtS: number) => void;

// a stall (tab hidden, machine busy) shouldn't make animations leap when it resumes
const MAX_FRAME_DT_S = 0.1;
const MS_PER_S = 1000;

/**
 * Calls `onResize` with the size of the element a canvas fills (its parent),
 * now and whenever it changes. On the kiosk that's the whole window; inside
 * the console page's screens it's the simulated screen.
 * @param canvas - The canvas, laid out to fill its parent.
 * @param onResize - Gets the parent's width and height in css px.
 * @returns Stops watching.
 */
export function watchCanvasContainer(canvas: HTMLCanvasElement, onResize: (width: number, height: number) => void): () => void {
  const container = canvas.parentElement;
  if (!container) return () => {};
  const report = () => onResize(container.clientWidth, container.clientHeight);
  report();
  const observer = new ResizeObserver(report);
  observer.observe(container);
  return () => observer.disconnect();
}

/**
 * Runs a full-panel canvas animation: sizes the canvas to the panel it fills
 * (and again when that resizes) and calls `draw` every animation frame until unmount. The
 * latest `draw` is always used, so it can close over fresh props.
 * @param draw - Draws one frame.
 * @returns A ref to attach to the canvas.
 */
export function useCanvasLoop(draw: CanvasDraw): RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef(draw);

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const stopWatching = watchCanvasContainer(canvas, (width, height) => {
      canvas.width = width;
      canvas.height = height;
    });

    let lastFrameMs: number | null = null;
    let animationFrameId = 0;
    const tick = (nowMs: number) => {
      animationFrameId = requestAnimationFrame(tick);
      const dtS = lastFrameMs === null ? 0 : Math.min((nowMs - lastFrameMs) / MS_PER_S, MAX_FRAME_DT_S);
      lastFrameMs = nowMs;
      drawRef.current(ctx, canvas.width, canvas.height, dtS);
    };
    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
      stopWatching();
    };
  }, []);

  return canvasRef;
}
