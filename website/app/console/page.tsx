"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import { CONTROL_CONFIG } from "../display/displayConfig";
import { DisplayEnvironmentProvider, type DisplayEnvironment } from "../display/displayEnvironment";
import { pickSlots, useRotationClockSlot, type ScreenSide } from "../display/displayRotation";
import { INITIAL_CONTROL_STATE, applyControlEvent, type ControlState } from "../display/kioskControl";
import ConsoleScene from "./ConsoleScene";
import ConsolePanel, { BEAT_EARLIER_KEY, BEAT_LATER_KEY } from "./ConsolePanel";
import { CONSOLE_SECTIONS, holdSlotState, sectionForMode, type SectionId } from "./consoleSections";
import SimSurfCamPanel from "./SimSurfCamPanel";
import { SimBpmEngine } from "./simBpmEngine";
import { HOUSE_LOOP } from "./simSong";
import { fetchSimulatedSurfConditions } from "./simSurf";

// the physical keys a visitor can press, mapped to the kiosk's key names (tab is left
// alone so it still moves focus around the page)
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
 * A dismissable banner telling touch-screen visitors the console's nicer on a computer.
 * It's css-gated on a coarse pointer, so it never renders on desktop and there's no
 * hydration flash from sniffing the device in js.
 * @param props.onDismiss - Called when the x is tapped.
 * @returns The banner, hidden unless the main pointer is a finger.
 */
function MobileNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="hidden shrink-0 items-center justify-between gap-3 border-b border-amber-700/60 bg-amber-950/90 py-1 pl-20 pr-4 font-mono text-sm text-amber-100 pointer-coarse:flex">
      <span>This is better viewed on a computer, sorry!</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss this notice"
        className="flex min-h-11 min-w-11 items-center justify-center text-lg text-amber-200 hover:text-white"
      >
        &times;
      </button>
    </div>
  );
}

/**
 * The console page: my corner console with its two screens running a
 * simulation of the display kiosk (website/app/display): the same rotation,
 * panels and keys, with stand-ins for what only exists on displaytop (the
 * surf cam video, the agents' surf conditions, the room mic, which gets a
 * synthesised song). The scene keeps its full size on the left (on top on
 * phones), and an info and control panel takes the rest: an overview running
 * the standard rotation, and a tab for each thing the screens show. The
 * kiosk's keys work from the keyboard too.
 */
export default function ConsolePage() {
  const [state, setState] = useState<ControlState>(INITIAL_CONTROL_STATE);
  const [focus, setFocus] = useState<ScreenSide | null>(null);
  const [mobileNoticeDismissed, setMobileNoticeDismissed] = useState(false);
  const [engine] = useState(() => new SimBpmEngine(HOUSE_LOOP));
  const muted = useSyncExternalStore(engine.subscribeMuted, engine.isMuted, () => false);
  const clockSlot = useRotationClockSlot(state);
  const currentSlot = clockSlot === null ? null : pickSlots(state, clockSlot).current;
  const currentSlotId = currentSlot?.id ?? null;
  const liveCamId = currentSlot?.camId ?? null;

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

  // picking the tab that's already up leaves it be, so it doesn't restart a rotation or the bpm cycling
  const selectSection = useCallback((id: SectionId) => {
    const section = CONSOLE_SECTIONS.find((candidate) => candidate.id === id);
    if (section) setState((current) => (sectionForMode(current.mode) === id ? current : section.enter(Date.now())));
  }, []);

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
        <Navigation />
        {/* the scene's square, so on desktop it gets the full height (as wide as that, leaving the panel
            at least 22rem) and the panel takes whatever width is left; on phones it sits on top */}
        <div className="flex shrink-0 flex-col lg:h-full lg:w-[min(100dvh,calc(100vw-22rem))]">
          {!mobileNoticeDismissed && <MobileNotice onDismiss={() => setMobileNoticeDismissed(true)} />}
          <div className="relative aspect-square max-h-[55dvh] w-full lg:aspect-auto lg:max-h-none lg:min-h-0 lg:flex-1">
            <ConsoleScene state={state} clockSlot={clockSlot} focus={focus} onFocus={setFocus} />
          </div>
        </div>
        <aside className="min-h-0 flex-1 overflow-y-auto border-t border-slate-800 bg-slate-950/95 lg:border-l lg:border-t-0">
          <div className="mx-auto flex max-w-2xl flex-col gap-5 p-4 lg:p-6">
            <div className="flex items-center justify-between gap-3">
              <h1 className="font-mono text-lg uppercase tracking-widest text-slate-200">Console</h1>
              <Link href="/" className="flex min-h-11 items-center font-mono text-sm text-slate-400 transition-colors hover:text-white">
                &larr; main menu
              </Link>
            </div>
            <ConsolePanel
              state={state}
              currentSlotId={currentSlotId}
              liveCamId={liveCamId}
              muted={muted}
              onSelectSection={selectSection}
              onKey={pressKey}
              onHoldSlot={(slotId) => setState(holdSlotState(slotId))}
              onToggleMute={() => engine.setMuted(!muted)}
            />
          </div>
        </aside>
      </div>
    </DisplayEnvironmentProvider>
  );
}
