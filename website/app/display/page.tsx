"use client";

import { useEffect, useSyncExternalStore, type ReactElement } from "react";
import PhotoPanel from "./PhotoPanel";
import MallardPanel from "./MallardPanel";
import BpmDebugPanel from "./BpmDebugPanel";
import SurfCamPanel from "./SurfCamPanel";
import { prepareSurfCam, type SurfCamId } from "./surfCams";

/**
 * Always-on kiosk display page. Rotates through a fixed list of panels, each
 * a self-contained view (photos, mallard count, etc). Only the active panel
 * is mounted, so an inactive panel's polling/timers stop automatically.
 * Meant to be opened in a kiosk browser (e.g. Chrome --kiosk) on a
 * dedicated monitor, not browsed normally.
 *
 * The kiosk opens one copy per screen with `?screen=primary|secondary`, and
 * each role has its own panel list. Surf cams only go on the primary list,
 * since mpv plays on the primary screen and one page has to own the agent.
 * No param means primary.
 *
 * The active panel comes from the wall clock (one slot per
 * PANEL_ROTATE_INTERVAL_MS), not a timer chain, so both screens switch at
 * exactly the same moment and never drift apart.
 *
 * A panel with slow startup (a live video stream) can define `prepare`,
 * which fires PANEL_PREPARE_LEAD_MS before the panel is due on screen so it
 * can load in the background and appear already running.
 *
 * Planned panels not yet implemented (add back to a panel list as each one
 * is built, using PlaceholderPanel to stub it out first if useful): MTS
 * trolley info, Pac-Tyler bike map, BPM visualizer, server status.
 */

interface DisplayPanel {
  id: string;
  render: () => ReactElement;
  /** Optional: kick off slow loading shortly before this panel is shown. */
  prepare?: () => void;
}

type ScreenRole = "primary" | "secondary";

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
// rotation, so it's visible live on the kiosk. Remove BpmDebugPanel once
// the detector is tuned and the real BPM visualizer panel replaces it.
const BPM_DEBUG_MODE = false;

// how long each panel stays on screen before rotating to the next (ms)
const PANEL_ROTATE_INTERVAL_MS = 45_000;

// how long before a panel is due on screen its `prepare` hook fires. needs to
// cover the slowest panel's startup (mpv launch + first buffer)
const PANEL_PREPARE_LEAD_MS = 5_000;

const SCREEN_ROLE_PARAM = "screen";

const PHOTO_PANEL: DisplayPanel = { id: "photos", render: () => <PhotoPanel /> };
const MALLARD_PANEL: DisplayPanel = { id: "mallards", render: () => <MallardPanel /> };
const BPM_DEBUG_PANEL: DisplayPanel = { id: "bpm-debug", render: () => <BpmDebugPanel /> };

const PANELS_BY_ROLE: Record<ScreenRole, DisplayPanel[]> = BPM_DEBUG_MODE
  ? { primary: [BPM_DEBUG_PANEL], secondary: [BPM_DEBUG_PANEL] }
  : {
      primary: [
        PHOTO_PANEL,
        MALLARD_PANEL,
        surfCamPanel("pb"),
        surfCamPanel("la-jolla-shores"),
        surfCamPanel("scripps-underwater"),
      ],
      secondary: [PHOTO_PANEL, MALLARD_PANEL],
    };

/**
 * Reads this screen's role from the `?screen=` query param.
 * @returns "secondary" only when asked for explicitly, otherwise "primary".
 */
function readScreenRole(): ScreenRole {
  const role = new URLSearchParams(window.location.search).get(SCREEN_ROLE_PARAM);
  return role === "secondary" ? "secondary" : "primary";
}

/**
 * Rotation slot number for a moment in time. Every screen on the same clock
 * gets the same slot.
 * @param nowMs - Epoch time in ms.
 * @returns How many full rotation intervals have passed since the epoch.
 */
function slotAt(nowMs: number): number {
  return Math.floor(nowMs / PANEL_ROTATE_INTERVAL_MS);
}

/**
 * How long until the next slot starts.
 * @returns Milliseconds until the next PANEL_ROTATE_INTERVAL_MS boundary.
 */
function msUntilNextSlot(): number {
  return PANEL_ROTATE_INTERVAL_MS - (Date.now() % PANEL_ROTATE_INTERVAL_MS);
}

/**
 * useSyncExternalStore subscription that fires at every slot boundary.
 * A timer that fires a hair early just re-arms for the remaining ms.
 * @param onSlotChange - React's change callback.
 * @returns Unsubscribe function.
 */
function subscribeToSlots(onSlotChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const armNext = () => {
    timer = setTimeout(() => {
      onSlotChange();
      armNext();
    }, msUntilNextSlot());
  };
  armNext();
  return () => clearTimeout(timer);
}

/**
 * useSyncExternalStore subscription for values that never change (the url).
 * @returns A no-op unsubscribe function.
 */
function subscribeNever(): () => void {
  return () => {};
}

// the page is statically exported, so the url and clock only exist in the browser; on the
// server (build) both read as null and the page renders black until it hydrates
const readNothingOnServer = () => null;

export default function DisplayPage() {
  const role = useSyncExternalStore(subscribeNever, readScreenRole, readNothingOnServer);
  const slot = useSyncExternalStore(subscribeToSlots, () => slotAt(Date.now()), readNothingOnServer);
  const panels = role ? PANELS_BY_ROLE[role] : null;

  useEffect(() => {
    if (!panels || slot === null) return;
    const nextPanel = panels[(slot + 1) % panels.length];
    const prepareTimer = setTimeout(
      () => nextPanel.prepare?.(),
      Math.max(0, msUntilNextSlot() - PANEL_PREPARE_LEAD_MS)
    );
    return () => clearTimeout(prepareTimer);
  }, [panels, slot]);

  if (!panels || slot === null) return <div className="fixed inset-0 bg-black" />;
  return panels[slot % panels.length].render();
}
