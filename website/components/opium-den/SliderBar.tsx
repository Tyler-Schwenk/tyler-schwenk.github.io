"use client";

/**
 * a slim slider for the player's progress and volume: a filled track you can click or
 * drag, with a knob that shows on hover. it's a real range input underneath (invisible,
 * stretched over the track), so keyboards and screen readers get the native control.
 * the large version has a thicker track, a bigger hit area and an always-on knob, since
 * there's no hover on a phone.
 *
 * @param {object} props
 * @param {number} props.value - current value.
 * @param {number} props.max - the end of the range; 0 disables it.
 * @param {(value: number) => void} props.onChange - called while dragging.
 * @param {() => void} [props.onRelease] - called when the finger, mouse or key lets go.
 * @param {string} props.label - accessible name, like "seek" or "volume".
 * @param {string} [props.valueText] - spoken value, like "3:12 of 58:40".
 * @param {number} [props.step] - input step.
 * @param {boolean} [props.large] - the touch-sized version.
 * @param {string} [props.className] - layout classes for the wrapper.
 * @returns {JSX.Element} the slider.
 */
export default function SliderBar({
  value,
  max,
  onChange,
  onRelease,
  label,
  valueText,
  step = 1,
  large = false,
  className = "",
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  onRelease?: () => void;
  label: string;
  valueText?: string;
  step?: number;
  large?: boolean;
  className?: string;
}) {
  const fillPct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const wrapperHeight = large ? "h-8" : "h-4";
  const trackHeight = large ? "h-1.5" : "h-1 group-hover:h-1.5";
  const knob = large ? "h-4 w-4" : "h-3 w-3 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100";

  return (
    <div className={`group relative flex items-center ${wrapperHeight} ${className}`}>
      <div className={`relative w-full rounded-full bg-white/[0.12] transition-[height] ${trackHeight}`}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-den-ink group-hover:bg-den-accent" style={{ width: `${fillPct}%` }} />
        <div
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-den-ink transition-opacity ${knob}`}
          style={{ left: `${fillPct}%` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={max || 1}
        step={step}
        value={max > 0 ? value : 0}
        disabled={max <= 0}
        onChange={(event) => onChange(Number(event.target.value))}
        // a phone can end a drag with pointercancel or only touchend, so listen for all
        // of them; letting go twice is harmless
        onPointerUp={onRelease}
        onPointerCancel={onRelease}
        onTouchEnd={onRelease}
        onKeyUp={onRelease}
        onBlur={onRelease}
        aria-label={label}
        aria-valuetext={valueText}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
      />
    </div>
  );
}
