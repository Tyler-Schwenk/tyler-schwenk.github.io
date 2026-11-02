"use client";

import { useEffect, useState } from "react";
import { fetchKilnStatus } from "@/app/kiln/kilnApi";

/**
 * checks once whether the kiln's firing right now, for the home page's kiln sprite.
 * stays false until it knows, and if the backend can't be reached, so the sprite just
 * shows the idle kiln.
 *
 * @returns {boolean} true when a firing's in progress.
 */
export function useKilnFiring(): boolean {
  const [firing, setFiring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchKilnStatus()
      .then((status) => {
        if (!cancelled) setFiring(status.firing !== null);
      })
      .catch((error) => console.warn("couldn't check whether the kiln's firing:", error));
    return () => {
      cancelled = true;
    };
  }, []);

  return firing;
}
