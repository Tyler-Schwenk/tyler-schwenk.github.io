"use client";

import { useEffect, useState } from "react";

/**
 * Display panel: full-screen current mallard count.
 */

// endpoint and cadence — matches pi/services/mallard-counter/main.py
const MALLARD_COUNT_API_URL = "https://api.traderoutes.cards/api/mallard-counter/count/";
const MALLARD_FETCH_INTERVAL_MS = 60_000;

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

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center font-mono">
      <div className="text-2xl text-gray-400 uppercase tracking-widest mb-4">
        Mallard Count
      </div>
      <div className="text-[12rem] leading-none font-bold text-white">
        {mallardCount !== null ? mallardCount : "---"}
      </div>
    </div>
  );
}
