"use client";

import type { ComponentType } from "react";
import BpmCalibration from "./BpmCalibration";
import BpmDjView from "./BpmDjView";
import BpmHalo from "./BpmHalo";
import BpmMilkdrop from "./BpmMilkdrop";
import BpmReadout from "./BpmReadout";
import BpmVisualizer from "./BpmVisualizer";
import { useBpmStream, type BpmStream } from "./bpmAgent";
import { useDisplayEnvironment } from "./displayEnvironment";
import { BPM_VIEW_INFO, type BpmViewInfo } from "./displayConfig";
import { bpmTopViewIndex, type BpmTopView, type PresetControl } from "./kioskControl";

/** What every bpm view gets. Views without presets just ignore `presets` (and most ignore `side`). */
export interface BpmViewProps {
  stream: BpmStream;
  presets: PresetControl;
  side: "primary" | "secondary";
}

/** One of the bpm mode's views: its info plus the component that draws it. */
export interface BpmView extends BpmViewInfo {
  component: ComponentType<BpmViewProps>;
}

// every view id in BPM_VIEW_INFO needs a component here (the Record type makes sure of it)
const BPM_VIEW_COMPONENTS: Record<BpmViewInfo["id"], ComponentType<BpmViewProps>> = {
  bars: BpmVisualizer,
  calibration: BpmCalibration,
  halo: BpmHalo,
  dj: BpmDjView,
  milkdrop: BpmMilkdrop,
};

/**
 * The bpm mode's views, in cycling order (BPM_VIEW_INFO in displayConfig.ts,
 * which is where to add one). While in bpm mode digit n holds view n (1 = the first).
 */
export const BPM_VIEWS: BpmView[] = BPM_VIEW_INFO.map((info) => ({
  ...info,
  component: BPM_VIEW_COMPONENTS[info.id],
}));

/**
 * Display panel for bpm mode, shown only from its key (never in the main
 * rotation). Holding the agent's stream open is what keeps the mic recording,
 * so it records exactly while this is on screen. The primary screen shows the
 * current view; the other screen shows what `top` says: the same view, a view
 * of its own, or the tempo and the bottom view's name. It's the same component
 * whichever view is up, so switching views keeps the stream (and the
 * tracker's lock) going.
 * @param props.side - Which screen this is.
 * @param props.bottomView - Index into BPM_VIEWS of the view on the primary screen.
 * @param props.top - What the secondary screen shows.
 * @param props.presets - Preset stepping, for a view with presets.
 */
export default function BpmPanel({
  side,
  bottomView,
  top,
  presets,
}: {
  side: "primary" | "secondary";
  bottomView: number;
  top: BpmTopView;
  presets: PresetControl;
}) {
  const bottom = BPM_VIEWS[bottomView] ?? BPM_VIEWS[0];
  const shownIndex = side === "primary" ? bottomView : bpmTopViewIndex(top, bottomView);
  // null: the tempo readout
  const view = shownIndex === null ? null : (BPM_VIEWS[shownIndex] ?? BPM_VIEWS[0]);
  // only a screen drawing a view that needs the waveform asks for it
  const { connectBpm } = useDisplayEnvironment();
  const stream = useBpmStream(connectBpm, { waveform: view?.needsWaveform ?? false });

  if (stream.error) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center font-mono px-16">
        <div className="text-4xl text-gray-400 text-center">{stream.error}</div>
      </div>
    );
  }
  if (!view) {
    return <BpmReadout stream={stream} viewLabel={bottom.label} calibrating={bottom.calibration ?? false} />;
  }
  const View = view.component;
  return <View stream={stream} presets={presets} side={side} />;
}
