import { SURF_CAMS, type SurfCamId } from "./surfCams";
import {
  bpmViewAt,
  rotationSlotIdAt,
  wrapIndex,
  type ControlConfig,
  type ControlState,
  type Shortcut,
} from "./kioskControl";

/**
 * What the display shows and how its keys map, without any of the panels
 * themselves: the rotation's slots, the bpm views, the shortcuts, and the
 * state machine's config. The display page builds its panels from this, and
 * the admin page's remote uses it to label its buttons and to say what's on
 * screen, so the two can't drift apart.
 */

/** How long each slot stays on screen before rotating to the next. */
export const PANEL_ROTATE_INTERVAL_MS = 45_000;

export const PHOTOS_SLOT_ID = "photos";
export const MALLARDS_SLOT_ID = "mallards";
const BPM_SHORTCUT_KEY = "b";

/** One slot of the rotation, as named on the remote. Cam slots carry their cam. */
export interface RotationSlotInfo {
  id: string;
  label: string;
  camId?: SurfCamId;
}

/**
 * The slot id for a surf cam.
 * @param camId - Cam id known to the surfcam agent.
 * @returns Its slot id.
 */
export function surfCamSlotId(camId: SurfCamId): string {
  return `surf-${camId}`;
}

/** The rotation, in order: photos, mallards, then each cam. */
export const ROTATION_SLOTS: RotationSlotInfo[] = [
  { id: PHOTOS_SLOT_ID, label: "Photos" },
  { id: MALLARDS_SLOT_ID, label: "Mallard counter" },
  ...SURF_CAMS.map(({ id, label }) => ({ id: surfCamSlotId(id), label, camId: id })),
];

/** One of bpm mode's views. BpmPanel pairs each id with its component. */
export interface BpmViewInfo {
  id: "bars" | "calibration" | "halo" | "dj" | "milkdrop";
  /** Name in the menu, on the readout, and on the remote. */
  label: string;
  /** Show the calibration keys on the readout while it's up. */
  calibration?: boolean;
  /** Needs the raw waveform in the stream (see useBpmStream). */
  needsWaveform?: boolean;
  /** Has presets that ] and [ step through while it's up (see kioskControl.ts). */
  hasPresets?: boolean;
}

/** The bpm views, in cycling order. In bpm mode digit n holds view n (1 = the first). */
export const BPM_VIEW_INFO: BpmViewInfo[] = [
  { id: "bars", label: "spectrum bars" },
  { id: "calibration", label: "calibration", calibration: true },
  { id: "halo", label: "halo" },
  { id: "dj", label: "dj meters" },
  { id: "milkdrop", label: "milkdrop", needsWaveform: true, hasPresets: true },
];

// digit shortcuts: 1-3 fixed, then one per cam in rotation order (4 = the first cam, ...),
// then b for bpm mode (where the digits pick bpm views instead, see kioskControl.ts)
const FIRST_CAM_SHORTCUT_KEY = 4;

/** The shortcut keys, in menu order. */
export const SHORTCUTS: Shortcut[] = [
  { key: "1", label: "hold this photo", action: { kind: "hold-photo" } },
  { key: "2", label: "mallard counter", action: { kind: "hold-slot", slotId: MALLARDS_SLOT_ID } },
  { key: "3", label: "surf cam rotation", action: { kind: "cam-rotation" } },
  ...SURF_CAMS.map(({ id, label }, i) => ({
    key: String(FIRST_CAM_SHORTCUT_KEY + i),
    label,
    action: { kind: "hold-slot" as const, slotId: surfCamSlotId(id) },
  })),
  { key: BPM_SHORTCUT_KEY, label: "bpm visualizer", action: { kind: "bpm" } },
];

/** What the key-log state machine needs to know about the rotation. */
export const CONTROL_CONFIG: ControlConfig = {
  intervalMs: PANEL_ROTATE_INTERVAL_MS,
  slotIds: ROTATION_SLOTS.map((slot) => slot.id),
  camSlotIds: ROTATION_SLOTS.filter((slot) => slot.camId).map((slot) => slot.id),
  shortcuts: SHORTCUTS,
  bpmViewCount: BPM_VIEW_INFO.length,
  bpmPresetViews: BPM_VIEW_INFO.flatMap((view, i) => (view.hasPresets ? [i] : [])),
};

/** What the screens are doing, in words, for the remote. */
export interface DisplayDescription {
  /** What's on screen, like "La Jolla Shores" or "BPM: halo". */
  showing: string;
  /** How it got there, like "standard rotation" or "held". */
  mode: string;
  /** How long until it moves on by itself, or null while something's held. */
  nextChangeInMs: number | null;
}

/**
 * The name of a rotation slot.
 * @param slotId - Slot id.
 * @returns Its label, or the id itself if it's not in the rotation.
 */
function slotLabel(slotId: string): string {
  return ROTATION_SLOTS.find((slot) => slot.id === slotId)?.label ?? slotId;
}

/**
 * How bpm mode is moving through its views, in words.
 * @param heldView - The held view, or null while cycling.
 * @param presetHeld - Whether ] / [ have held a preset.
 * @returns Like "cycling views".
 */
function bpmModeLabel(heldView: number | null, presetHeld: boolean): string {
  if (presetHeld) return "preset held";
  return heldView === null ? "cycling views" : "view held";
}

/**
 * How long until a rotating mode moves on to its next item.
 * @param state - Control state, for its anchor.
 * @param atMs - The moment, epoch ms on the kiosk's clock.
 * @returns Ms until the next change.
 */
function msUntilNextItem(state: ControlState, atMs: number): number {
  return PANEL_ROTATE_INTERVAL_MS - wrapIndex(atMs - state.anchorMs, PANEL_ROTATE_INTERVAL_MS);
}

/**
 * Says what the screens show at a moment, from a replayed control state.
 * @param state - Control state (from replayControl).
 * @param atMs - The moment, epoch ms on the kiosk's clock.
 * @returns What's showing, why, and when it next changes by itself.
 */
export function describeDisplay(state: ControlState, atMs: number): DisplayDescription {
  const mode = state.mode;
  if (mode.kind === "hold-photo") return { showing: "Photos", mode: "photo held", nextChangeInMs: null };
  if (mode.kind === "hold-slot") return { showing: slotLabel(mode.slotId), mode: "held", nextChangeInMs: null };
  if (mode.kind === "bpm") {
    const view = BPM_VIEW_INFO[bpmViewAt(state, CONTROL_CONFIG, atMs)];
    return {
      showing: `BPM: ${view?.label ?? "unknown view"}`,
      mode: bpmModeLabel(mode.heldView, mode.preset.held),
      nextChangeInMs: mode.heldView === null ? msUntilNextItem(state, atMs) : null,
    };
  }
  return {
    showing: slotLabel(rotationSlotIdAt(state, CONTROL_CONFIG, atMs)),
    mode: mode.kind === "cam-rotation" ? "surf cams only" : "standard rotation",
    nextChangeInMs: msUntilNextItem(state, atMs),
  };
}
