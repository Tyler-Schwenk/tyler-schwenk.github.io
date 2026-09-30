"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/api";

/**
 * Display panel: current mallard count, with a floating background of duck
 * emoji (one per mallard, capped for performance).
 */

// proxied through our own backend (see pi/services/website-backend/app/routers/mallard.py)
// because the real source, api.traderoutes.cards, doesn't send CORS headers
const MALLARD_COUNT_API_URL = `${API_BASE}/mallard-count`;
const MALLARD_FETCH_INTERVAL_MS = 60_000;

const MALLARD_EMOJI = "\u{1F986}"; // duck emoji — closest standard emoji to a mallard

// cap the floating emoji count so a huge mallard count can't bog down the Pi's renderer
const MAX_FLOATING_MALLARDS = 60;

const FLOAT_DURATION_MIN_S = 18;
const FLOAT_DURATION_MAX_S = 34;
const FLOAT_DELAY_MAX_S = 12;
const FLOAT_DRIFT_MIN_PX = 40;
const FLOAT_DRIFT_MAX_PX = 140;
const FLOAT_FONT_SIZE_MIN_PX = 28;
const FLOAT_FONT_SIZE_MAX_PX = 64;

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
 * Builds a list of randomly-placed, randomly-timed floating mallards.
 * @param count - How many to generate.
 * @returns Array of floating mallard layout/animation params.
 */
function buildFloatingMallards(count: number): FloatingMallard[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    leftPercent: randomBetween(0, 100),
    topPercent: randomBetween(0, 100),
    durationS: randomBetween(FLOAT_DURATION_MIN_S, FLOAT_DURATION_MAX_S),
    delayS: randomBetween(0, FLOAT_DELAY_MAX_S),
    driftXPx: randomBetween(FLOAT_DRIFT_MIN_PX, FLOAT_DRIFT_MAX_PX),
    driftYPx: randomBetween(FLOAT_DRIFT_MIN_PX, FLOAT_DRIFT_MAX_PX),
    fontSizePx: randomBetween(FLOAT_FONT_SIZE_MIN_PX, FLOAT_FONT_SIZE_MAX_PX),
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

  const floatingCount = Math.min(mallardCount ?? 0, MAX_FLOATING_MALLARDS);
  // only regenerate positions when the (capped) count actually changes, not on every poll
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
