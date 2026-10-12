"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CONTROL_CONFIG } from "../display/displayConfig";
import { DisplayEnvironmentProvider, type DisplayEnvironment } from "../display/displayEnvironment";
import { useRotationClockSlot, type ScreenSide } from "../display/displayRotation";
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
 * synthesised song). The keys work from the on-page deck or the keyboard.
 */
export default function ConsolePage() {
  const [state, setState] = useState<ControlState>(INITIAL_CONTROL_STATE);
  const [focus, setFocus] = useState<ScreenSide | null>(null);
  const [engine] = useState(() => new SimBpmEngine(HOUSE_LOOP));
  const muted = useSyncExternalStore(engine.subscribeMuted, engine.isMuted, () => false);
  const clockSlot = useRotationClockSlot(state);

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
        className="flex min-h-dvh flex-col bg-slate-950 lg:h-dvh lg:flex-row"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {/* on phones the scene sticks to the top, so the screens stay in view while the keys scroll under them */}
        <div className="sticky top-0 z-10 aspect-square max-h-[60dvh] w-full bg-slate-950 lg:static lg:aspect-auto lg:h-full lg:max-h-none lg:flex-1 lg:bg-transparent">
          <ConsoleScene state={state} clockSlot={clockSlot} focus={focus} onFocus={setFocus} />
        </div>
        <aside className="flex flex-col gap-5 border-slate-800 p-4 lg:w-96 lg:overflow-y-auto lg:border-l lg:bg-slate-950/70">
          <div className="flex items-baseline justify-between">
            <h1 className="pixel-font text-xl text-[#F8D030] drop-shadow-[2px_2px_0_rgba(0,0,0,1)]">CONSOLE</h1>
            <Link href="/" className="font-mono text-sm text-slate-400 transition-colors hover:text-white">
              &larr; main menu
            </Link>
          </div>
          <ConsoleControls state={state} onKey={pressKey} muted={muted} onToggleMute={() => engine.setMuted(!muted)} />
        </aside>
      </div>
    </DisplayEnvironmentProvider>
  );
}
