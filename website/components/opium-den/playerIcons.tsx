import type { ReactNode } from "react";

/**
 * icons for the opium den page and player. 24x24 in currentColor, so they take the text
 * colour of whatever they're in.
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
 * a chevron, pointing up or down (the mini player's "opens up" hint, disclosures).
 *
 * @param {object} props
 * @param {"up" | "down"} props.direction - which way it points.
 * @param {string} [props.className] - size classes.
 * @returns {JSX.Element} the svg.
 */
export function ChevronIcon({ direction, className = "h-6 w-6" }: { direction: "up" | "down"; className?: string }) {
  const d = direction === "up" ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6";
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** a paper plane, for sending a chat message. */
export function SendIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a.99.99 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
    </Icon>
  );
}

/** an x, for closing the player. */
export function CloseIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Icon>
  );
}

/** an arrow pointing up and right, for links that leave the site. */
export function ExternalIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M8 16L16 8M9 8h7v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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

/** a vinyl record: the stand-in cover for a set that hasn't got one. */
export function RecordIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path
        fillRule="evenodd"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"
      />
      <path
        d="M12 5.5a6.5 6.5 0 0 0-6.5 6.5M18.5 12a6.5 6.5 0 0 1-6.5 6.5"
        fill="none"
        stroke="black"
        strokeOpacity="0.35"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </Icon>
  );
}
