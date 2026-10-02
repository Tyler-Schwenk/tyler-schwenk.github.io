"use client";

import { useEffect, useRef } from "react";
import { beatPulse, type BpmStream } from "./bpmAgent";

/**
 * The bpm number for the other screen while the visualizer (or calibration)
 * is up: the tempo in big type over a ring that pulses on each beat. While
 * calibrating it also lists the keys.
 * @param props.stream - The bpm agent stream (from BpmPanel).
 * @param props.calibrating - Show the calibration keys.
 */

// the ring's size and brightness on the beat, and at rest
const RING_REST_SCALE = 0.9;
const RING_BEAT_SCALE = 1.08;
const RING_REST_OPACITY = 0.15;
const RING_BEAT_OPACITY = 1;

export default function BpmReadout({ stream, calibrating }: { stream: BpmStream; calibrating: boolean }) {
  const { tempo, tempoRef } = stream;
  const ringRef = useRef<HTMLDivElement>(null);

  // the pulse changes every frame, so it's set on the element directly rather than through state
  useEffect(() => {
    let animationFrameId = 0;
    const tick = () => {
      animationFrameId = requestAnimationFrame(tick);
      const ring = ringRef.current;
      if (!ring) return;
      const pulse = beatPulse(tempoRef.current, Date.now());
      ring.style.transform = `scale(${RING_REST_SCALE + (RING_BEAT_SCALE - RING_REST_SCALE) * pulse})`;
      ring.style.opacity = String(RING_REST_OPACITY + (RING_BEAT_OPACITY - RING_REST_OPACITY) * pulse);
    };
    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [tempoRef]);

  const hasBeat = tempo?.bpm != null;
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center font-mono">
      <div className="relative flex items-center justify-center w-[36rem] h-[36rem]">
        <div ref={ringRef} className="absolute inset-0 rounded-full border-[1.5rem] border-white" />
        <div className="text-center">
          <div className={`text-[11rem] leading-none font-bold tabular-nums ${hasBeat ? "text-white" : "text-gray-700"}`}>
            {tempo?.bpm != null ? tempo.bpm.toFixed(0) : "---"}
          </div>
          <div className="text-4xl text-gray-400 uppercase tracking-widest mt-2">
            {hasBeat ? "bpm" : "listening..."}
          </div>
        </div>
      </div>
      {calibrating && (
        <div className="mt-12 text-3xl text-gray-400 text-center leading-relaxed">
          <div>
            play a click track, then - / = until the flash lands on the click
          </div>
          <div>b back to the visualizer &middot; backspace to leave</div>
        </div>
      )}
    </div>
  );
}
