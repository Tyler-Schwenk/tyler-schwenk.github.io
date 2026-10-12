"use client";

import type { ReactElement } from "react";
import PhotoPanel, { type PhotoHold } from "./PhotoPanel";
import MallardPanel from "./MallardPanel";
import BpmPanel, { BPM_VIEWS } from "./BpmPanel";
import SurfConditionsPanel from "./SurfConditionsPanel";
import { useDisplayEnvironment } from "./displayEnvironment";
import { prepareSurfCam, type SurfCamId } from "./surfCams";
import { clockSlotAt, useClockSlot } from "./useClockSlot";
import { INITIAL_PRESET_CONTROL, wrapIndex, type ControlState, type PresetControl } from "./kioskControl";
import {
  MALLARDS_SLOT_ID,
  PANEL_ROTATE_INTERVAL_MS,
  PHOTOS_SLOT_ID,
  ROTATION_SLOTS,
  surfCamSlotId,
  type RotationSlotInfo,
} from "./displayConfig";

/**
 * What each screen shows, for any control state: the slots of
 * displayConfig.ts paired with their panels, and which slot (and bpm view) is
 * up at a given clock slot. Shared by the kiosk page and the console page's
 * simulation, so the two can't show different things for the same state.
 */

/** What a panel needs to know beyond its own props: the photo hold, and bpm mode's view and preset stepping. */
interface PanelContext {
  photoHold: PhotoHold | null;
  bpmView: number;
  bpmPresets: PresetControl;
}

/** One screen's content during a slot. */
export interface DisplayPanel {
  render: (context: PanelContext) => ReactElement;
  /** Optional: kick off slow loading shortly before this panel is shown (kiosk only). */
  prepare?: () => void;
}

/** Which of the two screens: primary is the monitor (below), secondary the laptop (on top). */
export type ScreenSide = "primary" | "secondary";

/** What each screen shows during one rotation slot. */
export interface RotationSlot {
  id: string;
  primary: DisplayPanel;
  secondary: DisplayPanel;
  /** Set on surf cam slots, which make up the cam-only rotation. */
  camId?: SurfCamId;
}

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

/** The bpm views' names, in order, for the shortcut menu. */
export const BPM_VIEW_LABELS = BPM_VIEWS.map((view) => view.label);

/**
 * The monitor during a cam slot: whatever the environment plays cams with
 * (the agent's mpv on the kiosk, a stand-in on the console page).
 * @param props.camId - Which cam.
 */
function SurfCamScreen({ camId }: { camId: SurfCamId }) {
  const { SurfCamPanel } = useDisplayEnvironment();
  return <SurfCamPanel camId={camId} />;
}

/**
 * Builds a slot for a live surf cam: the video below, its conditions on top.
 * Only the primary panel talks to the agent's player, since mpv plays there.
 * @param camId - Cam id known to the surfcam agent.
 * @returns A slot that preloads the cam before it's shown.
 */
function surfCamSlot(camId: SurfCamId): RotationSlot {
  return {
    id: surfCamSlotId(camId),
    camId,
    primary: {
      // keyed so each cam gets its own mount: no status or conditions carried over from the last cam
      render: () => <SurfCamScreen key={camId} camId={camId} />,
      prepare: () => prepareSurfCam(camId),
    },
    secondary: { render: () => <SurfConditionsPanel key={camId} camId={camId} /> },
  };
}

// what each screen shows during the slots that aren't cams
const FIXED_SLOT_PANELS: Record<string, Pick<RotationSlot, "primary" | "secondary">> = {
  [PHOTOS_SLOT_ID]: { primary: PRIMARY_PHOTOS, secondary: SECONDARY_PHOTOS },
  [MALLARDS_SLOT_ID]: { primary: PRIMARY_PHOTOS, secondary: MALLARDS },
};

/**
 * Pairs a slot from displayConfig.ts with what each screen shows during it.
 * @param slot - The slot.
 * @returns The slot with its panels.
 */
function buildSlot(slot: RotationSlotInfo): RotationSlot {
  if (slot.camId) return surfCamSlot(slot.camId);
  return { id: slot.id, ...FIXED_SLOT_PANELS[slot.id] };
}

const ROTATION: RotationSlot[] = ROTATION_SLOTS.map(buildSlot);
const CAM_ROTATION = ROTATION.filter((slot) => slot.camId);

/**
 * Where the rotation's slot grid starts, so slots change on the anchor's own boundaries.
 * @param state - Control state.
 * @returns Offset into each interval, ms.
 */
export function rotationGridOffsetMs(state: ControlState): number {
  return state.anchorMs % PANEL_ROTATE_INTERVAL_MS;
}

/**
 * The rotation's clock slot for a control state, ticking over on the wall clock.
 * @param state - Control state.
 * @returns Slots since the anchor's grid started, null until mounted.
 */
export function useRotationClockSlot(state: ControlState): number | null {
  return useClockSlot(PANEL_ROTATE_INTERVAL_MS, rotationGridOffsetMs(state));
}

/**
 * Which item of the current rotation list (slots, cams or bpm views) is up, counted from the anchor.
 * @param state - Control state.
 * @param clockSlot - Rotation slots since the anchor's grid started (from useRotationClockSlot).
 * @returns The item number; wrap it with the list length.
 */
function anchoredIndex(state: ControlState, clockSlot: number): number {
  // the clock slot counts intervals on the anchor's grid, so measure from the anchor's own slot
  const anchorSlot = clockSlotAt(state.anchorMs, PANEL_ROTATE_INTERVAL_MS, rotationGridOffsetMs(state));
  return state.anchorIndex + (clockSlot - anchorSlot);
}

/**
 * Which bpm view is up (only meaningful in bpm mode).
 * @param state - Control state.
 * @param clockSlot - From useRotationClockSlot.
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
 * @param clockSlot - From useRotationClockSlot.
 * @returns Current slot and next slot.
 */
export function pickSlots(state: ControlState, clockSlot: number): { current: RotationSlot; next: RotationSlot | null } {
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

/**
 * What one screen shows for a control state at a clock slot.
 * @param props.side - Which screen.
 * @param props.state - Control state (from replayControl, or the console's own keys).
 * @param props.clockSlot - From useRotationClockSlot.
 */
export function DisplayScreen({ side, state, clockSlot }: { side: ScreenSide; state: ControlState; clockSlot: number }) {
  const { current } = pickSlots(state, clockSlot);
  const photoHold = state.mode.kind === "hold-photo" ? state.mode : null;
  const bpmView = pickBpmView(state, clockSlot);
  const bpmPresets = state.mode.kind === "bpm" ? state.mode.preset : INITIAL_PRESET_CONTROL;
  return current[side].render({ photoHold, bpmView, bpmPresets });
}
