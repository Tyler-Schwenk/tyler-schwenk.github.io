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
 * of bpm mode, and b resumes cycling from the view that's up.
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
   * or cycling through the views from the anchor when it's null.
   */
  | { kind: "bpm"; heldView: number | null }
  /**
   * Staying on the photos slot with each screen's photo frozen as it was at
   * `frozenAtMs`, moved on `photoStep` photos by ] and [.
   */
  | { kind: "hold-photo"; frozenAtMs: number; photoStep: number };

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
 * next photo while a photo is held, the next view in bpm mode, otherwise the
 * next slot of all of them (from the held slot, or from wherever the rotation
 * was). Backspace resumes the rotation.
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
  if (mode.kind === "bpm") {
    const heldView = wrapIndex(bpmViewAt(state, config, atMs) + delta, config.bpmViewCount);
    return { ...state, mode: { kind: "bpm", heldView } };
  }
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
 * Bpm mode cycling through its views, starting from one view at a moment.
 * @param fromView - The view to start on.
 * @param atMs - When cycling starts (it gets a full interval).
 * @returns The new state, menu closed.
 */
function cycleBpmViews(fromView: number, atMs: number): ControlState {
  return { ...INITIAL_CONTROL_STATE, mode: { kind: "bpm", heldView: null }, anchorMs: atMs, anchorIndex: fromView };
}

/**
 * One step back: closes the menu, else goes from a held bpm view back to
 * cycling, else back to the standard display.
 * @param state - State before the press.
 * @param atMs - When the key was pressed.
 * @returns State after it.
 */
function goBack(state: ControlState, atMs: number): ControlState {
  if (state.menuOpen) return { ...state, menuOpen: false };
  const mode = state.mode;
  if (mode.kind === "bpm" && mode.heldView !== null) return cycleBpmViews(mode.heldView, atMs);
  return INITIAL_CONTROL_STATE;
}

/**
 * A digit pressed in bpm mode: holds that view, if there is one.
 * @param state - State before the press (in bpm mode).
 * @param key - The digit.
 * @param config - Rotation config.
 * @returns State after it (unchanged for a digit past the last view).
 */
function holdBpmView(state: ControlState, key: string, config: ControlConfig): ControlState {
  const view = Number(key) - 1;
  if (view >= config.bpmViewCount) return state;
  return { ...state, menuOpen: false, mode: { kind: "bpm", heldView: view } };
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
    const fromView = state.mode.kind === "bpm" ? bpmViewAt(state, config, atMs) : 0;
    return cycleBpmViews(fromView, atMs);
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
