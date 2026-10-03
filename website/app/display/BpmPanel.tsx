"use client";

import type { ComponentType } from "react";
import BpmCalibration from "./BpmCalibration";
import BpmDjView from "./BpmDjView";
import BpmHalo from "./BpmHalo";
import BpmReadout from "./BpmReadout";
import BpmVisualizer from "./BpmVisualizer";
import { useBpmStream, type BpmStream } from "./bpmAgent";

/** One of the bpm mode's views on the primary screen. */
export interface BpmView {
  /** Name in the menu and on the readout. */
  label: string;
  component: ComponentType<{ stream: BpmStream }>;
  /** Show the calibration keys on the readout while it's up. */
  calibration?: boolean;
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
 */
export default function BpmPanel({ side, viewIndex }: { side: "primary" | "secondary"; viewIndex: number }) {
  const stream = useBpmStream();
  const view = BPM_VIEWS[viewIndex] ?? BPM_VIEWS[0];

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
  return <View stream={stream} />;
}
