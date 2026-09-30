"use client";

import { useEffect, useState } from "react";
import PhotoPanel from "./PhotoPanel";
import MallardPanel from "./MallardPanel";
import BpmDebugPanel from "./BpmDebugPanel";

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

// TEMPORARY: while tuning pi/services/bpm-detector, this can be flipped to
// true to show only the raw BPM debug readout instead of the normal
// rotation, so it's visible live on displaypi. Remove BpmDebugPanel once
// the detector is tuned and the real BPM visualizer panel replaces it.
const BPM_DEBUG_MODE = false;

// how long each panel stays on screen before rotating to the next (ms)
const PANEL_ROTATE_INTERVAL_MS = 45_000;

const PANELS = BPM_DEBUG_MODE
  ? [{ id: "bpm-debug", render: () => <BpmDebugPanel /> }]
  : [
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
