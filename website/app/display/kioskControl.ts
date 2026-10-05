"use client";

import { useEffect, useState } from "react";
import { SURFCAM_AGENT_URL } from "./surfCams";

/**
 * Keyboard control for the display kiosk.
 *
 * The kiosk's keys are grabbed system-wide and posted to the surfcam agent,
 * which keeps a log of every press since the last reset (see
 * pi/services/surfcam-agent/kiosk_control.py). Each page long-polls that log
 * and replays it through `replayControl`, a pure state machine, so both
 * screens always land in the same state, and a page that reloads just replays
 * the log and picks up where things were. The log is cleared when the
 * overnight sleep starts, so each morning begins on the standard rotation.
 *
 * Keys: tab toggles the shortcut menu, escape goes straight back to the
 * standard display, backspace goes back one step (closes the menu, else ends
 * a hold or the cam-only rotation), ] and [ step to the next/previous item
 * and hold it there, and the shortcut keys (the digits, and b for bpm mode)
 * run the shortcuts from anywhere, menu open or not.
 *
 * Bpm mode has its own little rotation: it cycles through the bpm views, and
 * inside it the digits hold a view (1 = the first), ] and [ step views and
 * hold, backspace goes from a held view back to cycling and from cycling out
 * of bpm mode, and b resumes cycling from the view that's up. On a view with
 * presets (milkdrop), ] and [ step its presets instead and hold the view and
 * preset, and backspace first lets the presets move on by themselves again.
 */

/** A key press as the agent logs it. `at_ms` is epoch ms on the kiosk's clock. */
export interface ControlEvent {
  key: string;
  at_ms: number;
}

/** The agent's log of presses since the last reset. */
export interface ControlLog {
  session_ms: number;
  version: number;
  events: ControlEvent[];
}

/** What a shortcut key does. */
export type ShortcutAction =
  | { kind: "hold-photo" }
  | { kind: "hold-slot"; slotId: string }
  | { kind: "cam-rotation" }
  | { kind: "bpm" };

/** One entry of the shortcut menu. */
export interface Shortcut {
  key: string;
  label: string;
  action: ShortcutAction;
}

/** What the screens are doing. */
export type DisplayMode =
  /** The standard rotation through every slot. */
  | { kind: "rotation" }
  /** Rotating through only the surf cam slots. */
  | { kind: "cam-rotation" }
  /** Staying on one slot. */
  | { kind: "hold-slot"; slotId: string }
  /**
   * Bpm mode (never part of the main rotation): staying on view `heldView`,
   * or cycling through the views from the anchor when it's null. `preset`
   * is what ] and [ have done on a view with presets.
   */
  | { kind: "bpm"; heldView: number | null; preset: PresetControl }
  /**
   * Staying on the photos slot with each screen's photo frozen as it was at
   * `frozenAtMs`, moved on `photoStep` photos by ] and [.
   */
  | { kind: "hold-photo"; frozenAtMs: number; photoStep: number };

/**
 * Preset stepping on a bpm view with presets. `step` counts ] (+1) and [ (-1)
 * presses since bpm mode started, so a view moves by however much it changes;
 * `held` stops the view moving on to new presets by itself.
 */
export interface PresetControl {
  step: number;
  held: boolean;
}

const INITIAL_PRESET_CONTROL: PresetControl = { step: 0, held: false };

export interface ControlState {
  menuOpen: boolean;
  mode: DisplayMode;
  /**
   * The rotation counts slots from here: at `anchorMs` it's on item
   * `anchorIndex` of its list, then moves on one per interval. The standard
   * anchor (0, 0) is plain wall-clock slots; starting the cam-only rotation
   * anchors it at the press so it begins with the first cam. Bpm mode's
   * cycling counts its views the same way.
   */
  anchorMs: number;
  anchorIndex: number;
}

/** What the state machine needs to know about the page's rotation. */
export interface ControlConfig {
  intervalMs: number;
  /** Ids of every slot, in rotation order. */
  slotIds: string[];
  /** Ids of the surf cam slots, in rotation order. */
  camSlotIds: string[];
  shortcuts: Shortcut[];
  /** How many bpm views there are. */
  bpmViewCount: number;
  /** The bpm views whose presets ] and [ step (indexes). */
  bpmPresetViews: number[];
}

export const INITIAL_CONTROL_STATE: ControlState = {
  menuOpen: false,
  mode: { kind: "rotation" },
  anchorMs: 0,
  anchorIndex: 0,
};

// a failed long-poll (agent restarting, or not on the kiosk) waits this long before retrying
const CONTROL_RETRY_DELAY_MS = 5_000;

// in bpm mode the digit keys pick a view
const BPM_VIEW_KEY_PATTERN = /^[1-9]$/;

/**
 * Remainder that's never negative, for wrapping list indexes.
 * @param n - Dividend.
 * @param size - List length.
 * @returns n mod size, in [0, size).
 */
