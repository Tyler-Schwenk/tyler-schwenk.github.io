"use client";

import { useEffect, useState, type ReactNode } from "react";
import { isShortcutActive, type ControlState } from "@/app/display/kioskControl";
import { BPM_VIEW_INFO, SHORTCUTS, backAction, describeDisplay, stepTarget } from "@/app/display/displayConfig";
import { errorMessage } from "./adminApi";
import { formatElapsed } from "./format";
import PresetBrowser from "./PresetBrowser";
import { Badge, Button, Card, FlashMessage, Muted, useFlash } from "./ui";
import { useDisplayControl, type DisplayControl } from "./useDisplayControl";

/**
 * The display kiosk's remote: what the screens are showing right now, and
 * buttons that press the kiosk's keys for you (see website/docs/ADMIN.md and
 * website/docs/DISPLAY.md for what each key does). Buttons that jump
 * somewhere send escape first, so they mean the same thing whatever mode the
 * screens are in (a digit means something else in bpm mode). The step and
 * back buttons are labelled with what they'd do right now (next photo, next
 * preset, resume rotation...), since the same key does different things in
 * different modes.
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
 * @param props.children - The controls.
 */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

/**
 * A big remote button, outlined orange while it's what the screens are doing.
 * @param props.label - What it does.
 * @param props.hint - The kiosk key it matches, shown small.
 * @param props.active - Highlight it.
 * @param props.disabled - Grey it out.
 * @param props.onPress - Called on tap.
 */
function RemoteButton({
  label,
  hint,
  active = false,
  disabled,
  onPress,
}: {
  label: string;
  hint?: string;
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
      {hint && <span className="text-[11px] text-slate-500">key {hint}</span>}
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
 * Bpm mode's own controls: its views, cycling, and beat calibration.
 * @param props.state - Control state (in bpm mode).
 * @param props.disabled - Grey the buttons out.
 * @param props.press - Sends keys.
 */
function BpmControls({
  state,
  disabled,
  press,
}: {
  state: ControlState;
  disabled: boolean;
  press: (keys: string[]) => void;
}) {
  const heldView = state.mode.kind === "bpm" ? state.mode.heldView : null;
  return (
    <Section title="BPM views">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {BPM_VIEW_INFO.map((view, i) => (
          <RemoteButton
            key={view.id}
            label={view.label}
            hint={String(i + 1)}
            active={heldView === i}
            disabled={disabled}
            onPress={() => press([String(i + 1)])}
          />
        ))}
        <RemoteButton
          label="cycle views"
          hint="b"
          active={heldView === null}
          disabled={disabled}
          onPress={() => press([KEY.bpm])}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button disabled={disabled} onClick={() => press([KEY.beatEarlier])}>
          Beat earlier
        </Button>
        <Button disabled={disabled} onClick={() => press([KEY.beatLater])}>
          Beat later
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        Beat earlier/later nudge the calibration by 10 ms (the kiosk&apos;s - and = keys); watch the calibration view.
      </p>
    </Section>
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
  press: (keys: string[]) => void;
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
      {back && <RemoteButton label={back} hint="backspace" disabled={disabled} onPress={() => press([KEY.back])} />}
      <RemoteButton
        label="standard rotation"
        hint="esc"
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
 * Milkdrop's presets: what's playing, and a searchable list to jump to any of them.
 * @param props.state - Control state, or null before the kiosk's first report.
 * @param props.playing - The preset playing, if milkdrop is on screen.
 * @param props.disabled - Grey the buttons out.
 * @param props.press - Sends keys.
 */
function PresetControls({
  state,
  playing,
  disabled,
  press,
}: {
  state: ControlState | null;
  playing: string | null;
  disabled: boolean;
  press: (keys: string[]) => void;
}) {
  const held = state?.mode.kind === "bpm" && state.mode.preset.held;
  return (
    <Section title="Milkdrop presets">
      {playing ? (
        <Card className="p-3">
          <div className="text-xs text-slate-500">Playing</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 break-words text-sm font-semibold text-white">
            {playing}
            {held && <Badge tone="orange">held</Badge>}
          </div>
        </Card>
      ) : (
        <p className="text-xs text-slate-500">Milkdrop isn&apos;t on screen. Picking a preset switches to it (BPM mode, mic on).</p>
      )}
      <PresetBrowser playing={playing} disabled={disabled} press={press} />
    </Section>
  );
}

/**
 * The display tab: kiosk status and the remote.
 */
export default function DisplayTab() {
  const control = useDisplayControl();
  const nowMs = useNow() + control.clockOffsetMs;
  const [flash, showFlash] = useFlash();
  const [sending, setSending] = useState(false);

  const press = async (keys: string[]) => {
    setSending(true);
    try {
      await control.sendKeys(keys);
    } catch (err) {
      showFlash("error", errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (!control.loaded) {
    return <Muted>{control.error ?? "Checking on the kiosk..."}</Muted>;
  }

  const state = control.state;
  const disabled = sending || !control.online;
  const mode = state?.mode;
  // in bpm mode the presets matter most, so they move up under the step buttons
  const inBpm = mode?.kind === "bpm";
  const presets = <PresetControls state={state} playing={control.playingPreset} disabled={disabled} press={press} />;
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

      <StepControls state={state} nowMs={nowMs} disabled={disabled} press={press} />
      {inBpm && presets}

      {state && inBpm && <BpmControls state={state} disabled={disabled} press={press} />}

      <Section title="Show">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SHORTCUTS.map((shortcut) => (
            <RemoteButton
              key={shortcut.key}
              label={shortcut.label}
              hint={shortcut.key}
              active={mode ? isShortcutActive(shortcut, mode) : false}
              disabled={disabled}
              onPress={() => press([KEY.escape, shortcut.key])}
            />
          ))}
        </div>
      </Section>

      {!inBpm && presets}
    </div>
  );
}
