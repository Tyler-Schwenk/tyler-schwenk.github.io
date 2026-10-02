"use client";

import { useEffect, useMemo, useSyncExternalStore, type ReactElement } from "react";
import PhotoPanel, { type PhotoHold } from "./PhotoPanel";
import MallardPanel from "./MallardPanel";
import BpmDebugPanel from "./BpmDebugPanel";
import SurfCamPanel from "./SurfCamPanel";
import SurfConditionsPanel from "./SurfConditionsPanel";
import ControlOverlay from "./ControlOverlay";
import { SURF_CAMS, prepareSurfCam, type SurfCamId } from "./surfCams";
import { clockSlotAt, msUntilNextClockSlot, useClockSlot } from "./useClockSlot";
import {
  replayControl,
  useControlLog,
  wrapIndex,
  type ControlConfig,
  type ControlState,
  type Shortcut,
} from "./kioskControl";

/**
 * Always-on kiosk display page. Rotates through a fixed list of slots, each
 * pairing what the two screens show at the same time (photos on both, a surf
 * cam below with its conditions on top, etc). Only the active panel is
 * mounted, so an inactive panel's polling/timers stop automatically. Meant to
 * be opened in a kiosk browser (e.g. Chrome --kiosk) on a dedicated monitor,
 * not browsed normally.
 *
 * The kiosk opens one copy per screen with `?screen=primary|secondary|solo`:
 * primary is the external monitor (below), where mpv plays the surf cams;
 * secondary is the laptop's own screen (on top); solo is a lone screen, which
 * shows the primary side plus the keyboard overlay. No param means solo.
 *
 * The active slot comes from the wall clock (see useClockSlot), not a timer
 * chain, so both screens switch at exactly the same moment and stay paired.
 * The kiosk keyboard can hold a slot, rotate only the cams, step through
 * slots and so on (see kioskControl.ts); both pages replay the same key log,
 * so they stay paired through that too.
 *
 * A panel with slow startup (a live video stream) can define `prepare`,
 * which fires PANEL_PREPARE_LEAD_MS before the panel is due on screen so it
 * can load in the background and appear already running.
 *
 * Planned panels not yet implemented (add to ROTATION as each one is built,
 * using PlaceholderPanel to stub it out first if useful): MTS trolley info,
 * Pac-Tyler bike map, BPM visualizer, server status.
 */

/** What a panel needs to know beyond its own props: the current photo hold, if any. */
interface PanelContext {
  photoHold: PhotoHold | null;
}

interface DisplayPanel {
  render: (context: PanelContext) => ReactElement;
  /** Optional: kick off slow loading shortly before this panel is shown. */
  prepare?: () => void;
}

type ScreenRole = "primary" | "secondary" | "solo";

/** What each screen shows during one rotation slot. */
interface RotationSlot {
  id: string;
  primary: DisplayPanel;
  secondary: DisplayPanel;
  /** Set on surf cam slots, which make up the cam-only rotation. */
  camId?: SurfCamId;
}

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

const PHOTOS_SLOT_ID = "photos";
const MALLARDS_SLOT_ID = "mallards";

// the secondary screen's photos change halfway between the primary's, so the two take turns.
// rendered identically in consecutive slots, React keeps a panel mounted and its photos carry on
const PRIMARY_PHOTOS: DisplayPanel = { render: ({ photoHold }) => <PhotoPanel hold={photoHold} /> };
const SECONDARY_PHOTOS: DisplayPanel = { render: ({ photoHold }) => <PhotoPanel staggered hold={photoHold} /> };
const MALLARDS: DisplayPanel = { render: () => <MallardPanel /> };
const BPM_DEBUG: DisplayPanel = { render: () => <BpmDebugPanel /> };

/**
 * Builds a slot for a live surf cam: the video below, its conditions on top.
 * Only the primary panel talks to the agent's player, since mpv plays there.
 * @param camId - Cam id known to the surfcam agent.
 * @returns A slot that preloads the cam before it's shown.
 */
function surfCamSlot(camId: SurfCamId): RotationSlot {
  return {
    id: `surf-${camId}`,
    camId,
    primary: {
      // keyed so each cam gets its own mount: no status or conditions carried over from the last cam
      render: () => <SurfCamPanel key={camId} camId={camId} />,
      prepare: () => prepareSurfCam(camId),
    },
    secondary: { render: () => <SurfConditionsPanel key={camId} camId={camId} /> },
  };
}

