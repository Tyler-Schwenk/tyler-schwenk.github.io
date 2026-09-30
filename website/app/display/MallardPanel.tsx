"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";

/**
 * Display panel: current mallard count, with a canvas-animated background
 * of duck emoji -- one per mallard. Drawn on a single canvas (rather than
 * one DOM node per duck) since hundreds of independently CSS-animated
 * elements is too heavy for the Pi this runs on.
 */

// proxied through our own backend (see pi/services/website-backend/app/routers/mallard.py)
// because the real source, api.traderoutes.cards, doesn't send CORS headers
const MALLARD_COUNT_API_URL = `${API_BASE}/mallard-count`;
const MALLARD_FETCH_INTERVAL_MS = 60_000;

const MALLARD_EMOJI = "\u{1F986}"; // duck emoji — closest standard emoji to a mallard

// caps how many ducks actually get drawn -- the real count still shows in the
// big number text, but the Pi this runs on can't smoothly animate hundreds
// of sprites, so rendering stops scaling up density past this point
const MAX_RENDERED_DUCKS = 180;

// ducks are drawn at DUCK_SIZE_{MIN,MAX}_PX when the rendered count is at or
// below DUCK_SIZE_REFERENCE_COUNT, and shrink (down to a visible floor) as
// it grows past that, so density stays roughly constant on screen
const DUCK_SIZE_REFERENCE_COUNT = 60;
const DUCK_SIZE_MIN_PX = 40;
const DUCK_SIZE_MAX_PX = 90;
const DUCK_SIZE_FLOOR_PX = 16;

// gentle drifting motion (px/second)
const DUCK_SPEED_MIN_PX_S = 4;
const DUCK_SPEED_MAX_PX_S = 14;

// caps the animation loop's rate so hundreds of ducks stay light on weaker hardware
const ANIMATION_TARGET_FPS = 24;
const ANIMATION_FRAME_INTERVAL_MS = 1000 / ANIMATION_TARGET_FPS;

// resolution the emoji is pre-rendered at once onto an offscreen canvas, then
// scaled per-duck via drawImage instead of calling fillText hundreds of times a frame
const DUCK_SPRITE_SIZE_PX = 128;

interface Duck {
  x: number;
  y: number;
  vx: number;
  vy: number;
  sizePx: number;
}

/**
 * Random float in [min, max).
 * @param min - Lower bound (inclusive).
 * @param max - Upper bound (exclusive).
 * @returns A random number in the range.
 */
function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Picks the duck draw size for the given count -- full size at or below
 * DUCK_SIZE_REFERENCE_COUNT, shrinking (down to a visible floor) past that.
 * @param count - Current mallard count.
 * @returns [minSizePx, maxSizePx] range to draw ducks at.
 */
function duckSizeRangePx(count: number): [number, number] {
  const shrink = Math.min(1, Math.sqrt(DUCK_SIZE_REFERENCE_COUNT / Math.max(count, 1)));
  const minPx = Math.max(DUCK_SIZE_FLOOR_PX, DUCK_SIZE_MIN_PX * shrink);
  const maxPx = Math.max(minPx, DUCK_SIZE_MAX_PX * shrink);
  return [minPx, maxPx];
}

/**
 * Builds one new duck with a random position, drift velocity, and size.
 * @param widthPx - Canvas width, to place the duck within.
 * @param heightPx - Canvas height, to place the duck within.
 * @param sizeRangePx - [min, max] draw size range.
 * @returns A new duck.
 */
function spawnDuck(widthPx: number, heightPx: number, sizeRangePx: [number, number]): Duck {
  const angle = randomBetween(0, Math.PI * 2);
  const speed = randomBetween(DUCK_SPEED_MIN_PX_S, DUCK_SPEED_MAX_PX_S);
  return {
    x: randomBetween(0, widthPx),
    y: randomBetween(0, heightPx),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    sizePx: randomBetween(...sizeRangePx),
  };
}

/**
 * Grows, shrinks, or resizes an existing duck flock to match a new count,
 * keeping existing ducks' positions/velocities instead of resetting them all.
 * @param existing - The current duck flock.
 * @param count - Target duck count.
 * @param widthPx - Canvas width, for placing any newly-spawned ducks.
 * @param heightPx - Canvas height, for placing any newly-spawned ducks.
 * @returns The adjusted duck flock.
 */