export function wrapIndex(n: number, size: number): number {
  return ((n % size) + size) % size;
}

/**
 * Which item of the current rotation list is showing at a moment (unwrapped).
 * @param state - Control state, for its anchor.
 * @param intervalMs - Rotation interval.
 * @param atMs - The moment, epoch ms.
 * @returns The item number; wrap it with the list length.
 */
export function rotationIndexAt(state: ControlState, intervalMs: number, atMs: number): number {
  return state.anchorIndex + Math.floor((atMs - state.anchorMs) / intervalMs);
}

/**
 * Moves one step forward or back from the current item and holds there: the
 * next photo while a photo is held, the next preset on a bpm view with
 * presets, the next view elsewhere in bpm mode, otherwise the next slot of all
 * of them (from the held slot, or from wherever the rotation was). Backspace
 * resumes the rotation.
 * @param state - Current state.
 * @param delta - +1 for ], -1 for [.
 * @param atMs - When the key was pressed.
 * @param config - Rotation config.
 * @returns The new state.
 */
function step(state: ControlState, delta: number, atMs: number, config: ControlConfig): ControlState {
  const mode = state.mode;
  if (mode.kind === "hold-photo") {
    return { ...state, mode: { ...mode, photoStep: mode.photoStep + delta } };
  }
  if (mode.kind === "bpm") return stepBpm(state, mode.preset, delta, atMs, config);
  const currentSlotId = mode.kind === "hold-slot" ? mode.slotId : rotationSlotIdAt(state, config, atMs);
  const index = config.slotIds.indexOf(currentSlotId);
  const slotId = config.slotIds[wrapIndex(index + delta, config.slotIds.length)];
  return { ...state, mode: { kind: "hold-slot", slotId } };
}

/**
 * Which slot a rotation (the standard one or the cam-only one) is on at a moment.
 * @param state - Control state in a rotation mode.
 * @param config - Rotation config.
 * @param atMs - The moment, epoch ms.
 * @returns The slot id.
 */
function rotationSlotIdAt(state: ControlState, config: ControlConfig, atMs: number): string {
  const ids = state.mode.kind === "cam-rotation" ? config.camSlotIds : config.slotIds;
  return ids[wrapIndex(rotationIndexAt(state, config.intervalMs, atMs), ids.length)];
}

/**
 * Which bpm view is up at a moment.
 * @param state - Control state (any mode; outside bpm mode it's where cycling would be).
 * @param config - Rotation config.
 * @param atMs - The moment, epoch ms.
 * @returns The view's index.
 */
export function bpmViewAt(state: ControlState, config: ControlConfig, atMs: number): number {
  const mode = state.mode;
  if (mode.kind === "bpm" && mode.heldView !== null) return mode.heldView;
  return wrapIndex(rotationIndexAt(state, config.intervalMs, atMs), config.bpmViewCount);
}

/**
 * ] or [ in bpm mode: the next/previous preset on a view with presets
 * (holding that view and preset), else the next/previous view (held).
 * @param state - State before the press (in bpm mode).
 * @param preset - Its preset stepping.
 * @param delta - +1 for ], -1 for [.
 * @param atMs - When the key was pressed.
 * @param config - Rotation config.
 * @returns State after it.
 */
function stepBpm(state: ControlState, preset: PresetControl, delta: number, atMs: number, config: ControlConfig): ControlState {
  const view = bpmViewAt(state, config, atMs);
  if (config.bpmPresetViews.includes(view)) {
    return { ...state, mode: { kind: "bpm", heldView: view, preset: { step: preset.step + delta, held: true } } };
  }
  const heldView = wrapIndex(view + delta, config.bpmViewCount);
  return { ...state, mode: { kind: "bpm", heldView, preset } };
}

/**
 * Bpm mode cycling through its views, starting from one view at a moment.
 * Presets move on by themselves again; the preset step count carries over, so
 * a view with presets doesn't jump.
 * @param fromView - The view to start on.
 * @param atMs - When cycling starts (it gets a full interval).
 * @param presetStep - The preset step count so far (0 entering bpm mode).
 * @returns The new state, menu closed.
 */
function cycleBpmViews(fromView: number, atMs: number, presetStep: number): ControlState {
  const preset = { step: presetStep, held: false };
  return { ...INITIAL_CONTROL_STATE, mode: { kind: "bpm", heldView: null, preset }, anchorMs: atMs, anchorIndex: fromView };
}

/**
 * One step back: closes the menu, else lets a held preset move on again, else
 * goes from a held bpm view back to cycling, else back to the standard display.
 * @param state - State before the press.
 * @param atMs - When the key was pressed.
 * @returns State after it.
 */
