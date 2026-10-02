"use client";

import BpmCalibration from "./BpmCalibration";
import BpmReadout from "./BpmReadout";
import BpmVisualizer from "./BpmVisualizer";
import { useBpmStream } from "./bpmAgent";

/**
 * Display panel for the bpm visualizer, shown only from its key (never in the
 * rotation). Holding the agent's stream open is what keeps the mic recording,
 * so it records exactly while this is on screen. The primary screen shows the
 * visualizer (or the calibration view while calibrating), the other screen
 * the tempo. It renders as the same component across the visualizer and
 * calibration, so switching keeps the stream (and the tracker's lock) going.
 * @param props.side - Which screen this is.
 * @param props.calibrating - Show the calibration view instead of the visualizer.
 */
export default function BpmPanel({ side, calibrating }: { side: "primary" | "secondary"; calibrating: boolean }) {
  const stream = useBpmStream();

  if (stream.error) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center font-mono px-16">
        <div className="text-4xl text-gray-400 text-center">{stream.error}</div>
      </div>
    );
  }
  if (side === "secondary") return <BpmReadout stream={stream} calibrating={calibrating} />;
  return calibrating ? <BpmCalibration stream={stream} /> : <BpmVisualizer stream={stream} />;
}
