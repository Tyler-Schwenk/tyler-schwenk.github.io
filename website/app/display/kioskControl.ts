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
 *
 * In bpm mode the top screen shows the same view as the bottom one by default.
 * The admin page's remote can give it a view of its own or the tempo readout
 * instead (`top-same`, `top-tempo`, `top-<n>`), and work the presets whichever
 * screen they're on (`preset-next`, `preset-prev`, `preset-hold`,
 * `preset-auto`). `preset-<n>` jumps to preset n of the sorted preset list
 * (milkdropPresets.ts) and holds it. A preset key with no preset view on
 * either screen puts the bottom one on the first view with presets, entering
 * bpm mode if it isn't up. None of these have a physical key.
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
  /** Bpm mode (never part of the main rotation), see BpmMode. */
  | BpmMode
  /**
   * Staying on the photos slot with each screen's photo frozen as it was at
   * `frozenAtMs`, moved on `photoStep` photos by ] and [.
   */
  | { kind: "hold-photo"; frozenAtMs: number; photoStep: number };

/**
 * Preset stepping on a bpm view with presets. `step` counts ] (+1) and [ (-1)
 * presses since bpm mode started, so a view moves by however much it changes;
 * `held` stops the view moving on to new presets by itself. `jump` is the
 * last preset jumped to (an index into the sorted preset list), and `jumps`
 * counts jumps, so jumping to the same preset twice still registers.
 */
export interface PresetControl {
  step: number;
  held: boolean;
  jump: number | null;
  jumps: number;
}

/** Preset control before any preset key. */
export const INITIAL_PRESET_CONTROL: PresetControl = { step: 0, held: false, jump: null, jumps: 0 };

/**
 * What the top screen shows in bpm mode: whatever the bottom one shows
 * ("same"), the tempo readout ("tempo"), or a view of its own (its index).
 */
export type BpmTopView = "same" | "tempo" | number;

/** The top screen entering bpm mode: visuals on both screens. */
export const DEFAULT_BPM_TOP: BpmTopView = "same";

/**
 * Bpm mode: the bottom screen stays on view `heldView`, or cycles through the
 * views from the anchor when it's null. `top` is what the top screen shows,
 * and `preset` is what the preset keys have done.
 */
export interface BpmMode {
  kind: "bpm";
  heldView: number | null;
  top: BpmTopView;
  preset: PresetControl;
}

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
const LONG_POLL_RETRY_DELAY_MS = 5_000;

// in bpm mode the digit keys pick a view
const BPM_VIEW_KEY_PATTERN = /^[1-9]$/;

// the remote's jump to a preset: preset-<index into the sorted preset list>
const PRESET_KEY_PREFIX = "preset-";
const PRESET_KEY_PATTERN = /^preset-(\d{1,4})$/;

// the remote's preset buttons, and what each does to the preset control
const PRESET_ACTION_KEY_PATTERN = /^preset-(next|prev|hold|auto)$/;
type PresetAction = "next" | "prev" | "hold" | "auto";
const PRESET_ACTIONS: Record<PresetAction, (preset: PresetControl) => PresetControl> = {
  next: (preset) => ({ ...preset, step: preset.step + 1, held: true }),
  prev: (preset) => ({ ...preset, step: preset.step - 1, held: true }),
  hold: (preset) => ({ ...preset, held: true }),
  auto: (preset) => ({ ...preset, held: false }),
};

// the remote's pick for the top screen in bpm mode: top-same, top-tempo, or top-<view, 1 = the first>
const TOP_KEY_PREFIX = "top-";
const TOP_KEY_PATTERN = /^top-(same|tempo|[1-9])$/;

/**
 * The key that jumps to a preset.
 * @param index - Index into the sorted preset list (milkdropPresets.ts).
 * @returns Like "preset-42".
 */
export function presetKey(index: number): string {
  return `${PRESET_KEY_PREFIX}${index}`;
}

/**
 * The remote's key for a preset button.
 * @param action - next/prev (step and hold), hold (stay on this one), auto (move on by itself).
 * @returns Like "preset-next".
 */
export function presetActionKey(action: PresetAction): string {
  return `${PRESET_KEY_PREFIX}${action}`;
}

/**
 * The remote's key that puts the top screen on something in bpm mode.
 * @param top - What it should show.
 * @returns Like "top-same" or "top-5" (view index 4).
 */
export function topViewKey(top: BpmTopView): string {
  return `${TOP_KEY_PREFIX}${typeof top === "number" ? top + 1 : top}`;
}

/**
 * Which view the top screen shows in bpm mode.
 * @param top - The top screen's setting.
 * @param bottomView - The view on the bottom screen.
 * @returns Its view index, or null for the tempo readout.
 */
export function bpmTopViewIndex(top: BpmTopView, bottomView: number): number | null {
  if (top === "tempo") return null;
  return top === "same" ? bottomView : top;
}

