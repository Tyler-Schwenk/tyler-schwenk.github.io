"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  bpmPresetsShown,
  bpmViewAt,
  isShortcutActive,
  presetActionKey,
  topViewKey,
  type BpmMode,
  type ControlState,
} from "@/app/display/kioskControl";
import {
  BPM_VIEW_INFO,
  CONTROL_CONFIG,
  SHORTCUTS,
  backAction,
  describeDisplay,
  stepTarget,
} from "@/app/display/displayConfig";
import { errorMessage } from "./adminApi";
import { formatElapsed } from "./format";
import PresetBrowser from "./PresetBrowser";
import { Badge, Button, Card, FlashMessage, Muted, Segmented, useFlash } from "./ui";
import { useDisplayControl, type DisplayControl } from "./useDisplayControl";

/**
 * The display kiosk's remote: what the screens are showing right now, and
 * buttons that press the kiosk's keys for you (see website/docs/ADMIN.md and
 * website/docs/DISPLAY.md for what each key does).
 *
 * It has two layouts. Normally it's the rotation's controls: step, back, and
 * a button per shortcut. Buttons that jump somewhere send escape first, so
 * they mean the same thing whatever mode the screens are in (a digit means
 * something else in bpm mode), and the step and back buttons are labelled
 * with what they'd do right now. In bpm mode it turns into a dj remote: the
 * presets up top with big previous/next buttons, then what each screen shows,
 * so everything needed mid-set is a thumb's reach away.
 */

// how often the "now showing" line and countdown refresh
const CLOCK_TICK_MS = 1_000;
const MS_PER_S = 1_000;

// key names the kiosk understands (see CONTROL_KEYS in pi/services/surfcam-agent/kiosk_control.py)
const KEY = {
  escape: "escape",
  back: "backspace",
  next: "next",
  prev: "prev",
  bpm: "b",
  beatEarlier: "beat-earlier",
  beatLater: "beat-later",
} as const;

type PresetMode = "auto" | "hold";
const PRESET_MODE_OPTIONS: { value: PresetMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "hold", label: "Hold" },
];

/** Sends keys to the kiosk, in order, as one press. */
type Press = (keys: string[]) => void;

/**
 * The current time, updated every CLOCK_TICK_MS.
 * @returns Epoch ms.
 */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * A titled group of controls.
 * @param props.title - Group name.
 * @param props.note - Smaller text beside the title.
 * @param props.children - The controls.
 */
function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-baseline justify-between gap-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
        {note && <span className="font-normal normal-case tracking-normal text-slate-500">{note}</span>}
      </h2>
      {children}
    </section>
  );
}

/**
 * A big remote button, outlined orange while it's what the screens are doing.
 * @param props.label - What it does.
 * @param props.detail - A smaller line under it (the kiosk key, or what's on now).
 * @param props.active - Highlight it.
 * @param props.disabled - Grey it out.
 * @param props.onPress - Called on tap.
 */
function RemoteButton({
  label,
  detail,
  active = false,
  disabled,
  onPress,
}: {
  label: string;
  detail?: string;
  active?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-pressed={active}
      className={`flex min-h-14 flex-col items-start justify-center rounded-xl border px-4 py-2 text-left transition active:scale-[0.97] disabled:opacity-40 ${
        active
          ? "border-orange-500 bg-orange-500/15 text-white"
          : "border-slate-800 bg-slate-900 text-slate-100 hover:border-slate-600"
      }`}
    >
      <span className="text-sm font-semibold first-letter:uppercase">{label}</span>
      {detail && <span className="text-[11px] text-slate-500">{detail}</span>}
    </button>
  );
}

/**
 * Whether the kiosk is up, and when it last checked in.
 * @param props.control - From useDisplayControl.
 * @param props.nowMs - Current time on the backend's clock.
 */
function KioskStatus({ control, nowMs }: { control: DisplayControl; nowMs: number }) {
  const seen = control.kioskSeenMs === null ? "never checked in" : `checked in ${formatElapsed(nowMs - control.kioskSeenMs)} ago`;
  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <span className={`h-2 w-2 rounded-full ${control.online ? "bg-green-400" : "bg-slate-600"}`} />
      <span className={control.online ? "text-green-300" : "text-slate-300"}>{control.online ? "Online" : "Offline"}</span>
      <span>- {seen}</span>
    </div>
  );
}

