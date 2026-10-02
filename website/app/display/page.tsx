"use client";

import { useEffect, useSyncExternalStore, type ReactElement } from "react";
import PhotoPanel from "./PhotoPanel";
import MallardPanel from "./MallardPanel";
import BpmDebugPanel from "./BpmDebugPanel";
import SurfCamPanel from "./SurfCamPanel";
import SurfConditionsPanel from "./SurfConditionsPanel";
import { prepareSurfCam, type SurfCamId } from "./surfCams";
import { msUntilNextClockSlot, useClockSlot } from "./useClockSlot";

/**
 * Always-on kiosk display page. Rotates through a fixed list of slots, each
 * pairing what the two screens show at the same time (photos on both, a surf
 * cam below with its conditions on top, etc). Only the active panel is
 * mounted, so an inactive panel's polling/timers stop automatically. Meant to
 * be opened in a kiosk browser (e.g. Chrome --kiosk) on a dedicated monitor,
 * not browsed normally.
 *
 * The kiosk opens one copy per screen with `?screen=primary|secondary`
 * (primary is the external monitor, where mpv plays the surf cams; secondary
 * is the laptop's own screen above it). No param means primary.
 *
 * The active slot comes from the wall clock (see useClockSlot), not a timer
 * chain, so both screens switch at exactly the same moment and stay paired.
 *
 * A panel with slow startup (a live video stream) can define `prepare`,
 * which fires PANEL_PREPARE_LEAD_MS before the panel is due on screen so it
 * can load in the background and appear already running.
 *
 * Planned panels not yet implemented (add to ROTATION as each one is built,
 * using PlaceholderPanel to stub it out first if useful): MTS trolley info,
 * Pac-Tyler bike map, BPM visualizer, server status.
 */

interface DisplayPanel {
  id: string;
  render: () => ReactElement;
  /** Optional: kick off slow loading shortly before this panel is shown. */
  prepare?: () => void;
}

type ScreenRole = "primary" | "secondary";

/** What each screen shows during one rotation slot. */
type RotationSlot = Record<ScreenRole, DisplayPanel>;

// TEMPORARY: while tuning pi/services/bpm-detector, this can be flipped to
// true to show only the raw BPM debug readout instead of the normal
// rotation, so it's visible live on the kiosk. Remove BpmDebugPanel once
// the detector is tuned and the real BPM visualizer panel replaces it.
const BPM_DEBUG_MODE = false;

// how long each slot stays on screen before rotating to the next (ms)
const PANEL_ROTATE_INTERVAL_MS = 45_000;

// how long before a panel is due on screen its `prepare` hook fires. needs to
// cover the slowest panel's startup (mpv launch + first buffer)
const PANEL_PREPARE_LEAD_MS = 5_000;

const SCREEN_ROLE_PARAM = "screen";

// the secondary screen's photos change halfway between the primary's, so the two take turns.
// rendered identically in consecutive slots, React keeps it mounted and the photos carry on
const PRIMARY_PHOTOS: DisplayPanel = { id: "photos", render: () => <PhotoPanel /> };
const SECONDARY_PHOTOS: DisplayPanel = { id: "photos-staggered", render: () => <PhotoPanel staggered /> };
const MALLARDS: DisplayPanel = { id: "mallards", render: () => <MallardPanel /> };
const BPM_DEBUG: DisplayPanel = { id: "bpm-debug", render: () => <BpmDebugPanel /> };

/**
 * Builds a slot for a live surf cam: the video below, its conditions on top.
 * Only the primary panel talks to the agent's player, since mpv plays there.
 * @param camId - Cam id known to the surfcam agent.
 * @returns A slot that preloads the cam before it's shown.
 */
function surfCamSlot(camId: SurfCamId): RotationSlot {
  return {
    primary: {
      id: `surf-${camId}`,
      render: () => <SurfCamPanel camId={camId} />,
      prepare: () => prepareSurfCam(camId),
    },
    secondary: {
      id: `surf-conditions-${camId}`,
      render: () => <SurfConditionsPanel camId={camId} />,
    },
  };
}

const ROTATION: RotationSlot[] = BPM_DEBUG_MODE
  ? [{ primary: BPM_DEBUG, secondary: BPM_DEBUG }]
  : [
      { primary: PRIMARY_PHOTOS, secondary: SECONDARY_PHOTOS },
      { primary: MALLARDS, secondary: SECONDARY_PHOTOS },
      surfCamSlot("pb"),
      surfCamSlot("la-jolla-shores"),
      surfCamSlot("scripps"),
      surfCamSlot("scripps-underwater"),
      surfCamSlot("moonlight"),
    ];

/**
 * Reads this screen's role from the `?screen=` query param.
 * @returns "secondary" only when asked for explicitly, otherwise "primary".
 */
function readScreenRole(): ScreenRole {
  const role = new URLSearchParams(window.location.search).get(SCREEN_ROLE_PARAM);
  return role === "secondary" ? "secondary" : "primary";
}

/**
 * useSyncExternalStore subscription for values that never change (the url).
 * @returns A no-op unsubscribe function.
 */
function subscribeNever(): () => void {
  return () => {};
}

// the page is statically exported, so there's no url at build time; the role reads as
// null on the server and the page renders black until it hydrates
const readNothingOnServer = () => null;

export default function DisplayPage() {
  const role = useSyncExternalStore(subscribeNever, readScreenRole, readNothingOnServer);
  const slot = useClockSlot(PANEL_ROTATE_INTERVAL_MS);

  useEffect(() => {
    if (!role || slot === null) return;
    const nextPanel = ROTATION[(slot + 1) % ROTATION.length][role];
    const prepareTimer = setTimeout(
      () => nextPanel.prepare?.(),
      Math.max(0, msUntilNextClockSlot(PANEL_ROTATE_INTERVAL_MS) - PANEL_PREPARE_LEAD_MS)
    );
    return () => clearTimeout(prepareTimer);
  }, [role, slot]);

  if (!role || slot === null) return <div className="fixed inset-0 bg-black" />;
  return ROTATION[slot % ROTATION.length][role].render();
}
