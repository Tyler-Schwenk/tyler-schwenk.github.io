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
 * a hold or the cam-only rotation), ] and [ step to the next/previous item,
 * and the digits run the shortcuts (from anywhere, menu open or not).
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
  | { kind: "cam-rotation" };

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
   * anchor (0, 0) is plain wall-clock slots; ] and [ re-anchor at the press so
   * the new item gets a full interval.
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
}

export const INITIAL_CONTROL_STATE: ControlState = {
  menuOpen: false,
  mode: { kind: "rotation" },
  anchorMs: 0,
  anchorIndex: 0,
};

// a failed long-poll (agent restarting, or not on the kiosk) waits this long before retrying
const CONTROL_RETRY_DELAY_MS = 5_000;

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
 * Moves one step forward or back from the current item: the next photo while
 * a photo is held, the next slot while a slot is held (still held), else the
 * next item of the rotation, which then gets a full interval.
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
  if (mode.kind === "hold-slot") {
    const index = config.slotIds.indexOf(mode.slotId);
    const slotId = config.slotIds[wrapIndex(index + delta, config.slotIds.length)];
    return { ...state, mode: { kind: "hold-slot", slotId } };
  }
  return { ...state, anchorMs: atMs, anchorIndex: rotationIndexAt(state, config.intervalMs, atMs) + delta };
}

/**
 * The state a shortcut puts the screens in.
 * @param action - The shortcut's action.
 * @param atMs - When the key was pressed.
 * @returns The new state, menu closed.
 */
function startShortcut(action: ShortcutAction, atMs: number): ControlState {
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
  if (key === "backspace") return state.menuOpen ? { ...state, menuOpen: false } : INITIAL_CONTROL_STATE;
  if (key === "next" || key === "prev") {
    return { ...step(state, key === "next" ? 1 : -1, atMs, config), menuOpen: false };
  }
  const shortcut = config.shortcuts.find((candidate) => candidate.key === key);
  return shortcut ? startShortcut(shortcut.action, atMs) : state;
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
