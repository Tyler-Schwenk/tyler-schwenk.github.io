"use client";

import { useEffect, useState } from "react";
import PhotoPanel from "./PhotoPanel";
import MallardPanel from "./MallardPanel";

/**
 * Always-on kiosk display page. Rotates through a fixed list of panels, each
 * a self-contained view (photos, mallard count, etc). Only the active panel
 * is mounted, so an inactive panel's polling/timers stop automatically.
 * Meant to be opened in a kiosk browser (e.g. Chromium --kiosk) on a
 * dedicated monitor, not browsed normally.
 *
 * Planned panels not yet implemented (add back to PANELS as each one is
 * built, using PlaceholderPanel to stub it out first if useful): MTS
 * trolley info, surf cam, Pac-Tyler bike map, BPM visualizer, server status.
 */

// how long each panel stays on screen before rotating to the next (ms)
const PANEL_ROTATE_INTERVAL_MS = 45_000;

const PANELS = [
  { id: "photos", render: () => <PhotoPanel /> },
  { id: "mallards", render: () => <MallardPanel /> },
];

export default function DisplayPage() {
  const [panelIndex, setPanelIndex] = useState(0);

  useEffect(() => {
    const rotateTimer = setInterval(() => {
      setPanelIndex((current) => (current + 1) % PANELS.length);
    }, PANEL_ROTATE_INTERVAL_MS);
    return () => clearInterval(rotateTimer);
  }, []);

  return PANELS[panelIndex].render();
}