/**
 * The "now showing" card.
 * @param props.control - From useDisplayControl.
 * @param props.nowMs - Current time on the backend's clock.
 */
function NowShowing({ control, nowMs }: { control: DisplayControl; nowMs: number }) {
  const description = control.state ? describeDisplay(control.state, nowMs) : null;
  return (
    <Card className="p-4">
      <KioskStatus control={control} nowMs={nowMs} />
      <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Now showing</div>
      <div className="mt-1 text-2xl font-bold text-white">{description?.showing ?? "Unknown"}</div>
      <div className="mt-1 text-sm text-slate-400">
        {description ? description.mode : "the kiosk hasn't reported in since the backend started"}
        {description?.nextChangeInMs != null && ` - next in ${Math.ceil(description.nextChangeInMs / MS_PER_S)} s`}
      </div>
    </Card>
  );
}

/**
 * The dj remote's preset deck: what's playing, big previous/next, and auto/hold.
 * The buttons work whichever screen milkdrop is on, and put it on the bottom
 * screen if it's on neither.
 * @param props.state - Control state (in bpm mode).
 * @param props.mode - Its bpm mode.
 * @param props.nowMs - Current time on the backend's clock.
 * @param props.playing - The preset playing, if milkdrop is on screen.
 * @param props.disabled - Grey the buttons out.
 * @param props.press - Sends keys.
 */
function PresetDeck({
  state,
  mode,
  nowMs,
  playing,
  disabled,
  press,
}: {
  state: ControlState;
  mode: BpmMode;
  nowMs: number;
  playing: string | null;
  disabled: boolean;
  press: Press;
}) {
  const shown = bpmPresetsShown(state, CONTROL_CONFIG, nowMs);
  return (
    <Section title="Milkdrop presets">
      <Card className="p-3">
        <div className="text-xs text-slate-500">{shown ? "Playing" : "Milkdrop isn't on either screen"}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 break-words text-sm font-semibold text-white">
          {shown ? (playing ?? "starting...") : "Any button here puts it on the bottom screen"}
          {shown && mode.preset.held && <Badge tone="orange">held</Badge>}
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-2">
        <Button className="min-h-16 text-base" disabled={disabled} onClick={() => press([presetActionKey("prev")])}>
          Previous preset
        </Button>
        <Button variant="primary" className="min-h-16 text-base" disabled={disabled} onClick={() => press([presetActionKey("next")])}>
          Next preset
        </Button>
      </div>
      <Segmented
        options={PRESET_MODE_OPTIONS}
        value={mode.preset.held ? "hold" : "auto"}
        onChange={(value) => press([presetActionKey(value)])}
        disabled={disabled}
      />
      <p className="text-xs text-slate-500">
        Auto moves on every 32 beats; previous / next hold the one they land on. The presets are shuffled, so next is
        always a surprise.
      </p>
    </Section>
  );
}

/**
 * What the bottom screen (the monitor) shows: cycling through the views, or one held.
 * @param props.state - Control state (in bpm mode).
 * @param props.mode - Its bpm mode.
 * @param props.nowMs - Current time on the backend's clock.
 * @param props.disabled - Grey the buttons out.
 * @param props.press - Sends keys.
 */
function BottomScreenPicker({
  state,
  mode,
  nowMs,
  disabled,
  press,
}: {
  state: ControlState;
  mode: BpmMode;
  nowMs: number;
  disabled: boolean;
  press: Press;
}) {
  const cycling = mode.heldView === null;
  const onNow = BPM_VIEW_INFO[bpmViewAt(state, CONTROL_CONFIG, nowMs)]?.label;
  return (
    <Section title="Bottom screen" note="the monitor">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <RemoteButton
          label="cycle all"
          detail={cycling && onNow ? `on ${onNow} now` : "key b"}
          active={cycling}
          disabled={disabled}
          onPress={() => press([KEY.bpm])}
        />
        {BPM_VIEW_INFO.map((view, i) => (
          <RemoteButton
            key={view.id}
            label={view.label}
            detail={`key ${i + 1}`}
            active={mode.heldView === i}
            disabled={disabled}
            onPress={() => press([String(i + 1)])}
          />
        ))}
      </div>
    </Section>
  );
}