function goBack(state: ControlState, atMs: number): ControlState {
  if (state.menuOpen) return { ...state, menuOpen: false };
  const mode = state.mode;
  if (mode.kind !== "bpm") return INITIAL_CONTROL_STATE;
  if (mode.preset.held) return { ...state, mode: { ...mode, preset: { ...mode.preset, held: false } } };
  if (mode.heldView !== null) return cycleBpmViews(mode.heldView, atMs, mode.preset.step);
  return INITIAL_CONTROL_STATE;
}

/**
 * A digit pressed in bpm mode: holds that view, if there is one. A held
 * preset stays held only if the new view has presets.
 * @param state - State before the press (in bpm mode).
 * @param key - The digit.
 * @param config - Rotation config.
 * @returns State after it (unchanged for a digit past the last view).
 */
function holdBpmView(state: ControlState, key: string, config: ControlConfig): ControlState {
  const view = Number(key) - 1;
  if (view >= config.bpmViewCount || state.mode.kind !== "bpm") return state;
  const presetHeld = state.mode.preset.held && config.bpmPresetViews.includes(view);
  const preset = { ...state.mode.preset, held: presetHeld };
  return { ...state, menuOpen: false, mode: { kind: "bpm", heldView: view, preset } };
}

/**
 * The state a shortcut puts the screens in. The bpm shortcut starts bpm mode
 * cycling from the first view, or, already in bpm mode, from the view that's up.
 * @param action - The shortcut's action.
 * @param atMs - When the key was pressed.
 * @param state - State before the press.
 * @param config - Rotation config.
 * @returns The new state, menu closed.
 */
function startShortcut(action: ShortcutAction, atMs: number, state: ControlState, config: ControlConfig): ControlState {
  if (action.kind === "bpm") {
    if (state.mode.kind !== "bpm") return cycleBpmViews(0, atMs, INITIAL_PRESET_CONTROL.step);
    return cycleBpmViews(bpmViewAt(state, config, atMs), atMs, state.mode.preset.step);
  }
  if (action.kind === "hold-photo") {
    return { ...INITIAL_CONTROL_STATE, mode: { kind: "hold-photo", frozenAtMs: atMs, photoStep: 0 } };
  }
  if (action.kind === "hold-slot") {
    return { ...INITIAL_CONTROL_STATE, mode: { kind: "hold-slot", slotId: action.slotId } };
  }
  return { ...INITIAL_CONTROL_STATE, mode: { kind: "cam-rotation" }, anchorMs: atMs, anchorIndex: 0 };
}

/**
 * Applies one key press. Unknown keys change nothing.
 * @param state - State before the press.
 * @param event - The press.
 * @param config - Rotation config.
 * @returns State after the press.
 */
export function applyControlEvent(state: ControlState, event: ControlEvent, config: ControlConfig): ControlState {
  const { key, at_ms: atMs } = event;
  if (key === "tab") return { ...state, menuOpen: !state.menuOpen };
  if (key === "escape") return INITIAL_CONTROL_STATE;
  if (key === "backspace") return goBack(state, atMs);
  if (key === "next" || key === "prev") {
    return { ...step(state, key === "next" ? 1 : -1, atMs, config), menuOpen: false };
  }
  if (state.mode.kind === "bpm" && BPM_VIEW_KEY_PATTERN.test(key)) return holdBpmView(state, key, config);
  const shortcut = config.shortcuts.find((candidate) => candidate.key === key);
  return shortcut ? startShortcut(shortcut.action, atMs, state, config) : state;
}

/**
 * Replays a whole log from the standard display.
 * @param log - The agent's log, or null when it can't be reached.
 * @param config - Rotation config.
 * @returns The state the screens should be in.
 */
export function replayControl(log: ControlLog | null, config: ControlConfig): ControlState {
  if (!log) return INITIAL_CONTROL_STATE;
  return log.events.reduce((state, event) => applyControlEvent(state, event, config), INITIAL_CONTROL_STATE);
}

/**
 * Waits, unless aborted first.
 * @param ms - How long.
 * @param signal - Abort signal that cuts the wait short.
 * @returns Resolves when the time is up or the signal fires.
 */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/**
 * Keeps the agent's control log current by long-polling it: each request
 * waits at the agent until a key is pressed (or a timeout passes), so a press
 * shows up on screen straight away.
 * @returns The latest log, or null until the agent answers (always null away from the kiosk).
 */
export function useControlLog(): ControlLog | null {
  const [log, setLog] = useState<ControlLog | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    const poll = async () => {
      let version = -1;
      while (!abort.signal.aborted) {
        try {
          const res = await fetch(`${SURFCAM_AGENT_URL}/control/log?after=${version}`, { signal: abort.signal });
          if (!res.ok) throw new Error(`agent returned ${res.status}`);
          const latest: ControlLog = await res.json();
          version = latest.version;
          setLog(latest);
        } catch {
          await delay(CONTROL_RETRY_DELAY_MS, abort.signal);
        }
      }
    };
    poll();
    return () => abort.abort();
  }, []);

  return log;
}
