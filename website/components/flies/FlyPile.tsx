"use client";

import { useLayoutEffect, useMemo, useRef, type CSSProperties } from "react";
import { layOutFlyPile } from "@/app/flies/flyPile";
import { seededRange, seededUnit } from "@/lib/seededRandom";
import styles from "./flies.module.css";

const FLY_SRC = "/images/flies/dead-fly.png";

// starts the fall this far above the top of the screen, so it drops in from offscreen
const FALL_START_ABOVE_PX = 40;
// fall time grows with the square root of the distance, like real falling
const FALL_MS_PER_SQRT_PX = 30;
const MIN_FALL_MS = 550;
const MAX_FALL_MS = 1150;
// when several land at once (a poll caught up), they come down one after another
const STAGGER_MS = 140;
// how far it drifts sideways on the way down, either direction
const MAX_DRIFT_PX = 60;
// how much it spins on the way down, either direction
const MIN_SPIN_DEG = 200;
const MAX_SPIN_DEG = 540;
// tumbling toward or away from the screen, so it doesn't look flat
const TUMBLE_DEG = 50;
const PERSPECTIVE = "perspective(400px)";
// the fall takes this share of the animation; the rest is the squash and bounce
const IMPACT_OFFSET = 0.72;
const BOUNCE_OFFSET = 0.85;
const FADE_IN_MS = 250;
// the floor shadow grows with the pile, from a small smudge to the full width
const MIN_SHADOW_WIDTH_PCT = 24;
const SHADOW_WIDTH_PCT_PER_SQRT_FLY = 7;
const MAX_SHADOW_WIDTH_PCT = 100;
// empty space kept above the top of the pile, in fly heights, so a landing fly's bounce fits
const HEADROOM_FLY_HEIGHTS = 1.6;

/**
 * drops one fly onto the pile: it falls from above the screen, tumbling and drifting,
 * squashes when it lands, then bounces once. with reduced motion it just fades in.
 *
 * @param {HTMLElement} element - the fly, already in its final spot.
 * @param {number} index - the fly's index, which seeds its spin and drift.
 * @param {number} delayMs - how long to wait before it starts falling.
 * @returns {void}
 */
function dropFly(element: HTMLElement, index: number, delayMs: number): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_IN_MS, delay: delayMs, fill: "backwards" });
    return;
  }

  const seed = `drop-${index}`;
  const fallPx = element.getBoundingClientRect().bottom + FALL_START_ABOVE_PX;
  const durationMs = Math.min(MAX_FALL_MS, Math.max(MIN_FALL_MS, Math.sqrt(fallPx) * FALL_MS_PER_SQRT_PX));
  const direction = seededUnit(seed, "direction") < 0.5 ? -1 : 1;
  const spinDeg = direction * seededRange(seed, "spin", MIN_SPIN_DEG, MAX_SPIN_DEG);
  const driftPx = seededRange(seed, "drift", -MAX_DRIFT_PX, MAX_DRIFT_PX);
  const tumbleDeg = direction * TUMBLE_DEG;

  element.animate(
    [
      {
        transform: `${PERSPECTIVE} translate(${driftPx}px, ${-fallPx}px) rotate(${spinDeg}deg) rotateX(${tumbleDeg}deg)`,
        // speeding up as it falls
        easing: "cubic-bezier(0.55, 0, 0.9, 0.45)",
      },
      {
        offset: IMPACT_OFFSET,
        transform: `${PERSPECTIVE} translate(0, 0) rotate(0deg) rotateX(0deg) scale(1.12, 0.82)`,
        easing: "ease-out",
      },
      {
        offset: BOUNCE_OFFSET,
        transform: `${PERSPECTIVE} translate(0, -18%) rotate(${-direction * 6}deg) rotateX(0deg) scale(0.96, 1.04)`,
        easing: "ease-in",
      },
      { transform: `${PERSPECTIVE} translate(0, 0) rotate(0deg) rotateX(0deg) scale(1, 1)` },
    ],
    // backwards fill keeps it up out of sight while it waits its turn
    { duration: durationMs, delay: delayMs, fill: "backwards" }
  );
}

/**
 * the floor's pile of dead flies. flies added after it first shows drop in from
 * the top of the screen; the ones already there when the page loads just sit there.
 *
 * @param {object} props - component props.
 * @param {number} props.total - how many flies are in the pile.
 * @returns {JSX.Element} the pile.
 */
export default function FlyPile({ total }: { total: number }) {
  const { flies, peakHeight } = useMemo(() => layOutFlyPile(total), [total]);
  const pileRef = useRef<HTMLDivElement>(null);
  const shownTotal = useRef<number | null>(null);

  // runs before paint, so a new fly never flashes in its final spot before falling
  useLayoutEffect(() => {
    const previous = shownTotal.current;
    shownTotal.current = total;
    if (previous === null || total <= previous || !pileRef.current) return;

    for (let index = previous; index < total; index++) {
      const element = pileRef.current.querySelector<HTMLElement>(`[data-fly-index="${index}"]`);
      if (element) dropFly(element, index, (index - previous) * STAGGER_MS);
    }
  }, [total]);

  const shadowWidthPct = total === 0
    ? 0
    : Math.min(MAX_SHADOW_WIDTH_PCT, MIN_SHADOW_WIDTH_PCT + Math.sqrt(total) * SHADOW_WIDTH_PCT_PER_SQRT_FLY);
  const pileStyle = { "--pile-height": peakHeight + HEADROOM_FLY_HEIGHTS } as CSSProperties;

  return (
    <div ref={pileRef} className={styles.pile} style={pileStyle}>
      <div className={styles.pileShadow} style={{ width: `${shadowWidthPct}%` }} />
      {flies.map((fly) => (
        <div
          key={fly.index}
          data-fly-index={fly.index}
          className={styles.fly}
          style={{ left: `${fly.xPct}%`, zIndex: fly.zIndex, "--fly-bottom": fly.height } as CSSProperties}
        >
          {/* plain img: static export serves it as-is, and hundreds of copies share one download */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FLY_SRC}
            alt=""
            draggable={false}
            className={styles.flyImage}
            style={{
              transform: `rotate(${fly.angleDeg}deg) scaleX(${fly.flipped ? -1 : 1}) scale(${fly.scale})`,
              filter: `brightness(${fly.brightness})`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
