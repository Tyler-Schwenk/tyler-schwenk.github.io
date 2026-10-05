"use client";

import { useEffect, useMemo, useSyncExternalStore, type ReactElement } from "react";
import PhotoPanel, { type PhotoHold } from "./PhotoPanel";
import MallardPanel from "./MallardPanel";
import BpmPanel, { BPM_VIEWS } from "./BpmPanel";
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
  type PresetControl,
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
 * Bpm mode isn't in the rotation: it's only shown from its key (b), since it
 * keeps the mic recording while it's up. It cycles through its own views
 * (BPM_VIEWS) on the same clock as the rotation, or holds one.
 *
 * Planned panels not yet implemented (add to ROTATION as each one is built,
 * using PlaceholderPanel to stub it out first if useful): MTS trolley info,
 * Pac-Tyler bike map, server status.
 */

/** What a panel needs to know beyond its own props: the photo hold, and bpm mode's view and preset stepping. */
interface PanelContext {
  photoHold: PhotoHold | null;
  bpmView: number;
  bpmPresets: PresetControl;
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

// how long each slot stays on screen before rotating to the next (ms)
const PANEL_ROTATE_INTERVAL_MS = 45_000;

// how long before a panel is due on screen its `prepare` hook fires. needs to
// cover the slowest panel's startup (mpv launch + first buffer)
const PANEL_PREPARE_LEAD_MS = 5_000;

const SCREEN_ROLE_PARAM = "screen";

const PHOTOS_SLOT_ID = "photos";
const MALLARDS_SLOT_ID = "mallards";
const BPM_SHORTCUT_KEY = "b";

// the secondary screen's photos change halfway between the primary's, so the two take turns.
// rendered identically in consecutive slots, React keeps a panel mounted and its photos carry on
const PRIMARY_PHOTOS: DisplayPanel = { render: ({ photoHold }) => <PhotoPanel hold={photoHold} /> };
const SECONDARY_PHOTOS: DisplayPanel = { render: ({ photoHold }) => <PhotoPanel staggered hold={photoHold} /> };
const MALLARDS: DisplayPanel = { render: () => <MallardPanel /> };

// shown only from its key, never in the rotation. both sides render BpmPanel whichever view
// is up, so it stays mounted (and keeps its stream) as the views change
const BPM_SLOT: RotationSlot = {
  id: "bpm",
  primary: {
    render: ({ bpmView, bpmPresets }) => <BpmPanel side="primary" viewIndex={bpmView} presets={bpmPresets} />,
  },
  secondary: {
    render: ({ bpmView, bpmPresets }) => <BpmPanel side="secondary" viewIndex={bpmView} presets={bpmPresets} />,
  },
};
const BPM_VIEW_LABELS = BPM_VIEWS.map((view) => view.label);

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

const ROTATION: RotationSlot[] = [
  { id: PHOTOS_SLOT_ID, primary: PRIMARY_PHOTOS, secondary: SECONDARY_PHOTOS },
  { id: MALLARDS_SLOT_ID, primary: PRIMARY_PHOTOS, secondary: MALLARDS },
  ...SURF_CAMS.map(({ id }) => surfCamSlot(id)),
];
const CAM_ROTATION = ROTATION.filter((slot) => slot.camId);

// digit shortcuts: 1-3 fixed, then one per cam in rotation order (4 = the first cam, ...),
// then b for bpm mode (where the digits pick bpm views instead, see kioskControl.ts)
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
  { key: BPM_SHORTCUT_KEY, label: "bpm visualizer", action: { kind: "bpm" } },
];

const CONTROL_CONFIG: ControlConfig = {
  intervalMs: PANEL_ROTATE_INTERVAL_MS,
  slotIds: ROTATION.map((slot) => slot.id),
  camSlotIds: CAM_ROTATION.map((slot) => slot.id),
  shortcuts: SHORTCUTS,
  bpmViewCount: BPM_VIEWS.length,
  bpmPresetViews: BPM_VIEWS.flatMap((view, i) => (view.hasPresets ? [i] : [])),
};

const NO_PRESET_STEPS: PresetControl = { step: 0, held: false };

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
 * Which item of the current rotation list (slots, cams or bpm views) is up, counted from the anchor.
 * @param state - Control state.
 * @param clockSlot - Rotation slots since the anchor's grid started (from useClockSlot).
 * @returns The item number; wrap it with the list length.
 */
function anchoredIndex(state: ControlState, clockSlot: number): number {
  // the clock slot counts intervals on the anchor's grid, so measure from the anchor's own slot
  const gridOffsetMs = state.anchorMs % PANEL_ROTATE_INTERVAL_MS;
  const anchorSlot = clockSlotAt(state.anchorMs, PANEL_ROTATE_INTERVAL_MS, gridOffsetMs);
  return state.anchorIndex + (clockSlot - anchorSlot);
}

/**
 * Which bpm view is up (only meaningful in bpm mode).
 * @param state - Control state.
 * @param clockSlot - From useClockSlot.
 * @returns Index into BPM_VIEWS.
 */
function pickBpmView(state: ControlState, clockSlot: number): number {
  const mode = state.mode;
  if (mode.kind === "bpm" && mode.heldView !== null) return mode.heldView;
  return wrapIndex(anchoredIndex(state, clockSlot), BPM_VIEWS.length);
}

/**
 * The slot showing now, and the one due next (null when nothing's due: a hold, or bpm mode).
 * @param state - Control state.
 * @param clockSlot - Rotation slots since the anchor's grid started (from useClockSlot).
 * @returns Current slot and next slot.
 */
function pickSlots(state: ControlState, clockSlot: number): { current: RotationSlot; next: RotationSlot | null } {
  const mode = state.mode;
  if (mode.kind === "bpm") return { current: BPM_SLOT, next: null };
  if (mode.kind === "hold-photo") return { current: ROTATION[0], next: null };
  if (mode.kind === "hold-slot") {
    return { current: ROTATION.find((slot) => slot.id === mode.slotId) ?? ROTATION[0], next: null };
  }
  const list = mode.kind === "cam-rotation" ? CAM_ROTATION : ROTATION;
  const index = anchoredIndex(state, clockSlot);
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

  if (!role || !slots || clockSlot === null) return <div className="fixed inset-0 bg-black" />;
  const photoHold = state.mode.kind === "hold-photo" ? state.mode : null;
  const bpmView = pickBpmView(state, clockSlot);
  const bpmPresets = state.mode.kind === "bpm" ? state.mode.preset : NO_PRESET_STEPS;
  return (
    <>
      {slots.current[side].render({ photoHold, bpmView, bpmPresets })}
      {role !== "primary" && <ControlOverlay state={state} shortcuts={SHORTCUTS} bpmViewLabels={BPM_VIEW_LABELS} />}
    </>
  );
}
