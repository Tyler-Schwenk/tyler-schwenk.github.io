"use client";

import { useMinimizePlayer } from "./DenPlayerProvider";
import { ChevronIcon } from "./playerIcons";

/**
 * a full view's "minimize": shrinks it back down to the player bar and takes you back to
 * the page you were on, with the audio still going. only worth showing while the page's
 * track is the one loaded, since otherwise there's no bar to shrink to.
 *
 * @param {object} props
 * @param {string} props.fallbackPath - where to go when the full view's the first page you landed on.
 * @param {string} [props.className] - extra classes.
 * @returns {JSX.Element} the button.
 */
export default function MinimizeButton({ fallbackPath, className = "" }: { fallbackPath: string; className?: string }) {
  const minimize = useMinimizePlayer(fallbackPath);
  return (
    <button
      type="button"
      onClick={minimize}
      aria-label="Minimize the player"
      title="Minimize"
      className={`inline-flex items-center gap-1.5 rounded-full border border-den-ink px-3 py-1.5 font-den-mono text-[11px] uppercase transition-colors hover:bg-den-ink hover:text-den-bg ${className}`}
    >
      <ChevronIcon direction="down" className="h-3.5 w-3.5" />
      Minimize
    </button>
  );
}