const ROTATION: RotationSlot[] = BPM_DEBUG_MODE
  ? [{ id: "bpm-debug", primary: BPM_DEBUG, secondary: BPM_DEBUG }]
  : [
      { id: PHOTOS_SLOT_ID, primary: PRIMARY_PHOTOS, secondary: SECONDARY_PHOTOS },
      { id: MALLARDS_SLOT_ID, primary: PRIMARY_PHOTOS, secondary: MALLARDS },
      ...SURF_CAMS.map(({ id }) => surfCamSlot(id)),
    ];
const CAM_ROTATION = ROTATION.filter((slot) => slot.camId);

// digit shortcuts: 1-3 fixed, then one per cam in rotation order (4 = the first cam, ...)
const FIRST_CAM_SHORTCUT_KEY = 4;
const SHORTCUTS: Shortcut[] = [
  { key: "1", label: "hold this photo", action: { kind: "hold-photo" } },
  { key: "2", label: "mallard counter", action: { kind: "hold-slot", slotId: MALLARDS_SLOT_ID } },
  { key: "3", label: "surf cam rotation", action: { kind: "cam-rotation" } },
  ...SURF_CAMS.map(({ id, label }, i) => ({
    key: String(FIRST_CAM_SHORTCUT_KEY + i),
    label,
    action: { kind: "hold-slot" as const, slotId: `surf-${id}` },
  })),
];

const CONTROL_CONFIG: ControlConfig = {
  intervalMs: PANEL_ROTATE_INTERVAL_MS,
  slotIds: ROTATION.map((slot) => slot.id),
  camSlotIds: CAM_ROTATION.map((slot) => slot.id),
  shortcuts: SHORTCUTS,
};

/**
 * Reads this screen's role from the `?screen=` query param.
 * @returns The role, solo when missing or unrecognised.
 */
function readScreenRole(): ScreenRole {
  const role = new URLSearchParams(window.location.search).get(SCREEN_ROLE_PARAM);
  return role === "primary" || role === "secondary" ? role : "solo";
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

/**
 * The slot showing now, and the one due next (null when nothing's due: a hold).
 * @param state - Control state.
 * @param clockSlot - Rotation slots since the anchor's grid started (from useClockSlot).
 * @returns Current slot and next slot.
 */
function pickSlots(state: ControlState, clockSlot: number): { current: RotationSlot; next: RotationSlot | null } {
  const mode = state.mode;
  if (mode.kind === "hold-photo") return { current: ROTATION[0], next: null };
  if (mode.kind === "hold-slot") {
    return { current: ROTATION.find((slot) => slot.id === mode.slotId) ?? ROTATION[0], next: null };
  }
  const list = mode.kind === "cam-rotation" ? CAM_ROTATION : ROTATION;
  // the clock slot counts intervals on the anchor's grid, so measure from the anchor's own slot
  const gridOffsetMs = state.anchorMs % PANEL_ROTATE_INTERVAL_MS;
  const anchorSlot = clockSlotAt(state.anchorMs, PANEL_ROTATE_INTERVAL_MS, gridOffsetMs);
  const index = state.anchorIndex + (clockSlot - anchorSlot);
  return { current: list[wrapIndex(index, list.length)], next: list[wrapIndex(index + 1, list.length)] };
}

export default function DisplayPage() {
  const role = useSyncExternalStore(subscribeNever, readScreenRole, readNothingOnServer);
  const controlLog = useControlLog();
  const state = useMemo(() => replayControl(controlLog, CONTROL_CONFIG), [controlLog]);
  const gridOffsetMs = state.anchorMs % PANEL_ROTATE_INTERVAL_MS;
  const clockSlot = useClockSlot(PANEL_ROTATE_INTERVAL_MS, gridOffsetMs);
  const side = role === "secondary" ? "secondary" : "primary";
  const slots = clockSlot === null ? null : pickSlots(state, clockSlot);
  const nextPanel = slots?.next?.[side] ?? null;

  useEffect(() => {
    if (!nextPanel?.prepare) return;
    const prepareTimer = setTimeout(
      () => nextPanel.prepare?.(),
      Math.max(0, msUntilNextClockSlot(PANEL_ROTATE_INTERVAL_MS, gridOffsetMs) - PANEL_PREPARE_LEAD_MS)
    );
    return () => clearTimeout(prepareTimer);
  }, [nextPanel, gridOffsetMs]);

  if (!role || !slots) return <div className="fixed inset-0 bg-black" />;
  const photoHold = state.mode.kind === "hold-photo" ? state.mode : null;
  return (
    <>
      {slots.current[side].render({ photoHold })}
      {role !== "primary" && <ControlOverlay state={state} shortcuts={SHORTCUTS} />}
    </>
  );
}
