"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  BPM_VIEW_INFO,
  PANEL_ROTATE_INTERVAL_MS,
  PHOTOS_SLOT_ID,
  ROTATION_SLOTS,
  SHORTCUTS,
  describeDisplay,
  stepTarget,
  surfCamSlotId,
} from "../display/displayConfig";
import { topViewKey, type ControlState } from "../display/kioskControl";
import { SURF_CAMS, type SurfCamId } from "../display/surfCams";
import { CONSOLE_SECTIONS, sectionForMode, type SectionId } from "./consoleSections";
import { LIVE_CAM_PAGES } from "./simSurf";

// how often the "changes in" countdown ticks
const STATUS_TICK_MS = 1_000;
const MS_PER_S = 1000;

/** The beat calibration keys, which go to the simulated bpm engine rather than the key log. */
export const BEAT_EARLIER_KEY = "-";
export const BEAT_LATER_KEY = "=";

/**
 * The time now, ticking every second.
 * @returns Epoch ms, or null until mounted (the page is statically exported, so the build's clock would be wrong).
 */
function useNowMs(): number | null {
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    tick();
    const timer = setInterval(tick, STATUS_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return nowMs;
}

/**
 * The kiosk key that runs a shortcut, to show as a hint.
 * @param slotId - The slot the shortcut holds.
 * @returns Its key, or undefined if no shortcut holds it.
 */
function holdShortcutKey(slotId: string): string | undefined {
  return SHORTCUTS.find((shortcut) => shortcut.action.kind === "hold-slot" && shortcut.action.slotId === slotId)?.key;
}

/**
 * One control.
 * @param props.label - What it does.
 * @param props.hint - The keyboard key that does the same, if any.
 * @param props.active - Highlight it (it's what's on screen).
 * @param props.onPress - Pressed.
 */
function ControlButton({
  label,
  hint,
  active = false,
  onPress,
}: {
  label: string;
  hint?: string;
  active?: boolean;
  onPress: () => void;
}) {
  const tone = active
    ? "border-cyan-300 bg-cyan-400/15 text-cyan-100"
    : "border-slate-600 bg-slate-800/80 text-slate-200 hover:border-slate-400 hover:bg-slate-700/80";
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={active}
      className={`flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left font-mono text-sm transition-colors ${tone}`}
    >
      <span className="leading-tight">{label}</span>
      {hint && <kbd className="shrink-0 rounded bg-black/40 px-1.5 py-0.5 text-xs text-slate-400">{hint}</kbd>}
    </button>
  );
}

/**
 * A titled group of controls.
 * @param props.title - Heading.
 * @param props.children - The controls.
 */
function ControlGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 font-mono text-xs uppercase tracking-widest text-slate-500">{title}</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2">{children}</div>
    </div>
  );
}

/**
 * The section tabs.
 * @param props.current - The section that's up.
 * @param props.onSelect - A tab was picked.
 */
