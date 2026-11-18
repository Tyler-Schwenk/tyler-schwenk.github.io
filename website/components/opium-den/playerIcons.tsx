import type { ReactNode } from "react";

/**
 * icons for the opium den player. filled shapes in currentColor, 24x24, so they take
 * the text colour of whatever button they're in.
 */

/**
 * wraps an icon's shapes in a 24x24 svg.
 *
 * @param {object} props
 * @param {ReactNode} props.children - the shapes.
 * @param {string} [props.className] - size classes, 20px by default.
 * @returns {JSX.Element} the svg.
 */
function Icon({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

/** a play triangle, nudged right so it looks centred in a circle. */
export function PlayIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
    </Icon>
  );
}

/** two pause bars. */
export function PauseIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </Icon>
  );
}

/** a spinning ring, for loading. */
export function SpinnerIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`animate-spin ${className}`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** a speaker with sound waves. */
export function VolumeIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M4 9.5v5a1 1 0 0 0 1 1h3l4.3 3.6a.8.8 0 0 0 1.2-.6V5.5a.8.8 0 0 0-1.2-.6L8 8.5H5a1 1 0 0 0-1 1z" />
      <path
        d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Icon>
  );
}

/** a speaker with an x, for muted. */
export function MutedIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M4 9.5v5a1 1 0 0 0 1 1h3l4.3 3.6a.8.8 0 0 0 1.2-.6V5.5a.8.8 0 0 0-1.2-.6L8 8.5H5a1 1 0 0 0-1 1z" />
      <path d="M16.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Icon>
  );
}

/**
 * a circular arrow with a number in it, for jumping back or forward.
 *
 * @param {object} props
 * @param {"back" | "forward"} props.direction - which way the arrow turns.
 * @param {number} props.seconds - the number inside.
 * @param {string} [props.className] - size classes.
 * @returns {JSX.Element} the svg.
 */
export function SkipIcon({
  direction,
  seconds,
  className = "h-6 w-6",
}: {
  direction: "back" | "forward";
  seconds: number;
  className?: string;
}) {
  const flip = direction === "forward" ? "scale(-1 1) translate(-24 0)" : undefined;
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <g transform={flip} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
        <path d="M6.5 3v4h4" />
      </g>
      <text x="12" y="15.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor">
        {seconds}
      </text>
    </svg>
  );
}
