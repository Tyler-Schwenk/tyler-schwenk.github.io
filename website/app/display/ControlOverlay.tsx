"use client";

import type { ControlState, DisplayMode, Shortcut } from "./kioskControl";

/**
 * Keyboard-control overlay, drawn over whatever panel is showing: the
 * shortcut menu (while tab has it open) and a small indicator in the top
 * right whenever the screens aren't on the standard rotation.
 * @param props.state - Current control state.
 * @param props.shortcuts - The digit shortcuts, in menu order.
 */

// the navigation keys, listed under the shortcuts
const NAVIGATION_KEYS = [
  { key: "]", label: "next" },
  { key: "[", label: "previous" },
  { key: "backspace", label: "back" },
  { key: "esc", label: "standard display" },
  { key: "tab", label: "close this menu" },
];

/**
 * What the indicator says for a mode, if anything.
 * @param mode - Current display mode.
 * @returns Indicator text, or null on the standard rotation.
 */
function indicatorLabel(mode: DisplayMode): string | null {
  if (mode.kind === "hold-photo" || mode.kind === "hold-slot") return "held";
  if (mode.kind === "cam-rotation") return "surf cams only";
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

export default function ControlOverlay({ state, shortcuts }: { state: ControlState; shortcuts: Shortcut[] }) {
  const indicator = indicatorLabel(state.mode);
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
            <div className="text-3xl text-gray-400 uppercase tracking-widest mb-8">Shortcuts</div>
            <div className="grid grid-cols-2 gap-x-20 gap-y-5">
              <div className="flex flex-col gap-5">
                {shortcuts.map((shortcut) => (
                  <MenuRow
                    key={shortcut.key}
                    keyName={shortcut.key}
                    label={shortcut.label}
                    active={isActive(shortcut, state.mode)}
                  />
                ))}
              </div>
              <div className="flex flex-col gap-5">
                {NAVIGATION_KEYS.map(({ key, label }) => (
                  <MenuRow key={key} keyName={key} label={label} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
