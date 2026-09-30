"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

/**
 * Temporary debug panel for tuning the mic-based BPM detector
 * (pi/services/bpm-detector). Shows the raw current BPM estimate in large
 * text with no visual dressing, so it can be read from across a room while
 * playing a known-BPM song near fart-pi's mic and comparing by eye.
 *
 * This is not one of the real display panels -- remove it (and the
 * BPM_DEBUG_MODE branch in page.tsx) once the detector is tuned and the
 * real BPM visualizer panel replaces it.
 */

const BPM_API_URL = `${API_BASE}/bpm`;

// frequent polling is fine here -- this is a temporary local debug tool, not
// the real panel, and tight feedback matters more than request volume
const BPM_FETCH_INTERVAL_MS = 1_000;

interface BpmResponse {
  bpm: number | null;
  updated_at: string | null;
}

/**
 * Fetches the current BPM estimate.
 * @returns The parsed response, or null if the request failed.
 */
async function fetchBpm(): Promise<BpmResponse | null> {
  try {
    const res = await fetch(BPM_API_URL, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    console.warn("display: could not fetch bpm");
    return null;
  }
}

export default function BpmDebugPanel() {
  const [bpm, setBpm] = useState<number | null>(null);
  const [hasSignal, setHasSignal] = useState(false);

  useEffect(() => {
    const load = () => {
      fetchBpm().then((data) => {
        setBpm(data?.bpm ?? null);
        setHasSignal(data?.bpm != null);
      });
    };
    load();
    const timer = setInterval(load, BPM_FETCH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center font-mono">
      <div className="text-3xl text-gray-400 uppercase tracking-widest mb-4">
        BPM debug
      </div>
      <div
        className={`text-[16rem] leading-none font-bold ${hasSignal ? "text-white" : "text-gray-700"}`}
      >
        {bpm !== null ? bpm.toFixed(1) : "---"}
      </div>
      <div className="text-2xl text-gray-500 mt-4">
        {hasSignal ? "signal live" : "no signal"}
      </div>
    </div>
  );
}
