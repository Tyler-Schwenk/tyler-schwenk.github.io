"use client";

import { useEffect, useState } from "react";
import PhotoPanel from "./PhotoPanel";
import MallardPanel from "./MallardPanel";
import PlaceholderPanel from "./PlaceholderPanel";

/**
 * Always-on kiosk display page. Rotates through a fixed list of panels, each
 * a self-contained view (photos, mallard count, etc). Only the active panel
 * is mounted, so an inactive panel's polling/timers stop automatically.
 * Meant to be opened in a kiosk browser (e.g. Chromium --kiosk) on a
 * dedicated monitor, not browsed normally.
 */

// how long each panel stays on screen before rotating to the next (ms)
const PANEL_ROTATE_INTERVAL_MS = 45_000;

const PANELS = [
  { id: "photos", render: () => <PhotoPanel /> },
  { id: "mallards", render: () => <MallardPanel /> },
  { id: "trolley", render: () => <PlaceholderPanel name="MTS Trolley Info" /> },
  { id: "surf-cam", render: () => <PlaceholderPanel name="Surf Cam" /> },
  { id: "pac-tyler", render: () => <PlaceholderPanel name="Pac-Tyler Bike Map" /> },
  { id: "bpm-visualizer", render: () => <PlaceholderPanel name="BPM Visualizer" /> },
  { id: "server-status", render: () => <PlaceholderPanel name="Server Status" /> },
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