/**
 * What the top screen (the laptop) shows: the bottom screen's view, one of its
 * own, or the tempo readout.
 * @param props.mode - Bpm mode.
 * @param props.disabled - Grey the buttons out.
 * @param props.press - Sends keys.
 */
function TopScreenPicker({ mode, disabled, press }: { mode: BpmMode; disabled: boolean; press: Press }) {
  return (
    <Section title="Top screen" note="the laptop">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <RemoteButton
          label="same as bottom"
          detail="follows it"
          active={mode.top === "same"}
          disabled={disabled}
          onPress={() => press([topViewKey("same")])}
        />
        {BPM_VIEW_INFO.map((view, i) => (
          <RemoteButton
            key={view.id}
            label={view.label}
            active={mode.top === i}
            disabled={disabled}
            onPress={() => press([topViewKey(i)])}
          />
        ))}
        <RemoteButton
          label="tempo"
          detail="the bpm number"
          active={mode.top === "tempo"}
          disabled={disabled}
          onPress={() => press([topViewKey("tempo")])}
        />
      </div>
    </Section>
  );
}

/**
 * Beat calibration, folded away since it's set once rather than played with.
 * @param props.disabled - Grey the buttons out.
 * @param props.press - Sends keys.
 */
function BeatSync({ disabled, press }: { disabled: boolean; press: Press }) {
  return (
    <details className="rounded-xl border border-slate-800 bg-slate-900 p-3">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-400">Beat sync</summary>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button disabled={disabled} onClick={() => press([KEY.beatEarlier])}>
          Beat earlier
        </Button>
        <Button disabled={disabled} onClick={() => press([KEY.beatLater])}>
          Beat later
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Nudges where the beat lands on screen by 10 ms (the kiosk&apos;s - and = keys). Put calibration on a screen and
        play a click track to line it up.
      </p>
    </details>
  );
}

/**
 * The dj remote, shown in bpm mode: presets first, then each screen, then the rarely touched stuff.
 * @param props.state - Control state (in bpm mode).
 * @param props.mode - Its bpm mode.
 * @param props.nowMs - Current time on the backend's clock.
 * @param props.playing - The preset playing, if milkdrop is on screen.
 * @param props.disabled - Grey the buttons out.
 * @param props.press - Sends keys.
 */
function DjControls({
  state,
  mode,
  nowMs,
  playing,
  disabled,
  press,
}: {
  state: ControlState;
  mode: BpmMode;
  nowMs: number;
  playing: string | null;
  disabled: boolean;
  press: Press;
}) {
  return (
    <>
      <PresetDeck state={state} mode={mode} nowMs={nowMs} playing={playing} disabled={disabled} press={press} />
      <BottomScreenPicker state={state} mode={mode} nowMs={nowMs} disabled={disabled} press={press} />
      <TopScreenPicker mode={mode} disabled={disabled} press={press} />
      <Section title="Find a preset">
        <PresetBrowser playing={playing} disabled={disabled} press={press} />
      </Section>
      <BeatSync disabled={disabled} press={press} />
      <Button variant="danger" className="min-h-14" disabled={disabled} onClick={() => press([KEY.escape])}>
        Leave BPM (mic off, back to the rotation)
      </Button>
    </>
  );
}

/**
 * Previous / next (step one and hold there), back (undo one step) and the
 * standard rotation, each labelled for what it does in the current mode.
 * @param props.state - Control state, or null before the kiosk's first report.
 * @param props.nowMs - Current time on the backend's clock.
 * @param props.disabled - Grey the buttons out.
 * @param props.press - Sends keys.
 */
function StepControls({
  state,
  nowMs,
  disabled,
  press,
}: {
  state: ControlState | null;
  nowMs: number;
  disabled: boolean;
  press: Press;
}) {
  const target = state ? stepTarget(state, nowMs) : "screen";
  const back = state ? backAction(state) : null;
  return (
    <Section title="Move">
      <div className="grid grid-cols-2 gap-2">
        <Button className="min-h-14" disabled={disabled} onClick={() => press([KEY.prev])}>
          Previous {target}
        </Button>
        <Button className="min-h-14" disabled={disabled} onClick={() => press([KEY.next])}>
          Next {target}
        </Button>
      </div>
      {back && <RemoteButton label={back} detail="key backspace" disabled={disabled} onPress={() => press([KEY.back])} />}
      <RemoteButton
        label="standard rotation"
        detail="key esc"
        active={state?.mode.kind === "rotation"}
        disabled={disabled}
        onPress={() => press([KEY.escape])}
      />
      <p className="text-xs text-slate-500">
        Previous / next move one {target} and hold it there. {back ? `"${back}" undoes the last hold.` : ""}
      </p>
    </Section>
  );
}

