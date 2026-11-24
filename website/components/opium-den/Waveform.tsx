"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from "react";
import { formatDuration } from "@/app/admin/format";
import type { DjSetChatMessage } from "@/app/opium-den/djApi";
import { useScrub } from "@/lib/useScrub";
import { RangeOverlay } from "./SliderBar";

// one bar plus its gap, on screen. the waveform gets as many bars as fit
export const BAR_PITCH_PX = 3;
// how much of each pitch is bar rather than gap
const BAR_FILL_RATIO = 0.66;
// the viewbox is 100 tall and the bars are mirrored about its middle, like a seismograph trace
const MID_Y = 50;
// the loudest bar's share of the height, so peaks don't touch the edges
const PEAK_HEIGHT_RATIO = 0.92;
// so quiet stretches still show as a sliver instead of nothing
const MIN_PEAK = 0.04;
// flat bars drawn while the real waveform loads
const PLACEHOLDER_PEAK = 0.12;
// how long a message's bubble stays up on the timeline after its moment passes
const BUBBLE_VISIBLE_S = 5;
const PERCENT = 100;

/**
 * squeezes the peaks into fewer bars, keeping each group's loudest.
 *
 * @param {number[]} peaks - the full waveform, each 0 to 1.
 * @param {number} count - how many bars to draw.
 * @returns {number[]} count peaks.
 */
export function resamplePeaks(peaks: number[], count: number): number[] {
  if (peaks.length === 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const start = Math.floor((i * peaks.length) / count);
    const end = Math.max(start + 1, Math.floor(((i + 1) * peaks.length) / count));
    return Math.max(...peaks.slice(start, end));
  });
}

/**
 * bars for a waveform that's still loading (or failed): flat and quiet, so the shape of
 * the thing is there without pretending to be the set.
 *
 * @param {number} count - how many bars.
 * @returns {number[]} count flat peaks.
 */
export function placeholderPeaks(count: number): number[] {
  return new Array<number>(count).fill(PLACEHOLDER_PEAK);
}

/**
 * tracks an element's width as it resizes.
 *
 * @returns {[RefObject<HTMLDivElement | null>, number]} the ref to attach and its width in px (0 until measured).
 */
export function useElementWidth(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** what useHoverFraction hands back: where the mouse is, and the handlers for a RangeOverlay. */
export type HoverFraction = {
  /** how far across the mouse is, 0 to 1, or null when it's not over it. */
  fraction: number | null;
  onPointerMove: (event: PointerEvent<HTMLInputElement>) => void;
  onPointerLeave: () => void;
};

/**
 * tracks where the mouse is over a seekable waveform, so it can show where a click would
 * land. mouse only: touch has no hover, and a drag already shows its own position.
 *
 * @returns {HoverFraction} the position and the handlers to put on the range input.
 */
export function useHoverFraction(): HoverFraction {
  const [fraction, setFraction] = useState<number | null>(null);
  const onPointerMove = (event: PointerEvent<HTMLInputElement>) => {
    if (event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    setFraction(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)));
  };
  return { fraction, onPointerMove, onPointerLeave: () => setFraction(null) };
}

/**
 * how far along the timeline a moment is, as a css percentage.
 *
 * @param {number} seconds - the moment.
 * @param {number} durationS - the whole set.
 * @returns {number} 0 to 100.
 */
export function percentAt(seconds: number, durationS: number): number {
  return durationS > 0 ? Math.min(PERCENT, Math.max(0, (seconds / durationS) * PERCENT)) : 0;
}

/**
 * the bars themselves, as one svg stretched over its box, mirrored about the middle like
 * a seismograph trace. played bars are signal red, the stretch up to where the mouse is
 * hovering is a fainter red (where a click would land), the rest is ink. shared by the
 * set page's waveform and the live section's to-scale set list.
 *
 * @param {object} props
 * @param {number[]} props.bars - one peak per bar, 0 to 1.
 * @param {number} props.playedFraction - how much has played, 0 to 1.
 * @param {number | null} [props.hoverFraction] - where the mouse is, or null.
 * @param {boolean} [props.placeholder] - no real waveform (loading or failed), so faint. pulse it with the className while loading.
 * @param {string} [props.className] - placement, absolute and filling the parent by default.
 * @param {CSSProperties} [props.style] - inline placement, like a width that changes with the data.
 * @returns {JSX.Element} the svg.
 */
