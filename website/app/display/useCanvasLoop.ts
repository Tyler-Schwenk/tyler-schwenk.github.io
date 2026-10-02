"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Draws one animation frame. dtS is seconds since the last frame (0 on the first). */
export type CanvasDraw = (ctx: CanvasRenderingContext2D, width: number, height: number, dtS: number) => void;

// a stall (tab hidden, machine busy) shouldn't make animations leap when it resumes
const MAX_FRAME_DT_S = 0.1;
const MS_PER_S = 1000;

/**
 * Runs a full-window canvas animation: sizes the canvas to the window (and
 * again on resize) and calls `draw` every animation frame until unmount. The
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

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

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
      window.removeEventListener("resize", resize);
    };
  }, []);

  return canvasRef;
}
