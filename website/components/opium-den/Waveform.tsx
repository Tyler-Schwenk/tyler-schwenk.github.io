"use client";

import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { formatDuration } from "@/app/admin/format";
import type { DjSetChatMessage } from "@/app/opium-den/djApi";
import { useScrub } from "@/lib/useScrub";
import { RangeOverlay } from "./SliderBar";

// one bar plus its gap, on screen. the waveform gets as many bars as fit
const BAR_PITCH_PX = 3;
// how much of each pitch is bar rather than gap
const BAR_FILL_RATIO = 0.6;
// the viewbox is 100 tall: bars grow up from here, and their faint reflection hangs below
const BASELINE_Y = 70;
const REFLECTION_GAP_Y = 1;
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
function resamplePeaks(peaks: number[], count: number): number[] {
  if (peaks.length === 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const start = Math.floor((i * peaks.length) / count);
    const end = Math.max(start + 1, Math.floor(((i + 1) * peaks.length) / count));
    return Math.max(...peaks.slice(start, end));
  });
}

/**
 * tracks an element's width as it resizes.
 *
 * @returns {[RefObject<HTMLDivElement | null>, number]} the ref to attach and its width in px (0 until measured).
 */
function useElementWidth(): [RefObject<HTMLDivElement | null>, number] {
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

/**
 * how far along the timeline a moment is, as a css percentage.
 *
 * @param {number} seconds - the moment.
 * @param {number} durationS - the whole set.
 * @returns {number} 0 to 100.
 */
function percentAt(seconds: number, durationS: number): number {
  return durationS > 0 ? Math.min(PERCENT, Math.max(0, (seconds / durationS) * PERCENT)) : 0;
}

/**
 * the bars themselves, as one svg stretched over the box. played bars are red, the
 * stretch up to where the mouse is hovering is a fainter red (where a click would land),
 * the rest is grey.
 *
 * @param {object} props
 * @param {number[]} props.bars - one peak per bar, 0 to 1.
 * @param {number} props.playedFraction - how much has played, 0 to 1.
 * @param {number | null} props.hoverFraction - where the mouse is, or null.
 * @param {boolean} props.placeholder - still loading, so pulse.
 * @returns {JSX.Element} the svg.
 */
function Bars({
  bars,
  playedFraction,
  hoverFraction,
  placeholder,
}: {
  bars: number[];
  playedFraction: number;
  hoverFraction: number | null;
  placeholder: boolean;
}) {
  const playedBars = playedFraction * bars.length;
  const hoverBars = (hoverFraction ?? 0) * bars.length;
  const inset = (1 - BAR_FILL_RATIO) / 2;
  const reflectionRoom = PERCENT - BASELINE_Y - REFLECTION_GAP_Y;

  return (
    <svg
      viewBox={`0 0 ${bars.length} ${PERCENT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`absolute inset-0 h-full w-full ${placeholder ? "animate-pulse" : ""}`}
    >
      {bars.map((peak, i) => {
        const height = Math.max(peak, MIN_PEAK);
        const tone =
          i < playedBars ? "fill-den-accent" : i < hoverBars ? "fill-den-accent/45" : "fill-white/25";
        return (
          <g key={i} className={tone}>
            <rect x={i + inset} width={BAR_FILL_RATIO} y={BASELINE_Y - height * BASELINE_Y} height={height * BASELINE_Y} />
            <rect
              x={i + inset}
              width={BAR_FILL_RATIO}
              y={BASELINE_Y + REFLECTION_GAP_Y}
              height={height * reflectionRoom}
              opacity={0.45}
            />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * the strip under the waveform: a dot for every chat message at its moment in the set
 * (red once it's passed), tap one to jump there. the message that just went by pops up
 * as a bubble next to its dot for a few seconds, like comments on soundcloud.
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
            className="group absolute top-0 flex h-3 w-3 -translate-x-1/2 items-center justify-center"
            style={{ left: `${pct}%` }}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full transition group-hover:scale-150 ${done ? "bg-den-accent" : "bg-white/30"}`}
            />
          </button>
        );
      })}
      {bubble && (
        // shifted left by its own position, so it never hangs off either end of the strip
        <p
          key={bubble.id}
          className="pointer-events-none absolute top-3.5 max-w-[70%] truncate rounded-full border border-den-line bg-den-raised px-2.5 py-0.5 text-xs"
          style={{
            left: `${percentAt(bubble.offset_s, durationS)}%`,
            transform: `translateX(-${percentAt(bubble.offset_s, durationS)}%)`,
          }}
        >
          <span className="font-semibold text-den-accent-soft">{bubble.nickname}</span>{" "}
          <span className="text-den-ink/90">{bubble.content}</span>
        </p>
      )}
    </div>
  );
}

/**
 * a recorded set's waveform as its seek bar, soundcloud style: click or drag anywhere to
 * jump there (it plays from that spot), hover to see the time you'd land on, and the
 * set's chat sits along the bottom as dots. a real range input lies over it, so keyboards
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
  const [hoverFraction, setHoverFraction] = useState<number | null>(null);
  const scrub = useScrub(positionS, onSeek);

  const barCount = Math.floor(widthPx / BAR_PITCH_PX);
  const source = peaks ?? new Array<number>(barCount).fill(PLACEHOLDER_PEAK);
  const bars = barCount > 0 ? resamplePeaks(source, barCount) : [];
  const playedFraction = percentAt(scrub.value, durationS) / PERCENT;

  const trackHover = (event: PointerEvent<HTMLInputElement>) => {
    if (event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    setHoverFraction(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)));
  };

  return (
    <div>
      <div ref={boxRef} className="relative h-20 sm:h-24">
        <Bars bars={bars} playedFraction={playedFraction} hoverFraction={hoverFraction} placeholder={loading} />

        {hoverFraction !== null && (
          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-den-ink/60"
            style={{ left: `${hoverFraction * PERCENT}%` }}
          >
            <span className="absolute left-1 top-0 rounded bg-den-bg/90 px-1.5 py-0.5 text-[11px] tabular-nums text-den-ink">
              {formatDuration(hoverFraction * durationS)}
            </span>
          </div>
        )}

        <span className="pointer-events-none absolute bottom-0 left-0 rounded bg-den-bg/80 px-1.5 py-0.5 text-[11px] tabular-nums text-den-accent-soft">
          {formatDuration(scrub.value)}
        </span>
        <span className="pointer-events-none absolute bottom-0 right-0 rounded bg-den-bg/80 px-1.5 py-0.5 text-[11px] tabular-nums text-den-faint">
          {formatDuration(durationS)}
        </span>

        <RangeOverlay
          value={scrub.value}
          max={durationS}
          onChange={scrub.move}
          onRelease={scrub.release}
          onPointerMove={trackHover}
          onPointerLeave={() => setHoverFraction(null)}
          label="Seek"
          valueText={`${formatDuration(scrub.value)} of ${formatDuration(durationS)}`}
        />
      </div>

      <ChatMarkers messages={messages} durationS={durationS} positionS={positionS} onSeek={onSeek} />
    </div>
  );
}