function adjustFlock(existing: Duck[], count: number, widthPx: number, heightPx: number): Duck[] {
  const sizeRangePx = duckSizeRangePx(count);
  const next = existing
    .slice(0, count)
    .map((duck) => ({ ...duck, sizePx: randomBetween(...sizeRangePx) }));
  while (next.length < count) {
    next.push(spawnDuck(widthPx, heightPx, sizeRangePx));
  }
  return next;
}

/**
 * Pre-renders the duck emoji once onto an offscreen canvas.
 * @returns A canvas holding the rendered emoji, for use as a drawImage source.
 */
function buildDuckSprite(): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = DUCK_SPRITE_SIZE_PX;
  sprite.height = DUCK_SPRITE_SIZE_PX;
  const ctx = sprite.getContext("2d");
  if (ctx) {
    ctx.font = `${DUCK_SPRITE_SIZE_PX * 0.85}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(MALLARD_EMOJI, DUCK_SPRITE_SIZE_PX / 2, DUCK_SPRITE_SIZE_PX / 2);
  }
  return sprite;
}

/**
 * Fetches the current mallard count.
 * @returns The count, or null if the request failed or the response was malformed.
 */
async function fetchMallardCount(): Promise<number | null> {
  try {
    const res = await fetch(MALLARD_COUNT_API_URL);
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.count === "number" ? data.count : null;
  } catch {
    console.warn("display: could not fetch mallard count");
    return null;
  }
}

export default function MallardPanel() {
  const [mallardCount, setMallardCount] = useState<number | null>(null);
  const mallardCountRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flockRef = useRef<Duck[]>([]);

  useEffect(() => {
    const loadCount = () => {
      fetchMallardCount().then((count) => {
        if (count !== null) setMallardCount(count);
      });
    };
    loadCount();
    const countTimer = setInterval(loadCount, MALLARD_FETCH_INTERVAL_MS);
    return () => clearInterval(countTimer);
  }, []);

  // keep a ref in sync so the resize handler (set up once, below) always reads the latest count
  useEffect(() => {
    mallardCountRef.current = mallardCount;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderedCount = Math.min(mallardCount ?? 0, MAX_RENDERED_DUCKS);
    flockRef.current = adjustFlock(flockRef.current, renderedCount, canvas.width, canvas.height);
  }, [mallardCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const sprite = buildDuckSprite();

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const renderedCount = Math.min(mallardCountRef.current ?? 0, MAX_RENDERED_DUCKS);
      flockRef.current = adjustFlock(flockRef.current, renderedCount, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    let lastFrameTime = performance.now();
    let animationFrameId: number;

    const tick = (now: number) => {
      animationFrameId = requestAnimationFrame(tick);
      const elapsedMs = now - lastFrameTime;
      if (elapsedMs < ANIMATION_FRAME_INTERVAL_MS) return;
      const elapsedS = elapsedMs / 1000;
      lastFrameTime = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const duck of flockRef.current) {
        duck.x += duck.vx * elapsedS;
        duck.y += duck.vy * elapsedS;

        if (duck.x < -duck.sizePx) duck.x = canvas.width + duck.sizePx;
        if (duck.x > canvas.width + duck.sizePx) duck.x = -duck.sizePx;
        if (duck.y < -duck.sizePx) duck.y = canvas.height + duck.sizePx;
        if (duck.y > canvas.height + duck.sizePx) duck.y = -duck.sizePx;

        ctx.drawImage(
          sprite,
          duck.x - duck.sizePx / 2,
          duck.y - duck.sizePx / 2,
          duck.sizePx,
          duck.sizePx
        );
      }
    };
    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden font-mono">
      <canvas ref={canvasRef} className="absolute inset-0" />

      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-8">
        <div className="text-3xl text-gray-300 uppercase tracking-widest mb-2">
          There are at least
        </div>
        <div className="text-[13rem] leading-none font-bold text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
          {mallardCount !== null ? mallardCount : "---"}
        </div>
        <div className="text-3xl text-gray-300 uppercase tracking-widest mt-2">
          mallards on earth
        </div>
      </div>
    </div>
  );
}
