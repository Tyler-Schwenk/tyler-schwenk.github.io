"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CONTROL_CONFIG } from "../display/displayConfig";
import { DisplayEnvironmentProvider, type DisplayEnvironment } from "../display/displayEnvironment";
import { pickSlots, useRotationClockSlot, type ScreenSide } from "../display/displayRotation";
import { INITIAL_CONTROL_STATE, applyControlEvent, type ControlState } from "../display/kioskControl";
import ConsoleScene from "./ConsoleScene";
import ConsoleControls, { BEAT_EARLIER_KEY, BEAT_LATER_KEY } from "./ConsoleControls";
import SimSurfCamPanel from "./SimSurfCamPanel";
import { SimBpmEngine } from "./simBpmEngine";
import { HOUSE_LOOP } from "./simSong";
import { fetchSimulatedSurfConditions } from "./simSurf";

// the physical keys a visitor can press, mapped to the kiosk's key names (tab is left
// alone so it still moves focus around the page; the deck has a tab button)
const KEYBOARD_KEYS: Record<string, string> = {
  "[": "prev",
  "]": "next",
  Backspace: "backspace",
  Escape: "escape",
  b: "b",
  [BEAT_EARLIER_KEY]: BEAT_EARLIER_KEY,
  [BEAT_LATER_KEY]: BEAT_LATER_KEY,
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [String(i + 1), String(i + 1)])),
};

// key presses aimed at a form field aren't for the console
const TEXT_INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * Whether a key event should drive the console.
 * @param event - The keydown.
 * @returns False for modified keys, repeats and typing into fields.
 */
function isConsoleKeyEvent(event: KeyboardEvent): boolean {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return false;
  const target = event.target as HTMLElement | null;
  return !(target && (TEXT_INPUT_TAGS.has(target.tagName) || target.isContentEditable));
}

/**
 * The console page: my corner console with its two screens running a
 * simulation of the display kiosk (website/app/display): the same rotation,
 * panels and keys, with stand-ins for what only exists on displaytop (the
 * surf cam video, the agents' surf conditions, the room mic, which gets a
 * synthesised song). The scene fills the screen; the keys work from a deck
 * beside it on desktop (below it on phones, behind a toggle), or from the keyboard.
 */
export default function ConsolePage() {
  const [state, setState] = useState<ControlState>(INITIAL_CONTROL_STATE);
  const [focus, setFocus] = useState<ScreenSide | null>(null);
  // on phones the keys start hidden, so the scene opens full screen; on desktop they're always
  // beside it (css, below). the physical keyboard works either way
  const [controlsOpen, setControlsOpen] = useState(false);
  const [engine] = useState(() => new SimBpmEngine(HOUSE_LOOP));
  const muted = useSyncExternalStore(engine.subscribeMuted, engine.isMuted, () => false);
  const clockSlot = useRotationClockSlot(state);
  const liveCamId = clockSlot === null ? null : (pickSlots(state, clockSlot).current.camId ?? null);

  const environment = useMemo<DisplayEnvironment>(
    () => ({
      connectBpm: engine.connect,
      fetchSurfConditions: fetchSimulatedSurfConditions,
      SurfCamPanel: SimSurfCamPanel,
      // there's no remote watching the simulation
      reportPlayingPreset: () => {},
    }),
    [engine]
  );

  useEffect(() => () => engine.dispose(), [engine]);

  // a key does what the kiosk's would: the beat keys move the simulated beat (only in bpm
  // mode, like the agent), everything else goes through the same state machine
  const pressKey = useCallback(
    (key: string) => {
      if (key === BEAT_EARLIER_KEY || key === BEAT_LATER_KEY) {
        if (state.mode.kind === "bpm") engine.nudgeOffset(key === BEAT_EARLIER_KEY ? -1 : 1);
        return;
      }
      setState((current) => applyControlEvent(current, { key, at_ms: Date.now() }, CONTROL_CONFIG));
    },
    [engine, state.mode.kind]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = KEYBOARD_KEYS[event.key];
      if (!key || !isConsoleKeyEvent(event)) return;
      event.preventDefault();
      pressKey(key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pressKey]);

  return (
    <DisplayEnvironmentProvider value={environment}>
      <div
        className="fixed inset-0 flex flex-col bg-slate-950 lg:flex-row"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {/* the scene takes whatever the controls leave, so with them closed it's the whole screen */}
        <div className="relative min-h-0 min-w-0 flex-1">
          <ConsoleScene state={state} clockSlot={clockSlot} focus={focus} onFocus={setFocus} />
          {!controlsOpen && (
            <div className="lg:hidden">
              <Link
                href="/"
                className="absolute left-3 top-3 z-10 flex min-h-11 items-center rounded-lg bg-slate-900/80 px-3 font-mono text-sm text-slate-300 transition-colors hover:text-white"
              >
                &larr; main menu
              </Link>
              <button
                type="button"
                onClick={() => setControlsOpen(true)}
                className="absolute bottom-3 right-3 z-10 min-h-11 rounded-lg border border-slate-600 bg-slate-900/85 px-4 font-mono text-sm text-slate-200 hover:bg-slate-800"
              >
                keys
              </button>
            </div>
          )}
        </div>
        <aside
          className={`${controlsOpen ? "flex" : "hidden"} max-h-[55dvh] shrink-0 flex-col gap-5 overflow-y-auto border-t border-slate-800 bg-slate-950/95 p-4 lg:flex lg:max-h-none lg:w-96 lg:border-l lg:border-t-0`}
        >
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-mono text-lg uppercase tracking-widest text-slate-200">Console</h1>
            <div className="flex items-center gap-2">
              <Link href="/" className="font-mono text-sm text-slate-400 transition-colors hover:text-white">
                &larr; main menu
              </Link>
              <button
                type="button"
                onClick={() => setControlsOpen(false)}
                aria-label="Hide the keys"
                className="min-h-11 rounded-lg border border-slate-700 px-3 font-mono text-sm text-slate-300 hover:bg-slate-800 lg:hidden"
              >
                hide
              </button>
            </div>
          </div>
          <ConsoleControls
            state={state}
            onKey={pressKey}
            muted={muted}
            onToggleMute={() => engine.setMuted(!muted)}
            liveCamId={liveCamId}
          />
        </aside>
      </div>
    </DisplayEnvironmentProvider>
  );
}
