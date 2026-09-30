"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/api";

/**
 * Display panel: current mallard count, with a floating background of duck
 * emoji -- one per mallard. Emoji shrink as the count grows so hundreds of
 * them still fit on screen instead of being capped.
 */

// proxied through our own backend (see pi/services/website-backend/app/routers/mallard.py)
// because the real source, api.traderoutes.cards, doesn't send CORS headers
const MALLARD_COUNT_API_URL = `${API_BASE}/mallard-count`;
const MALLARD_FETCH_INTERVAL_MS = 60_000;

const MALLARD_EMOJI = "\u{1F986}"; // duck emoji — closest standard emoji to a mallard

const FLOAT_DURATION_MIN_S = 18;
const FLOAT_DURATION_MAX_S = 34;
const FLOAT_DELAY_MAX_S = 12;
const FLOAT_DRIFT_MIN_PX = 40;
const FLOAT_DRIFT_MAX_PX = 140;

// emoji are sized at FLOAT_FONT_SIZE_{MIN,MAX}_PX when the count is at or
// below FLOAT_SIZE_REFERENCE_COUNT, and shrink (down to a visible floor) as
// the count grows past that, so density stays roughly constant on screen
const FLOAT_FONT_SIZE_MIN_PX = 28;
const FLOAT_FONT_SIZE_MAX_PX = 64;
const FLOAT_FONT_SIZE_FLOOR_PX = 10;
const FLOAT_SIZE_REFERENCE_COUNT = 60;

interface FloatingMallard {
  id: number;
  leftPercent: number;
  topPercent: number;
  durationS: number;
  delayS: number;
  driftXPx: number;
  driftYPx: number;
  fontSizePx: number;
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
 * Builds a list of randomly-placed, randomly-timed floating mallards. Emoji
 * size shrinks once the count passes FLOAT_SIZE_REFERENCE_COUNT, so a large
 * count still fits on screen instead of being capped.
 * @param count - How many to generate.
 * @returns Array of floating mallard layout/animation params.
 */
function buildFloatingMallards(count: number): FloatingMallard[] {
  const shrink = Math.min(1, Math.sqrt(FLOAT_SIZE_REFERENCE_COUNT / Math.max(count, 1)));
  const fontSizeMinPx = Math.max(FLOAT_FONT_SIZE_FLOOR_PX, FLOAT_FONT_SIZE_MIN_PX * shrink);
  const fontSizeMaxPx = Math.max(fontSizeMinPx, FLOAT_FONT_SIZE_MAX_PX * shrink);

  return Array.from({ length: count }, (_, id) => ({
    id,
    leftPercent: randomBetween(0, 100),
    topPercent: randomBetween(0, 100),
    durationS: randomBetween(FLOAT_DURATION_MIN_S, FLOAT_DURATION_MAX_S),
    delayS: randomBetween(0, FLOAT_DELAY_MAX_S),
    driftXPx: randomBetween(FLOAT_DRIFT_MIN_PX, FLOAT_DRIFT_MAX_PX),
    driftYPx: randomBetween(FLOAT_DRIFT_MIN_PX, FLOAT_DRIFT_MAX_PX),
    fontSizePx: randomBetween(fontSizeMinPx, fontSizeMaxPx),
  }));
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

  const floatingCount = mallardCount ?? 0;
  // only regenerate positions when the count actually changes, not on every poll
  const floatingMallards = useMemo(() => buildFloatingMallards(floatingCount), [floatingCount]);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden font-mono">
      {floatingMallards.map((mallard) => (
        <div
          key={mallard.id}
          className="absolute animate-mallard-float select-none"
          style={
            {
              left: `${mallard.leftPercent}%`,
              top: `${mallard.topPercent}%`,
              fontSize: `${mallard.fontSizePx}px`,
              animationDuration: `${mallard.durationS}s`,
              animationDelay: `${mallard.delayS}s`,
              "--mallard-drift-x": `${mallard.driftXPx}px`,
              "--mallard-drift-y": `${mallard.driftYPx}px`,
            } as React.CSSProperties
          }
        >
          {MALLARD_EMOJI}
        </div>
      ))}

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