function SectionTabs({ current, onSelect }: { current: SectionId; onSelect: (id: SectionId) => void }) {
  return (
    <div role="tablist" aria-label="What the screens show" className="flex flex-wrap gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
      {CONSOLE_SECTIONS.map((section) => (
        <button
          key={section.id}
          type="button"
          role="tab"
          aria-selected={section.id === current}
          onClick={() => onSelect(section.id)}
          className={`min-h-11 flex-1 rounded-md px-3 font-mono text-sm transition-colors ${
            section.id === current ? "bg-cyan-400/15 text-cyan-100" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          {section.label}
        </button>
      ))}
    </div>
  );
}

/**
 * What's on the screens, in words, with a countdown to the next change.
 * @param props.state - Control state.
 * @param props.nowMs - The time now, null until mounted.
 */
function StatusLine({ state, nowMs }: { state: ControlState; nowMs: number | null }) {
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
      <span>watch this cam live on {site}</span>
      <span aria-hidden="true">&#8599;</span>
    </a>
  );
}

/**
 * The overview's controls: the rotation, with what's up highlighted. Picking
 * a slot stays on it.
 * @param props.currentSlotId - The slot showing.
 * @param props.inRotation - Whether the standard rotation is running.
 * @param props.onHoldSlot - Stays on a slot.
 */
function OverviewControls({
  currentSlotId,
  inRotation,
  onHoldSlot,
}: {
  currentSlotId: string | null;
  inRotation: boolean;
  onHoldSlot: (slotId: string) => void;
}) {
  return (
    <ControlGroup title={`the rotation · ${PANEL_ROTATE_INTERVAL_MS / MS_PER_S}s each`}>
      {ROTATION_SLOTS.map((slot) => (
        <ControlButton
          key={slot.id}
          label={slot.label}
          active={inRotation && slot.id === currentSlotId}
          onPress={() => onHoldSlot(slot.id)}
        />
      ))}
    </ControlGroup>
  );
}

/**
 * The photos' controls: let them change, or freeze them and step through.
 * @param props.state - Control state.
 * @param props.onKey - Presses a kiosk key.
 * @param props.onHoldSlot - Stays on a slot.
 */
function PhotoControls({ state, onKey, onHoldSlot }: { state: ControlState; onKey: (key: string) => void; onHoldSlot: (slotId: string) => void }) {
  const frozen = state.mode.kind === "hold-photo";
  return (
    <ControlGroup title="photos">
      <ControlButton label="keep changing" active={!frozen} onPress={() => onHoldSlot(PHOTOS_SLOT_ID)} />
      <ControlButton label="freeze this photo" hint="1" active={frozen} onPress={() => onKey("1")} />
      {frozen && <ControlButton label="previous photo" hint="[" onPress={() => onKey("prev")} />}
      {frozen && <ControlButton label="next photo" hint="]" onPress={() => onKey("next")} />}
    </ControlGroup>
  );
}

/**
 * The surf cams' controls: rotate through them all, or stay on one.
 * @param props.state - Control state.
 * @param props.liveCamId - The cam showing, if any.
 * @param props.onKey - Presses a kiosk key.
 * @param props.onHoldSlot - Stays on a slot.
 */
function SurfControls({
  state,
  liveCamId,
  onKey,
  onHoldSlot,
}: {
  state: ControlState;
  liveCamId: SurfCamId | null;
  onKey: (key: string) => void;
  onHoldSlot: (slotId: string) => void;
}) {
  const mode = state.mode;
  return (
    <>
      <ControlGroup title="cams">
        <ControlButton label="all cams, rotating" hint="3" active={mode.kind === "cam-rotation"} onPress={() => onKey("3")} />
        {SURF_CAMS.map(({ id, label }) => {
          const slotId = surfCamSlotId(id);
          return (
            <ControlButton
              key={id}
              label={label}
              hint={holdShortcutKey(slotId)}
              active={mode.kind === "hold-slot" && mode.slotId === slotId}
              onPress={() => onHoldSlot(slotId)}
            />
          );
        })}
      </ControlGroup>
      {liveCamId && <LiveCamLink camId={liveCamId} />}
    </>
  );
}

/**
 * The bpm visualizer's controls: which view on each screen, stepping, the sound and the beat calibration.
 * @param props.state - Control state.
 * @param props.nowMs - The time now, null until mounted.
 * @param props.muted - Whether the simulated song is silenced.
 * @param props.onKey - Presses a kiosk key.
 * @param props.onToggleMute - Flips the sound.
 */
function BpmControls({
  state,
  nowMs,
  muted,
  onKey,
  onToggleMute,
}: {
  state: ControlState;
  nowMs: number | null;
  muted: boolean;
  onKey: (key: string) => void;
  onToggleMute: () => void;
}) {
  const heldView = state.mode.kind === "bpm" ? state.mode.heldView : null;
  const top = state.mode.kind === "bpm" ? state.mode.top : null;
  const target = nowMs === null ? "view" : stepTarget(state, nowMs);
  return (
    <>
      <ControlGroup title="monitor">
        <ControlButton label="cycle the views" hint="b" active={heldView === null} onPress={() => onKey("b")} />
        {BPM_VIEW_INFO.map((view, i) => (
          <ControlButton key={view.id} label={view.label} hint={String(i + 1)} active={heldView === i} onPress={() => onKey(String(i + 1))} />
        ))}
        <ControlButton label={`previous ${target}`} hint="[" onPress={() => onKey("prev")} />
        <ControlButton label={`next ${target}`} hint="]" onPress={() => onKey("next")} />
      </ControlGroup>
      <ControlGroup title="laptop screen">
        <ControlButton label="same as the monitor" active={top === "same"} onPress={() => onKey(topViewKey("same"))} />
        {BPM_VIEW_INFO.map((view, i) => (
          <ControlButton key={view.id} label={view.label} active={top === i} onPress={() => onKey(topViewKey(i))} />
        ))}
        <ControlButton label="tempo" active={top === "tempo"} onPress={() => onKey(topViewKey("tempo"))} />
      </ControlGroup>
      <ControlGroup title="sound">
        <ControlButton label={muted ? "sound off" : "sound on"} active={!muted} onPress={onToggleMute} />
        <ControlButton label="beat earlier" hint={BEAT_EARLIER_KEY} onPress={() => onKey(BEAT_EARLIER_KEY)} />
        <ControlButton label="beat later" hint={BEAT_LATER_KEY} onPress={() => onKey(BEAT_LATER_KEY)} />
      </ControlGroup>
    </>
  );
}

/**
 * The console's info and control panel: tabs for the overview and each thing
 * the screens show, what's on screen now, that section's controls, and what
 * it is. The tab follows the screens, so keyboard presses keep it in step.
 * @param props.state - Control state.
 * @param props.currentSlotId - The rotation slot showing, null until mounted.
 * @param props.liveCamId - The surf cam showing, if any, to link to its real stream.
 * @param props.muted - Whether the simulated song is silenced.
 * @param props.onSelectSection - A tab was picked.
 * @param props.onKey - Presses a kiosk key.
 * @param props.onHoldSlot - Stays on a rotation slot.
 * @param props.onToggleMute - Flips the sound.
 */
export default function ConsolePanel({
  state,
  currentSlotId,
  liveCamId,
  muted,
  onSelectSection,
  onKey,
  onHoldSlot,
  onToggleMute,
}: {
  state: ControlState;
  currentSlotId: string | null;
  liveCamId: SurfCamId | null;
  muted: boolean;
  onSelectSection: (id: SectionId) => void;
  onKey: (key: string) => void;
  onHoldSlot: (slotId: string) => void;
  onToggleMute: () => void;
}) {
  const nowMs = useNowMs();
  const sectionId = sectionForMode(state.mode);
  const section = CONSOLE_SECTIONS.find((candidate) => candidate.id === sectionId) ?? CONSOLE_SECTIONS[0];

  return (
    <div className="flex flex-col gap-5">
      <SectionTabs current={sectionId} onSelect={onSelectSection} />
      <StatusLine state={state} nowMs={nowMs} />

      {sectionId === "overview" && (
        <OverviewControls currentSlotId={currentSlotId} inRotation={state.mode.kind === "rotation"} onHoldSlot={onHoldSlot} />
      )}
      {sectionId === "photos" && <PhotoControls state={state} onKey={onKey} onHoldSlot={onHoldSlot} />}
      {sectionId === "surf" && <SurfControls state={state} liveCamId={liveCamId} onKey={onKey} onHoldSlot={onHoldSlot} />}
      {sectionId === "bpm" && <BpmControls state={state} nowMs={nowMs} muted={muted} onKey={onKey} onToggleMute={onToggleMute} />}

      <section className="flex flex-col gap-3 border-t border-slate-800 pt-5">
        <h2 className="font-mono text-xs uppercase tracking-widest text-slate-500">
          {sectionId === "overview" ? "how it works" : "about this"}
        </h2>
        {section.description.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-relaxed text-slate-300">
            {paragraph}
          </p>
        ))}
      </section>
    </div>
  );
}
