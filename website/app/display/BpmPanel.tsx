"use client";

import type { ComponentType } from "react";
import BpmCalibration from "./BpmCalibration";
import BpmDjView from "./BpmDjView";
import BpmHalo from "./BpmHalo";
import BpmMilkdrop from "./BpmMilkdrop";
import BpmReadout from "./BpmReadout";
import BpmVisualizer from "./BpmVisualizer";
import { useBpmStream, type BpmStream } from "./bpmAgent";
import type { PresetControl } from "./kioskControl";

/** What every bpm view gets. Views without presets just ignore `presets`. */
export interface BpmViewProps {
  stream: BpmStream;
  presets: PresetControl;
}

/** One of the bpm mode's views on the primary screen. */
export interface BpmView {
  /** Name in the menu and on the readout. */
  label: string;
  component: ComponentType<BpmViewProps>;
  /** Show the calibration keys on the readout while it's up. */
  calibration?: boolean;
  /** Needs the raw waveform in the stream (see useBpmStream). */
  needsWaveform?: boolean;
  /** Has presets that ] and [ step through while it's up (see kioskControl.ts). */
  hasPresets?: boolean;
}

/**
 * The bpm mode's views, in cycling order. While in bpm mode digit n holds
 * view n (1 = the first). Add a view by adding it here.
 */
export const BPM_VIEWS: BpmView[] = [
  { label: "spectrum bars", component: BpmVisualizer },
  { label: "calibration", component: BpmCalibration, calibration: true },
  { label: "halo", component: BpmHalo },
  { label: "dj meters", component: BpmDjView },
  { label: "milkdrop", component: BpmMilkdrop, needsWaveform: true, hasPresets: true },
];

/**
 * Display panel for bpm mode, shown only from its key (never in the main
 * rotation). Holding the agent's stream open is what keeps the mic recording,
 * so it records exactly while this is on screen. The primary screen shows the
 * current view, the other screen the tempo and the view's name. It's the same
 * component whichever view is up, so switching views keeps the stream (and
 * the tracker's lock) going.
 * @param props.side - Which screen this is.
 * @param props.viewIndex - Index into BPM_VIEWS.
 * @param props.presets - Preset stepping, for a view with presets.
 */
export default function BpmPanel({
  side,
  viewIndex,
  presets,
}: {
  side: "primary" | "secondary";
  viewIndex: number;
  presets: PresetControl;
}) {
  const view = BPM_VIEWS[viewIndex] ?? BPM_VIEWS[0];
  // only the screen drawing the view needs the waveform
  const stream = useBpmStream({ waveform: side === "primary" && (view.needsWaveform ?? false) });

  if (stream.error) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center font-mono px-16">
        <div className="text-4xl text-gray-400 text-center">{stream.error}</div>
      </div>
    );
  }
  if (side === "secondary") {
    return <BpmReadout stream={stream} viewLabel={view.label} calibrating={view.calibration ?? false} />;
  }
  const View = view.component;
  return <View stream={stream} presets={presets} />;
}
