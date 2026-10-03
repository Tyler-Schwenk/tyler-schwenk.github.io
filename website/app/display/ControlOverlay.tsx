"use client";

import type { ControlState, DisplayMode, Shortcut } from "./kioskControl";

/**
 * Keyboard-control overlay, drawn over whatever panel is showing: the
 * shortcut menu (while tab has it open) and a small indicator in the top
 * right whenever the screens aren't on the standard rotation. In bpm mode the
 * menu lists the bpm views and bpm mode's keys instead.
 * @param props.state - Current control state.
 * @param props.shortcuts - The shortcuts, in menu order.
 * @param props.bpmViewLabels - The bpm views' names, in order (digit 1 = the first).
 */

/** One row of the menu. */
interface MenuEntry {
  keyName: string;
  label: string;
  active?: boolean;
}

// the navigation keys, listed beside the shortcuts
const NAVIGATION_KEYS: MenuEntry[] = [
  { keyName: "]", label: "next" },
  { keyName: "[", label: "previous" },
  { keyName: "backspace", label: "back" },
  { keyName: "esc", label: "standard display" },
  { keyName: "tab", label: "close this menu" },
];

// bpm mode's keys, listed beside its views
const BPM_NAVIGATION_KEYS: MenuEntry[] = [
  { keyName: "]", label: "next view" },
  { keyName: "[", label: "previous view" },
  { keyName: "b", label: "cycle the views" },
  { keyName: "- / =", label: "beat earlier / later" },
  { keyName: "backspace", label: "back" },
  { keyName: "esc", label: "standard display" },
  { keyName: "tab", label: "close this menu" },
];

/**
 * What the indicator says for a mode, if anything.
 * @param mode - Current display mode.
 * @returns Indicator text, or null on the standard rotation.
 */
function indicatorLabel(mode: DisplayMode): string | null {
  if (mode.kind === "hold-photo" || mode.kind === "hold-slot") return "held";
  if (mode.kind === "cam-rotation") return "surf cams only";
  if (mode.kind === "bpm") return mode.heldView === null ? "bpm" : "bpm, held";
  return null;
}

/**
 * Whether a shortcut is what's active right now, to highlight it in the menu.
 * @param shortcut - Menu entry.
 * @param mode - Current display mode.
 * @returns True if the shortcut's action is the current mode.
 */
function isActive(shortcut: Shortcut, mode: DisplayMode): boolean {
  const action = shortcut.action;
  if (action.kind === "hold-slot") return mode.kind === "hold-slot" && mode.slotId === action.slotId;
  return action.kind === mode.kind;
}

/**
 * One row of the menu: the key in a box, then what it does.
 * @param props.keyName - Key label.
 * @param props.label - What it does.
 * @param props.active - Highlight the row.
 */
function MenuRow({ keyName, label, active = false }: { keyName: string; label: string; active?: boolean }) {
  return (
    <div className={`flex items-center gap-6 ${active ? "text-white" : "text-gray-300"}`}>
      <span
        className={`min-w-16 px-3 py-1 rounded-lg border text-center ${
          active ? "border-white bg-white text-black" : "border-gray-500"
        }`}
      >
        {keyName}
      </span>
      <span>{label}</span>
    </div>
  );
}

/**
 * What the menu lists: the bpm views in bpm mode, else the shortcuts.
 * @param mode - Current display mode.
 * @param shortcuts - The shortcuts.
 * @param bpmViewLabels - The bpm views' names.
 * @returns Its title, entries, and navigation keys.
 */
function menuFor(
  mode: DisplayMode,
  shortcuts: Shortcut[],
  bpmViewLabels: string[]
): { title: string; entries: MenuEntry[]; navigation: MenuEntry[] } {
  if (mode.kind === "bpm") {
    const entries = bpmViewLabels.map((label, i) => ({ keyName: String(i + 1), label, active: mode.heldView === i }));
    return { title: "BPM views", entries, navigation: BPM_NAVIGATION_KEYS };
  }
  const entries = shortcuts.map((shortcut) => ({
    keyName: shortcut.key,
    label: shortcut.label,
    active: isActive(shortcut, mode),
  }));
  return { title: "Shortcuts", entries, navigation: NAVIGATION_KEYS };
}

export default function ControlOverlay({
  state,
  shortcuts,
  bpmViewLabels,
}: {
  state: ControlState;
  shortcuts: Shortcut[];
  bpmViewLabels: string[];
}) {
  const indicator = indicatorLabel(state.mode);
  const menu = menuFor(state.mode, shortcuts, bpmViewLabels);
  return (
    <>
      {indicator && (
        <div className="fixed top-6 right-8 z-50 px-5 py-3 rounded-xl bg-black/70 font-mono text-right">
          <div className="text-3xl font-bold text-white uppercase tracking-widest">{indicator}</div>
          <div className="text-xl text-gray-400">backspace to return</div>
        </div>
      )}
      {state.menuOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 font-mono">
          <div className="px-16 py-12 rounded-3xl bg-gray-900/95 border border-gray-700 text-4xl">
            <div className="text-3xl text-gray-400 uppercase tracking-widest mb-8">{menu.title}</div>
            <div className="grid grid-cols-2 gap-x-20 gap-y-5">
              <div className="flex flex-col gap-5">
                {menu.entries.map((entry) => (
                  <MenuRow key={entry.keyName} keyName={entry.keyName} label={entry.label} active={entry.active} />
                ))}
              </div>
              <div className="flex flex-col gap-5">
                {menu.navigation.map((entry) => (
                  <MenuRow key={entry.keyName} keyName={entry.keyName} label={entry.label} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
