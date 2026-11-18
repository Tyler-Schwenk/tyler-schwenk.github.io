import type { CSSProperties } from "react";

import { BOX_ROW_COUNT, DIAMOND_ROW_COUNT } from "./constants";
import styles from "./disco.module.css";

/** the lit box runs along the row once per box chase cycle (see .box in the css) */
const BOX_CHASE_CYCLE_MS = 1950;
const DIAMOND_TWINKLE_STEP_MS = 200;

const STAR_COUNT = 70;
const STAR_SEED = 1212;
const STAR_MIN_SIZE_PX = 1;
const STAR_SIZE_RANGE_PX = 2.5;
const STAR_TWINKLE_MAX_DELAY_MS = 3000;

// a tiny seeded generator (park-miller) so the stars land in the same spots in
// the prerendered html and in the browser
const LCG_MULTIPLIER = 16807;
const LCG_MODULUS = 2147483647;

export interface Star {
  leftPct: number;
  topPct: number;
  sizePx: number;
  delayMs: number;
}

/**
 * scatters the flier's stars, the same way every time.
 * @returns {Star[]} positions, sizes and twinkle offsets.
 */
function scatterStars(): Star[] {
  let seed = STAR_SEED;
  const next = () => {
    seed = (seed * LCG_MULTIPLIER) % LCG_MODULUS;
    return seed / LCG_MODULUS;
  };
  return Array.from({ length: STAR_COUNT }, () => ({
    leftPct: next() * 100,
    topPct: next() * 100,
    sizePx: STAR_MIN_SIZE_PX + next() * STAR_SIZE_RANGE_PX,
    delayMs: next() * STAR_TWINKLE_MAX_DELAY_MS,
  }));
}

/** the flier's stars, shared with the saved card so it matches the page */
export const STARS = scatterStars();

/** where the sparkles glint on the disco ball, as % of its size, with their own timing */
const BALL_SPARKLES = [
  { leftPct: 20, topPct: 22, delayMs: 0 },
  { leftPct: 62, topPct: 40, delayMs: 700 },
  { leftPct: 38, topPct: 68, delayMs: 1300 },
];

/**
 * the row of concentric lime and blue squares from the video's titles, with a light chasing along it.
 * @returns {JSX.Element} the box row.
 */
export function BoxRow() {
  const stepMs = BOX_CHASE_CYCLE_MS / BOX_ROW_COUNT;
  return (
    <div className={styles.boxRow} aria-hidden="true">
      {Array.from({ length: BOX_ROW_COUNT }, (_, i) => (
        <span key={i} className={styles.box} style={{ animationDelay: `${i * stepMs}ms` }} />
      ))}
    </div>
  );
}

/**
 * the row of teal diamonds from under the video's titles, twinkling in a wave.
 * @returns {JSX.Element} the diamond row.
 */
export function DiamondRow() {
  return (
    <div className={styles.diamondRow} aria-hidden="true">
      {Array.from({ length: DIAMOND_ROW_COUNT }, (_, i) => (
        <span key={i} className={styles.diamond} style={{ animationDelay: `${i * DIAMOND_TWINKLE_STEP_MS}ms` }} />
      ))}
    </div>
  );
}

/**
 * twinkling stars over the whole flier, like the video's space scene.
 * @returns {JSX.Element} a fixed, non-interactive star layer.
 */
export function StarField() {
  return (
    <div className={styles.starField} aria-hidden="true">
      {STARS.map((star, i) => {
        const style: CSSProperties = {
          left: `${star.leftPct}%`,
          top: `${star.topPct}%`,
          width: `${star.sizePx}px`,
          height: `${star.sizePx}px`,
          animationDelay: `${star.delayMs}ms`,
        };
        return <span key={i} className={styles.star} style={style} />;
      })}
    </div>
  );
}

/**
 * a spinning mirror ball on a string, throwing slow light beams around the page.
 * @returns {JSX.Element} the hanging ball and its beams.
 */
export function DiscoBall() {
  return (
    <div className={styles.ballRig} aria-hidden="true">
      <div className={styles.beams} />
      <div className={styles.ballString} />
      <div className={styles.ball}>
        <div className={styles.ballTiles} />
        <div className={styles.ballShade} />
        {BALL_SPARKLES.map((sparkle) => (
          <span
            key={`${sparkle.leftPct}-${sparkle.topPct}`}
            className={styles.sparkle}
            style={{ left: `${sparkle.leftPct}%`, top: `${sparkle.topPct}%`, animationDelay: `${sparkle.delayMs}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
