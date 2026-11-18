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

/**
 * the big five-point stars scattered over the poster, like the ones on old disco
 * fliers. hand placed (as % of the poster) so they sit in the gaps between blocks.
 */
const POSTER_STARS = [
  { leftPct: 6, topPct: 3, sizePx: 22, color: "var(--ornament-lime)", delayMs: 0 },
  { leftPct: 52, topPct: 7, sizePx: 16, color: "var(--c3)", delayMs: 900 },
  { leftPct: 90, topPct: 33, sizePx: 20, color: "var(--ornament-teal)", delayMs: 400 },
  { leftPct: 4, topPct: 47, sizePx: 18, color: "var(--c3)", delayMs: 1500 },
  { leftPct: 48, topPct: 58, sizePx: 24, color: "var(--ornament-lime)", delayMs: 700 },
  { leftPct: 88, topPct: 71, sizePx: 16, color: "var(--c1)", delayMs: 1200 },
  { leftPct: 62, topPct: 95, sizePx: 14, color: "var(--ornament-lime)", delayMs: 1800 },
];

/** the thin overlapping circles behind the poster's blocks, as % of the poster's width and height */
const POSTER_CIRCLES = [
  { leftPct: 58, topPct: -2, widthPct: 52, delayMs: 0 },
  { leftPct: -14, topPct: 36, widthPct: 62, delayMs: 1500 },
  { leftPct: 52, topPct: 40, widthPct: 58, delayMs: 3000 },
  { leftPct: 18, topPct: 62, widthPct: 56, delayMs: 4500 },
];

/**
 * five-point stars that slowly turn and glint.
 * @returns {JSX.Element} an absolutely positioned star layer for the poster.
 */
export function PosterStars() {
  return (
    <div className={styles.posterDecor} aria-hidden="true">
      {POSTER_STARS.map((star) => (
        <span
          key={`${star.leftPct}-${star.topPct}`}
          className={styles.posterStar}
          style={{
            left: `${star.leftPct}%`,
            top: `${star.topPct}%`,
            width: `${star.sizePx}px`,
            height: `${star.sizePx}px`,
            background: star.color,
            animationDelay: `${star.delayMs}ms`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * big outlined circles overlapping behind everything, breathing in and out.
 * @returns {JSX.Element} an absolutely positioned circle layer for the poster.
 */
export function PosterCircles() {
  return (
    <div className={styles.posterDecor} aria-hidden="true">
      {POSTER_CIRCLES.map((circle) => (
        <span
          key={`${circle.leftPct}-${circle.topPct}`}
          className={styles.posterCircle}
          style={{
            left: `${circle.leftPct}%`,
            top: `${circle.topPct}%`,
            width: `${circle.widthPct}%`,
            animationDelay: `${circle.delayMs}ms`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * a pair of bell bottoms on platform shoes, dancing. stands in for the attire art
 * until there's a proper 70s dancer drawing.
 * @returns {JSX.Element} the svg.
 */
export function BellBottoms() {
  return (
    <svg className={styles.bellBottoms} viewBox="0 0 60 100" aria-hidden="true">
      <path
        className={styles.bellBottomsPants}
        d="M14 6 H46 L47 30 L44 58 L54 86 H33 L31 58 L30 36 L29 58 L27 86 H6 L16 58 L13 30 Z"
      />
      <path className={styles.bellBottomsBelt} d="M14 6 H46 V13 H14 Z" />
      <path className={styles.bellBottomsShoes} d="M6 86 H27 V96 H4 Z M33 86 H54 L56 96 H33 Z" />
    </svg>
  );
}

/**
 * a phone with a big "no" slash through it.
 * @returns {JSX.Element} the svg.
 */
export function NoPhoneIcon() {
  return (
    <svg className={styles.noPhoneIcon} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="15" y="7" width="18" height="34" rx="3" className={styles.noPhoneBody} />
      <line x1="21" y1="36" x2="27" y2="36" className={styles.noPhoneBody} />
      <circle cx="24" cy="24" r="20" className={styles.noPhoneSlash} />
      <line x1="10" y1="10" x2="38" y2="38" className={styles.noPhoneSlash} />
    </svg>
  );
}