export function WaveBars({
  bars,
  playedFraction,
  hoverFraction = null,
  placeholder = false,
  className = "absolute inset-0 h-full w-full",
  style,
}: {
  bars: number[];
  playedFraction: number;
  hoverFraction?: number | null;
  placeholder?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const playedBars = playedFraction * bars.length;
  const hoverBars = (hoverFraction ?? 0) * bars.length;
  const inset = (1 - BAR_FILL_RATIO) / 2;

  return (
    <svg
      viewBox={`0 0 ${bars.length} ${PERCENT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {bars.map((peak, i) => {
        const half = Math.max(peak, MIN_PEAK) * PEAK_HEIGHT_RATIO * MID_Y;
        const tone = placeholder
          ? "fill-den-ink/20"
          : i < playedBars
            ? "fill-den-accent"
            : i < hoverBars
              ? "fill-den-accent/45"
              : "fill-den-ink";
        return <rect key={i} className={tone} x={i + inset} width={BAR_FILL_RATIO} y={MID_Y - half} height={half * 2} />;
      })}
    </svg>
  );
}

/**
 * the strip under the waveform: a tick for every chat message at its moment in the set
 * (red once it's passed), tap one to jump there. the message that just went by pops up
 * as a bubble next to its tick for a few seconds, like comments on soundcloud.
 *
 * @param {object} props
 * @param {DjSetChatMessage[]} props.messages - the set's chat.
 * @param {number} props.durationS - the set's length.
 * @param {number} props.positionS - where playback is.
 * @param {(seconds: number) => void} props.onSeek - jumps there and plays.
 * @returns {JSX.Element} the strip.
 */
function ChatMarkers({
  messages,
  durationS,
  positionS,
  onSeek,
}: {
  messages: DjSetChatMessage[];
  durationS: number;
  positionS: number;
  onSeek: (seconds: number) => void;
}) {
  const passed = messages.filter((message) => message.offset_s <= positionS);
  const latest = passed.at(-1);
  const bubble = latest && positionS - latest.offset_s < BUBBLE_VISIBLE_S ? latest : null;

  return (
    <div className="relative h-9">
      {messages.map((message) => {
        const pct = percentAt(message.offset_s, durationS);
        const done = message.offset_s <= positionS;
        return (
          <button
            key={message.id}
            type="button"
            tabIndex={-1}
            onClick={() => onSeek(message.offset_s)}
            title={`${formatDuration(message.offset_s)}  ${message.nickname}: ${message.content}`}
            aria-label={`Jump to ${message.nickname}'s message at ${formatDuration(message.offset_s)}`}
            className="group absolute top-0 flex h-3 w-3 -translate-x-1/2 justify-center"
            style={{ left: `${pct}%` }}
          >
            <span className={`h-full w-px transition-transform group-hover:scale-x-[3] ${done ? "bg-den-accent" : "bg-den-ink"}`} />
          </button>
        );
      })}
      {bubble && (
        // shifted left by its own position, so it never hangs off either end of the strip
        <p
          key={bubble.id}
          className="pointer-events-none absolute top-4 max-w-[70%] truncate border-l border-den-ink bg-den-raised px-2 py-0.5 text-xs"
          style={{
            left: `${percentAt(bubble.offset_s, durationS)}%`,
            transform: `translateX(-${percentAt(bubble.offset_s, durationS)}%)`,
          }}
        >
          <span className="font-den-mono text-[10px] uppercase text-den-muted">{bubble.nickname}</span>{" "}
          <span className="text-den-ink">{bubble.content}</span>
        </p>
      )}
    </div>
  );
}

/**
 * a recorded set's waveform as its seek bar, soundcloud style: click or drag anywhere to
 * jump there (it plays from that spot), hover to see the time you'd land on, and the
 * set's chat sits along the bottom as ticks. a real range input lies over it, so keyboards
 * and screen readers seek it like any slider. draws flat pulsing bars while the waveform
 * loads, and stays usable without one.
 *
 * @param {object} props
 * @param {number[] | null} props.peaks - the waveform, null while it loads or if it failed.
 * @param {boolean} props.loading - the waveform's still coming.
 * @param {number} props.durationS - the set's length.
 * @param {number} props.positionS - where playback is (0 when the set isn't loaded).
 * @param {DjSetChatMessage[]} props.messages - the set's chat, for the markers.
 * @param {(seconds: number) => void} props.onSeek - jumps there and plays.
 * @returns {JSX.Element} the waveform.
 */
export default function Waveform({
  peaks,
  loading,
  durationS,
  positionS,
  messages,
  onSeek,
}: {
  peaks: number[] | null;
  loading: boolean;
  durationS: number;
  positionS: number;
  messages: DjSetChatMessage[];
  onSeek: (seconds: number) => void;
}) {
  const [boxRef, widthPx] = useElementWidth();
  const hover = useHoverFraction();
  const hoverFraction = hover.fraction;
  const scrub = useScrub(positionS, onSeek);

  const barCount = Math.floor(widthPx / BAR_PITCH_PX);
  const bars = barCount > 0 ? resamplePeaks(peaks ?? placeholderPeaks(barCount), barCount) : [];
  const playedFraction = percentAt(scrub.value, durationS) / PERCENT;

  return (
    <div>
      <div ref={boxRef} className="relative h-20 sm:h-24">
        <WaveBars
          bars={bars}
          playedFraction={playedFraction}
          hoverFraction={hoverFraction}
          placeholder={!peaks}
          className={`absolute inset-0 h-full w-full ${loading ? "animate-pulse" : ""}`}
        />

        {hoverFraction !== null && (
          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-den-accent"
            style={{ left: `${hoverFraction * PERCENT}%` }}
          >
            <span className="absolute left-1 top-0 bg-den-raised/90 px-1.5 py-0.5 font-den-mono text-[11px] tabular-nums text-den-accent-soft">
              {formatDuration(hoverFraction * durationS)}
            </span>
          </div>
        )}

        <span className="pointer-events-none absolute bottom-0 left-0 bg-den-raised/80 px-1.5 py-0.5 font-den-mono text-[11px] tabular-nums text-den-accent-soft">
          {formatDuration(scrub.value)}
        </span>
        <span className="pointer-events-none absolute bottom-0 right-0 bg-den-raised/80 px-1.5 py-0.5 font-den-mono text-[11px] tabular-nums text-den-muted">
          {formatDuration(durationS)}
        </span>

        <RangeOverlay
          value={scrub.value}
          max={durationS}
          onChange={scrub.move}
          onRelease={scrub.release}
          onPointerMove={hover.onPointerMove}
          onPointerLeave={hover.onPointerLeave}
          label="Seek"
          valueText={`${formatDuration(scrub.value)} of ${formatDuration(durationS)}`}
        />
      </div>

      <ChatMarkers messages={messages} durationS={durationS} positionS={positionS} onSeek={onSeek} />
    </div>
  );
}