/**
 * The remote outside bpm mode: a big way into bpm mode, the rotation's
 * controls, the shortcuts, and the preset list (which also leads into bpm mode).
 * @param props.state - Control state, or null before the kiosk's first report.
 * @param props.nowMs - Current time on the backend's clock.
 * @param props.disabled - Grey the buttons out.
 * @param props.press - Sends keys.
 */
function RotationControls({
  state,
  nowMs,
  disabled,
  press,
}: {
  state: ControlState | null;
  nowMs: number;
  disabled: boolean;
  press: Press;
}) {
  const mode = state?.mode;
  // bpm mode has its own big button above
  const shortcuts = SHORTCUTS.filter((shortcut) => shortcut.action.kind !== "bpm");
  return (
    <>
      <div className="flex flex-col gap-2">
        <Button variant="primary" className="min-h-16 text-base" disabled={disabled} onClick={() => press([KEY.escape, KEY.bpm])}>
          Start BPM visuals
        </Button>
        <p className="text-xs text-slate-500">
          Turns the kiosk&apos;s mic on and puts music visuals on both screens, with dj controls here.
        </p>
      </div>
      <StepControls state={state} nowMs={nowMs} disabled={disabled} press={press} />
      <Section title="Show">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {shortcuts.map((shortcut) => (
            <RemoteButton
              key={shortcut.key}
              label={shortcut.label}
              detail={`key ${shortcut.key}`}
              active={mode ? isShortcutActive(shortcut, mode) : false}
              disabled={disabled}
              onPress={() => press([KEY.escape, shortcut.key])}
            />
          ))}
        </div>
      </Section>
      <Section title="Milkdrop presets">
        <p className="text-xs text-slate-500">Picking a preset starts BPM visuals on it.</p>
        <PresetBrowser playing={null} disabled={disabled} press={press} />
      </Section>
    </>
  );
}

/**
 * The display tab: kiosk status and the remote.
 */
export default function DisplayTab() {
  const control = useDisplayControl();
  const nowMs = useNow() + control.clockOffsetMs;
  const [flash, showFlash] = useFlash();
  // presses queue up rather than greying the buttons out while one's in flight, so tapping
  // next a few times mid-set just works, and they still reach the kiosk in the order tapped
  const pressQueue = useRef<Promise<void>>(Promise.resolve());
  const { sendKeys } = control;

  const press = useCallback(
    (keys: string[]) => {
      pressQueue.current = pressQueue.current
        .then(() => sendKeys(keys))
        .catch((err: unknown) => showFlash("error", errorMessage(err)));
    },
    [sendKeys, showFlash]
  );

  if (!control.loaded) {
    return <Muted>{control.error ?? "Checking on the kiosk..."}</Muted>;
  }

  const state = control.state;
  const disabled = !control.online;
  const bpmMode = state?.mode.kind === "bpm" ? state.mode : null;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <NowShowing control={control} nowMs={nowMs} />
        <FlashMessage flash={flash} />
      </div>
      {control.error && <p className="text-sm text-red-300">{control.error}</p>}
      {!control.online && (
        <p className="text-sm text-slate-400">
          The kiosk&apos;s surfcam agent isn&apos;t checking in, so presses would be dropped. Is displaytop on and
          online? See pi/docs/services/display-kiosk.md, &quot;Remote control&quot;.
        </p>
      )}

      {state && bpmMode ? (
        <DjControls
          state={state}
          mode={bpmMode}
          nowMs={nowMs}
          playing={control.playingPreset}
          disabled={disabled}
          press={press}
        />
      ) : (
        <RotationControls state={state} nowMs={nowMs} disabled={disabled} press={press} />
      )}
    </div>
  );
}
