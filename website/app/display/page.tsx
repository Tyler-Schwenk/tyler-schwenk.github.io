"use client";

import { useEffect, useState, type ReactElement } from "react";
import PhotoPanel from "./PhotoPanel";
import MallardPanel from "./MallardPanel";
import BpmDebugPanel from "./BpmDebugPanel";
import SurfCamPanel from "./SurfCamPanel";
import { prepareSurfCam, type SurfCamId } from "./surfCams";

/**
 * Always-on kiosk display page. Rotates through a fixed list of panels, each
 * a self-contained view (photos, mallard count, etc). Only the active panel
 * is mounted, so an inactive panel's polling/timers stop automatically.
 * Meant to be opened in a kiosk browser (e.g. Chromium --kiosk) on a
 * dedicated monitor, not browsed normally.
 *
 * A panel with slow startup (a live video stream) can define `prepare`,
 * which fires PANEL_PREPARE_LEAD_MS before the panel is due on screen so it
 * can load in the background and appear already running.
 *
 * Planned panels not yet implemented (add back to PANELS as each one is
 * built, using PlaceholderPanel to stub it out first if useful): MTS
 * trolley info, Pac-Tyler bike map, BPM visualizer, server status.
 */

interface DisplayPanel {
  id: string;
  render: () => ReactElement;
  /** Optional: kick off slow loading shortly before this panel is shown. */
  prepare?: () => void;
}

/**
 * Builds a rotation entry for a live surf cam.
 * @param camId - Cam id known to the surfcam agent.
 * @returns A panel that preloads the cam before it's shown.
 */
function surfCamPanel(camId: SurfCamId): DisplayPanel {
  return {
    id: `surf-${camId}`,
    render: () => <SurfCamPanel camId={camId} />,
    prepare: () => prepareSurfCam(camId),
  };
}

// TEMPORARY: while tuning pi/services/bpm-detector, this can be flipped to
// true to show only the raw BPM debug readout instead of the normal
// rotation, so it's visible live on displaypi. Remove BpmDebugPanel once
// the detector is tuned and the real BPM visualizer panel replaces it.
const BPM_DEBUG_MODE = false;

// how long each panel stays on screen before rotating to the next (ms)
const PANEL_ROTATE_INTERVAL_MS = 45_000;

// how long before a panel is due on screen its `prepare` hook fires. needs to
// cover the slowest panel's startup (mpv launch + first buffer on the Pi)
const PANEL_PREPARE_LEAD_MS = 5_000;

const PANELS: DisplayPanel[] = BPM_DEBUG_MODE
  ? [{ id: "bpm-debug", render: () => <BpmDebugPanel /> }]
  : [
      { id: "photos", render: () => <PhotoPanel /> },
      { id: "mallards", render: () => <MallardPanel /> },
      surfCamPanel("pb"),
      surfCamPanel("scripps"),
      surfCamPanel("scripps-underwater"),
    ];

export default function DisplayPage() {
  const [panelIndex, setPanelIndex] = useState(0);

  useEffect(() => {
    const nextIndex = (panelIndex + 1) % PANELS.length;
    const prepareTimer = setTimeout(
      () => PANELS[nextIndex].prepare?.(),
      PANEL_ROTATE_INTERVAL_MS - PANEL_PREPARE_LEAD_MS
    );
    const rotateTimer = setTimeout(() => setPanelIndex(nextIndex), PANEL_ROTATE_INTERVAL_MS);
    return () => {
      clearTimeout(prepareTimer);
      clearTimeout(rotateTimer);
    };
  }, [panelIndex]);

  return PANELS[panelIndex].render();
}
