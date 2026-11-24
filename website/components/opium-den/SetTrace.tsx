"use client";

import { formatDuration } from "@/app/admin/format";
import type { DjSetTrace } from "@/lib/useDjSetTraces";
import { useScrub } from "@/lib/useScrub";
import { RangeOverlay } from "./SliderBar";
import {
  BAR_PITCH_PX,
  percentAt,
  placeholderPeaks,
  resamplePeaks,
  useElementWidth,
  useHoverFraction,
  WaveBars,
} from "./Waveform";

const PERCENT = 100;

/**
 * how wide a set's trace is, as a css length: its share of the longest set's length,
 * times --den-trace-scale (set by the list, so the longest one leaves room for its
 * length label).
 *
 * @param {number} durationS - this set's length.
 * @param {number} longestS - the longest listed set's length.
 * @returns {string} a css calc().
 */
export function traceWidth(durationS: number, longestS: number): string {
  const share = longestS > 0 ? Math.min(1, durationS / longestS) : 1;
  return `calc(var(--den-trace-scale) * ${share.toFixed(4)})`;
}

/**
 * one set drawn to scale in the live section's list, like a seismograph's trace: its
 * waveform at a width set by its length (so every set compares at a glance), a tick above
 * it for each chat message, and its length just past its end. it's a seek bar too: click
 * or drag anywhere to play from there, hover to see where you'd land. while it's the one
 * loaded, the played stretch is red with a playhead and the time under it.
 *
 * @param {object} props
 * @param {number} props.durationS - the set's length.
 * @param {number} props.longestS - the longest listed set's length, for the scale.
 * @param {DjSetTrace | undefined} props.trace - its waveform and chat, undefined before they start loading.
 * @param {boolean} props.current - it's the loaded track.
 * @param {number} props.positionS - where playback is, when it's current.
 * @param {(seconds: number) => void} props.onSeek - plays the set from there.
 * @param {string} props.title - the set's title, for the seek bar's label.
 * @returns {JSX.Element} the trace.
 */
export default function SetTrace({
  durationS,
  longestS,
  trace,
  current,
  positionS,
  onSeek,
  title,
}: {
  durationS: number;
  longestS: number;
  trace: DjSetTrace | undefined;
  current: boolean;
  positionS: number;
  onSeek: (seconds: number) => void;
  title: string;
}) {
  const [boxRef, widthPx] = useElementWidth();
  const hover = useHoverFraction();
  const scrub = useScrub(current ? positionS : 0, onSeek);

  const peaks = trace?.peaks ?? null;
  const loading = !peaks && !trace?.peaksFailed;
  const barCount = Math.floor(widthPx / BAR_PITCH_PX);
  const bars = barCount > 0 ? resamplePeaks(peaks ?? placeholderPeaks(barCount), barCount) : [];
  const playedPct = current ? percentAt(scrub.value, durationS) : 0;

  return (
    <div className="relative h-16 sm:h-[5.25rem]" style={{ width: traceWidth(durationS, longestS) }}>
      <div className="absolute inset-x-0 top-0 h-2.5" aria-hidden="true">
        {trace?.messages?.map((message) => (
          <span
            key={message.id}
            className={`absolute top-0 h-full w-px ${current && message.offset_s <= scrub.value ? "bg-den-accent" : "bg-den-ink"}`}
            style={{ left: `${percentAt(message.offset_s, durationS)}%` }}
          />
        ))}
      </div>

      <div ref={boxRef} className="absolute inset-x-0 bottom-0 top-3.5">
        <WaveBars
          bars={bars}
          playedFraction={playedPct / PERCENT}
          hoverFraction={hover.fraction}
          placeholder={!peaks}
          className={`absolute inset-0 h-full w-full ${loading ? "animate-pulse" : ""}`}
        />
        {current && (
          <span className="pointer-events-none absolute inset-y-0 w-px bg-den-accent" style={{ left: `${playedPct}%` }}>
            <span className="absolute -bottom-4 left-1 font-den-mono text-[10px] tabular-nums text-den-accent-soft">
              {formatDuration(scrub.value)}
            </span>
          </span>
        )}
        {hover.fraction !== null && (
          <span
            className="pointer-events-none absolute inset-y-0 w-px bg-den-accent/60"
            style={{ left: `${hover.fraction * PERCENT}%` }}
          >
            <span className="absolute -top-4 left-1 bg-den-bg font-den-mono text-[10px] tabular-nums text-den-accent-soft">
              {formatDuration(hover.fraction * durationS)}
            </span>
          </span>
        )}
        <RangeOverlay
          value={scrub.value}
          max={durationS}
          onChange={scrub.move}
          onRelease={scrub.release}
          onPointerMove={hover.onPointerMove}
          onPointerLeave={hover.onPointerLeave}
          label={`Seek ${title}`}
          valueText={`${formatDuration(scrub.value)} of ${formatDuration(durationS)}`}
        />
      </div>

      <span className="pointer-events-none absolute left-full top-1/2 ml-2.5 whitespace-nowrap font-den-mono text-xs tabular-nums">
        {formatDuration(durationS)}
      </span>
    </div>
  );
}
