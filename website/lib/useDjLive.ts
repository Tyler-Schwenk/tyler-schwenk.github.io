"use client";

import { useEffect, useState } from "react";
import { fetchDjStatus } from "@/app/opium-den/djApi";

// slow on purpose: it's a flourish on the home page, not the player
const POLL_INTERVAL_MS = 30000;

/**
 * whether the dj stream's on air, for the home page's opium den board. checks on load
 * and then every 30 s while the tab's visible, so the board lights up if a set starts
 * while someone's on the page. stays false until it knows, and if the backend can't be
 * reached.
 *
 * @returns {boolean} true while the stream's live.
 */
export function useDjLive(): boolean {
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      fetchDjStatus()
        .then((status) => {
          if (!cancelled) setLive(status.live);
        })
        .catch((error) => console.warn("couldn't check whether the dj stream's live:", error));
    };
    check();
    const timer = setInterval(() => {
      if (!document.hidden) check();
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return live;
}
