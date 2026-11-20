// how many bars, and their stagger so they don't bounce in lockstep
const BAR_DELAYS_S = [0, 0.35, 0.15, 0.5];

/**
 * a little bouncing equalizer, the "this is what's playing" marker. the bounce is
 * .den-eq-bar in globals.css; paused (or under reduced motion) the bars sit still.
 *
 * @param {object} props
 * @param {boolean} props.active - bouncing when true, resting when false.
 * @param {string} [props.className] - size and colour classes.
 * @returns {JSX.Element} the bars.
 */
export default function EqBars({ active, className = "h-4 w-4 text-den-accent" }: { active: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-end gap-[2px] ${className}`} aria-hidden="true">
      {BAR_DELAYS_S.map((delayS) => (
        <span
          key={delayS}
          className="den-eq-bar h-full flex-1 rounded-sm bg-current"
          data-active={active}
          style={{ animationDelay: `${delayS}s` }}
        />
      ))}
    </span>
  );
}
