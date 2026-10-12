"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BPM_VIEW_INFO, SHORTCUTS, describeDisplay } from "../display/displayConfig";
import { isShortcutActive, type ControlState } from "../display/kioskControl";
import type { SurfCamId } from "../display/surfCams";
import { LIVE_CAM_PAGES } from "./simSurf";

// how often the "changes in" countdown ticks
const STATUS_TICK_MS = 1_000;
const MS_PER_S = 1000;

/** The beat calibration keys, which go to the simulated bpm engine rather than the key log. */
export const BEAT_EARLIER_KEY = "-";
export const BEAT_LATER_KEY = "=";

/**
 * One keycap.
 * @param props.keyName - What's printed on the cap.
 * @param props.label - What it does.
 * @param props.active - Highlight it (it's what's on screen).
 * @param props.disabled - Grey it out (does nothing right now).
 * @param props.onPress - Pressed.
 */
function KeyCap({
  keyName,
  label,
  active = false,
  disabled = false,
  onPress,
}: {
  keyName: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const tone = active
    ? "border-cyan-300 bg-cyan-400/15 text-cyan-100"
    : "border-slate-600 bg-slate-800/80 text-slate-200 hover:border-slate-400 hover:bg-slate-700/80";
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className={`flex min-h-11 items-center gap-3 rounded-lg border border-b-4 px-3 py-2 text-left font-mono text-sm transition-colors active:translate-y-px active:border-b-2 disabled:cursor-not-allowed disabled:opacity-35 ${tone}`}
    >
      <span className="min-w-8 shrink-0 rounded bg-black/40 px-1.5 py-0.5 text-center text-xs text-slate-300">{keyName}</span>
      <span className="leading-tight">{label}</span>
    </button>
  );
}

/**
 * A titled group of keys.
 * @param props.title - Heading.
 * @param props.children - The keys.
 */
function KeyGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-slate-500">{title}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">{children}</div>
    </div>
  );
}

/**
 * What's on the screens, in words, with a countdown to the next change.
 * @param props.state - Control state.
 */
function StatusLine({ state }: { state: ControlState }) {
  // null until mounted: the page is statically exported, so the build's clock would be wrong
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    tick();
    const timer = setInterval(tick, STATUS_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  if (nowMs === null) return <div className="h-[5.5rem] rounded-lg border border-slate-700 bg-slate-900/80" />;
  const { showing, mode, nextChangeInMs } = describeDisplay(state, nowMs);
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3 font-mono">
      <div className="text-xs uppercase tracking-widest text-slate-500">now showing</div>
      <div className="text-lg text-white">{showing}</div>
      <div className="text-sm text-slate-400">
        {mode}
        {nextChangeInMs !== null && ` · changes in ${Math.ceil(nextChangeInMs / MS_PER_S)}s`}
      </div>
    </div>
  );
}

/**
 * A link out to the real stream of the cam that's up, since it can't play here.
 * @param props.camId - The cam showing.
 */
function LiveCamLink({ camId }: { camId: SurfCamId }) {
  const { url, site } = LIVE_CAM_PAGES[camId];
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-cyan-700/60 bg-cyan-950/40 px-4 py-2 font-mono text-sm text-cyan-200 transition-colors hover:border-cyan-400 hover:bg-cyan-900/40"
    >
      <span>the cam here is a stand-in: watch it live on {site}</span>
      <span aria-hidden="true">&#8599;</span>
    </a>
  );
}

/**
 * The console's keyboard: the same keys the kiosk's keyboard has, as buttons,
 * plus what's showing and the sound switch for bpm mode. In bpm mode the
 * digits pick bpm views, like on the kiosk.
 * @param props.state - Control state, for labels and highlights.
 * @param props.onKey - Called with the key a button presses.
 * @param props.muted - Whether the simulated song is silenced.
 * @param props.onToggleMute - Flips it.
 * @param props.liveCamId - The surf cam showing, if any, to link to its real stream.
 */
export default function ConsoleControls({
  state,
  onKey,
  muted,
  onToggleMute,
  liveCamId,
}: {
  state: ControlState;
  onKey: (key: string) => void;
  muted: boolean;
  onToggleMute: () => void;
  liveCamId: SurfCamId | null;
}) {
  const inBpm = state.mode.kind === "bpm";
  const heldBpmView = state.mode.kind === "bpm" ? state.mode.heldView : null;

  return (
    <div className="flex flex-col gap-5">
      <StatusLine state={state} />
      {liveCamId && <LiveCamLink camId={liveCamId} />}

      <KeyGroup title="navigate">
        <KeyCap keyName="[" label="previous" onPress={() => onKey("prev")} />
        <KeyCap keyName="]" label="next" onPress={() => onKey("next")} />
        <KeyCap keyName="bksp" label="back" onPress={() => onKey("backspace")} />
        <KeyCap keyName="esc" label="standard display" onPress={() => onKey("escape")} />
        <KeyCap keyName="tab" label={state.menuOpen ? "close menu" : "on-screen menu"} active={state.menuOpen} onPress={() => onKey("tab")} />
      </KeyGroup>

      {inBpm ? (
        <KeyGroup title="bpm views">
          {BPM_VIEW_INFO.map((view, i) => (
            <KeyCap key={view.id} keyName={String(i + 1)} label={view.label} active={heldBpmView === i} onPress={() => onKey(String(i + 1))} />
          ))}
          <KeyCap keyName="b" label="cycle the views" active={heldBpmView === null} onPress={() => onKey("b")} />
          <KeyCap keyName={BEAT_EARLIER_KEY} label="beat earlier" onPress={() => onKey(BEAT_EARLIER_KEY)} />
          <KeyCap keyName={BEAT_LATER_KEY} label="beat later" onPress={() => onKey(BEAT_LATER_KEY)} />
          <KeyCap keyName="snd" label={muted ? "sound off" : "sound on"} active={!muted} onPress={onToggleMute} />
        </KeyGroup>
      ) : (
        <KeyGroup title="shortcuts">
          {SHORTCUTS.map((shortcut) => (
            <KeyCap
              key={shortcut.key}
              keyName={shortcut.key}
              label={shortcut.label}
              active={isShortcutActive(shortcut, state.mode)}
              onPress={() => onKey(shortcut.key)}
            />
          ))}
        </KeyGroup>
      )}

      <p className="font-mono text-xs leading-relaxed text-slate-500">
        a simulation of the two screens on my console: the same rotation, panels and keys as the real kiosk,
        running in your browser. photos and the mallard count are live; the surf cams, their conditions and the
        bpm visualizer&apos;s song are stand-ins. tap a screen to zoom in.
      </p>
    </div>
  );
}