/**
 * Whether either screen shows a view with presets.
 * @param top - The top screen's setting.
 * @param bottomView - The view on the bottom screen.
 * @param config - Rotation config.
 * @returns True if a preset view is up somewhere.
 */
function presetViewShown(top: BpmTopView, bottomView: number, config: ControlConfig): boolean {
  const topView = bpmTopViewIndex(top, bottomView);
  return config.bpmPresetViews.includes(bottomView) || (topView !== null && config.bpmPresetViews.includes(topView));
}

/**
 * Whether presets are on screen right now, for the remote.
 * @param state - Control state.
 * @param config - Rotation config.
 * @param atMs - The moment, epoch ms.
 * @returns True in bpm mode with a preset view on either screen.
 */
export function bpmPresetsShown(state: ControlState, config: ControlConfig, atMs: number): boolean {
  if (state.mode.kind !== "bpm") return false;
  return presetViewShown(state.mode.top, bpmViewAt(state, config, atMs), config);
}

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
  if (mode.kind === "bpm") return stepBpm(state, mode, delta, atMs, config);
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
export function rotationSlotIdAt(state: ControlState, config: ControlConfig, atMs: number): string {
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
 * ] or [ in bpm mode: the next/previous preset when the bottom screen's view
 * has presets (holding that view and preset), else the next/previous view (held).
 * @param state - State before the press (in bpm mode).
 * @param mode - Its bpm mode.
 * @param delta - +1 for ], -1 for [.
 * @param atMs - When the key was pressed.
 * @param config - Rotation config.
 * @returns State after it.
 */
function stepBpm(state: ControlState, mode: BpmMode, delta: number, atMs: number, config: ControlConfig): ControlState {
  const view = bpmViewAt(state, config, atMs);
  if (config.bpmPresetViews.includes(view)) {
    const preset = { ...mode.preset, step: mode.preset.step + delta, held: true };
    return { ...state, mode: { ...mode, heldView: view, preset } };
  }
  const heldView = wrapIndex(view + delta, config.bpmViewCount);
  return { ...state, mode: { ...mode, heldView } };
}

/**
 * Bpm mode cycling through its views, starting from one view at a moment.
 * Presets move on by themselves again; the preset steps and jumps carry over,
 * so a view with presets doesn't jump.
 * @param fromView - The view to start on.
 * @param atMs - When cycling starts (it gets a full interval).
 * @param presets - Preset control so far (INITIAL_PRESET_CONTROL entering bpm mode).
 * @param top - What the top screen shows (DEFAULT_BPM_TOP entering bpm mode).
 * @returns The new state, menu closed.
 */
function cycleBpmViews(fromView: number, atMs: number, presets: PresetControl, top: BpmTopView): ControlState {
  const preset = { ...presets, held: false };
  return { ...INITIAL_CONTROL_STATE, mode: { kind: "bpm", heldView: null, top, preset }, anchorMs: atMs, anchorIndex: fromView };
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
  if (mode.heldView !== null) return cycleBpmViews(mode.heldView, atMs, mode.preset, mode.top);
  return INITIAL_CONTROL_STATE;
}

/**
 * A digit pressed in bpm mode: holds that view on the bottom screen, if there
 * is one. A held preset stays held only if a view with presets is still up.
 * @param state - State before the press (in bpm mode).
 * @param key - The digit.
 * @param config - Rotation config.
 * @returns State after it (unchanged for a digit past the last view).
 */
function holdBpmView(state: ControlState, key: string, config: ControlConfig): ControlState {
  const view = Number(key) - 1;
  const mode = state.mode;
  if (view >= config.bpmViewCount || mode.kind !== "bpm") return state;
  const presetHeld = mode.preset.held && presetViewShown(mode.top, view, config);
  const preset = { ...mode.preset, held: presetHeld };
  return { ...state, menuOpen: false, mode: { ...mode, heldView: view, preset } };
}

/**
 * The remote's top-screen pick in bpm mode (outside it, nothing happens).
 * @param state - State before the press.
 * @param choice - What followed "top-": same, tempo, or a view's digit.
 * @param config - Rotation config.
 * @returns State after it (unchanged for a digit past the last view).
 */
function setBpmTop(state: ControlState, choice: string, config: ControlConfig): ControlState {
  const mode = state.mode;
  if (mode.kind !== "bpm") return state;
  const top: BpmTopView = choice === "same" || choice === "tempo" ? choice : Number(choice) - 1;
  if (typeof top === "number" && top >= config.bpmViewCount) return state;
  return { ...state, menuOpen: false, mode: { ...mode, top } };
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
    if (state.mode.kind !== "bpm") return cycleBpmViews(0, atMs, INITIAL_PRESET_CONTROL, DEFAULT_BPM_TOP);
    return cycleBpmViews(bpmViewAt(state, config, atMs), atMs, state.mode.preset, state.mode.top);
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
 * Which view the bottom screen should hold while a preset is held: its own
 * view if that has presets, else wherever it is if the top screen has them,
 * else the first view with presets (so the held preset is on screen somewhere).
 * @param mode - Bpm mode before the press.
 * @param bottomView - The bottom screen's view now.
 * @param config - Rotation config.
 * @returns The view to hold, or null to keep cycling.
 */
function presetHoldView(mode: BpmMode, bottomView: number, config: ControlConfig): number | null {
  if (config.bpmPresetViews.includes(bottomView)) return bottomView;
  if (presetViewShown(mode.top, bottomView, config)) return mode.heldView;
  return config.bpmPresetViews[0];
}

/**
 * Changes the preset control (a jump, a step, hold or auto). If that holds a
 * preset, a view with presets is kept on screen, entering bpm mode on the
 * first one if it isn't up.
 * @param state - State before the press.
 * @param change - What the press does to the preset control.
 * @param atMs - When the key was pressed.
 * @param config - Rotation config.
 * @returns State after it (unchanged if no view has presets).
 */
function changePresets(
  state: ControlState,
  change: (preset: PresetControl) => PresetControl,
  atMs: number,
  config: ControlConfig
): ControlState {
  const firstPresetView = config.bpmPresetViews[0];
  if (firstPresetView === undefined) return state;
  const mode = state.mode;
  if (mode.kind !== "bpm") {
    const preset = change(INITIAL_PRESET_CONTROL);
    return { ...INITIAL_CONTROL_STATE, anchorMs: atMs, mode: { kind: "bpm", heldView: firstPresetView, top: DEFAULT_BPM_TOP, preset } };
  }
  const preset = change(mode.preset);
  const heldView = preset.held ? presetHoldView(mode, bpmViewAt(state, config, atMs), config) : mode.heldView;
  return { ...state, menuOpen: false, mode: { ...mode, heldView, preset } };
}

/**
 * Whether a shortcut is what's active right now, to highlight it (the kiosk's
 * menu, the admin page's remote).
 * @param shortcut - The shortcut.
 * @param mode - Current display mode.
 * @returns True if the shortcut's action is the current mode.
 */
export function isShortcutActive(shortcut: Shortcut, mode: DisplayMode): boolean {
  const action = shortcut.action;
  if (action.kind === "hold-slot") return mode.kind === "hold-slot" && mode.slotId === action.slotId;
  return action.kind === mode.kind;
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
  const presetJump = PRESET_KEY_PATTERN.exec(key);
  if (presetJump) {
    const jump = Number(presetJump[1]);
    return changePresets(state, (preset) => ({ ...preset, held: true, jump, jumps: preset.jumps + 1 }), atMs, config);
  }
  const presetAction = PRESET_ACTION_KEY_PATTERN.exec(key);
  if (presetAction) return changePresets(state, PRESET_ACTIONS[presetAction[1] as PresetAction], atMs, config);
  const topChoice = TOP_KEY_PATTERN.exec(key);
  if (topChoice) return setBpmTop(state, topChoice[1], config);
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
 * Tells the surfcam agent which milkdrop preset is playing, so the admin
 * page's remote can show it (the agent passes it up with the key log). Each
 * screen reports its own, since both can run milkdrop at once.
 * @param name - The preset's name, or null when milkdrop closes.
 * @param screen - Which screen it's playing on.
 */
export function reportPlayingPreset(name: string | null, screen: "primary" | "secondary"): void {
  fetch(`${SURFCAM_AGENT_URL}/control/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preset: name, screen }),
  }).catch(() => {
    // away from the kiosk there's no agent, and on the kiosk a missed report only means
    // the remote shows the previous name until the next preset; nothing to recover
  });
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
 * Keeps something versioned on the surfcam agent current by long-polling it:
 * each request waits at the agent until the version changes (or a timeout
 * passes), so a change shows up on screen straight away.
 * @param path - Agent path that takes `?after=<version>`, like `/control/log`.
 * @returns The latest response, or null until the agent answers (always null away from the kiosk).
 */
export function useAgentLongPoll<T extends { version: number }>(path: string): T | null {
  const [latest, setLatest] = useState<T | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    const poll = async () => {
      let version = -1;
      while (!abort.signal.aborted) {
        try {
          const res = await fetch(`${SURFCAM_AGENT_URL}${path}?after=${version}`, { signal: abort.signal });
          if (!res.ok) throw new Error(`agent returned ${res.status}`);
          const body: T = await res.json();
          version = body.version;
          setLatest(body);
        } catch {
          await delay(LONG_POLL_RETRY_DELAY_MS, abort.signal);
        }
      }
    };
    poll();
    return () => abort.abort();
  }, [path]);

  return latest;
}

/**
 * Keeps the agent's control log current, so a key press shows up on screen straight away.
 * @returns The latest log, or null until the agent answers (always null away from the kiosk).
 */
export function useControlLog(): ControlLog | null {
  return useAgentLongPoll<ControlLog>("/control/log");
}
