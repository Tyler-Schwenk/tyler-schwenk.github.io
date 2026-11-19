import type { CSSProperties } from "react";

import { BOX_ROW_COUNT, DANCERS, FLOOR_LIGHT_COLORS } from "./constants";
import styles from "./disco.module.css";

/** the lit box runs along the row once per box chase cycle (see .box in the css) */
const BOX_CHASE_CYCLE_MS = 1950;

const STAR_COUNT = 70;
const STAR_SEED = 1212;
const STAR_MIN_SIZE_PX = 1;
const STAR_SIZE_RANGE_PX = 2.5;
const STAR_TWINKLE_MAX_DELAY_MS = 3000;

// a tiny seeded generator (park-miller) so the stars and floor lights land the
// same way in the prerendered html and in the browser
const LCG_MULTIPLIER = 16807;
const LCG_MODULUS = 2147483647;

// the floor's much wider than the poster, since its far end shrinks toward the horizon
const FLOOR_COLUMNS = 40;
const FLOOR_ROWS = 26;
const FLOOR_SEED = 1978;
/** about this share of the floor's tiles light up */
const FLOOR_LIT_CHANCE = 0.22;
/** each lit tile blinks on and off over one of these, so the floor never settles into a pattern */
const FLOOR_FLASH_PERIODS_MS = [1200, 1800, 2400];

export interface Star {
  leftPct: number;
  topPct: number;
  sizePx: number;
  delayMs: number;
}

/**
 * a seeded random number source, the same sequence every time for a seed.
 * @param {number} startSeed - any positive whole number.
 * @returns {() => number} gives the next number in [0, 1) each call.
 */
function seededRandom(startSeed: number): () => number {
  let seed = startSeed;
  return () => {
    seed = (seed * LCG_MULTIPLIER) % LCG_MODULUS;
    return seed / LCG_MODULUS;
  };
}

/**
 * scatters the flier's stars, the same way every time.
 * @returns {Star[]} positions, sizes and twinkle offsets.
 */
function scatterStars(): Star[] {
  const next = seededRandom(STAR_SEED);
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

interface FloorLight {
  /** 1-based grid position on the floor */
  column: number;
  row: number;
  color: string;
  flashMs: number;
  delayMs: number;
}

/**
 * picks which dance floor tiles light up, in what color and rhythm. seeded, so
 * the prerendered html matches the browser. plain tiles are just the floor's
 * background, so only the lit ones become elements.
 * @returns {FloorLight[]} the lit tiles.
 */
function layOutFloorLights(): FloorLight[] {
  const next = seededRandom(FLOOR_SEED);
  const lights: FloorLight[] = [];
  for (let i = 0; i < FLOOR_COLUMNS * FLOOR_ROWS; i += 1) {
    if (next() >= FLOOR_LIT_CHANCE) {
      continue;
    }
    const flashMs = FLOOR_FLASH_PERIODS_MS[Math.floor(next() * FLOOR_FLASH_PERIODS_MS.length)];
    lights.push({
      column: (i % FLOOR_COLUMNS) + 1,
      row: Math.floor(i / FLOOR_COLUMNS) + 1,
      color: FLOOR_LIGHT_COLORS[Math.floor(next() * FLOOR_LIGHT_COLORS.length)],
      flashMs,
      delayMs: -Math.floor(next() * flashMs),
    });
  }
  return lights;
}

const FLOOR_LIGHTS = layOutFloorLights();

/** the floor's grid, and its grout lines drawn as a background one tile apart */
const FLOOR_PLANE_STYLE = {
  gridTemplateColumns: `repeat(${FLOOR_COLUMNS}, 1fr)`,
  gridTemplateRows: `repeat(${FLOOR_ROWS}, 1fr)`,
  backgroundSize: `calc(100% / ${FLOOR_COLUMNS}) calc(100% / ${FLOOR_ROWS})`,
};

/**
 * the light-up disco floor from the snoopy clips: hot pink tiles going back to a
 * hazy horizon, with tiles blinking red, orange, yellow, teal and violet.
 * @returns {JSX.Element} the floor layer, along the bottom of the poster.
 */
export function DanceFloor() {
  return (
    <div className={`${styles.posterDecor} ${styles.danceFloor}`} aria-hidden="true">
      <div className={styles.floorPlane} style={FLOOR_PLANE_STYLE}>
        {FLOOR_LIGHTS.map((light) => {
          const style = {
            "--tile-light": light.color,
            gridColumn: light.column,
            gridRow: light.row,
            animationDuration: `${light.flashMs}ms`,
            animationDelay: `${light.delayMs}ms`,
          } as CSSProperties;
          return <span key={`${light.column}-${light.row}`} className={styles.floorLight} style={style} />;
        })}
      </div>
    </div>
  );
}

/**
 * the peanuts kids dancing on the floor, each a looping cutout from the snoopy
 * dance scene. under prefers-reduced-motion the picture swaps to a still frame,
 * since an animated image can't be paused.
 * @returns {JSX.Element} the dancer layer, over the floor and under the words.
 */
export function Dancers() {
  return (
    <div className={styles.posterDecor} aria-hidden="true">
      {DANCERS.map((dancer) => {
        const style = {
          left: `${dancer.leftPct}%`,
          bottom: `${dancer.bottomPct}%`,
          "--dancer-height": dancer.heightU,
        } as CSSProperties;
        return (
          <picture key={dancer.name} className={styles.dancer} style={style}>
            <source srcSet={dancer.stillSrc} media="(prefers-reduced-motion: reduce)" />
            <img
              src={dancer.animSrc}
              alt=""
              className={dancer.flip ? styles.dancerFlipped : undefined}
              loading="lazy"
              decoding="async"
            />
          </picture>
        );
      })}
    </div>
  );
}

/**
 * two stage spotlights sweeping down from the top, like the ones over the snoopy dance floor.
 * @returns {JSX.Element} the spotlight layer.
 */
export function Spotlights() {
  return (
    <div className={styles.posterDecor} aria-hidden="true">
      <span className={`${styles.spotlight} ${styles.spotlightLeft}`} />
      <span className={`${styles.spotlight} ${styles.spotlightRight}`} />
    </div>
  );
}

/**
 * where the white sparkle bursts flash, as % of the poster, kept to the dark sky
 * above the floor and out of the way of the words.
 */
const SPARKLE_BURSTS = [
  { leftPct: 7, topPct: 3, sizePx: 30, delayMs: 0 },
  { leftPct: 50, topPct: 8, sizePx: 20, delayMs: 1300 },
  { leftPct: 90, topPct: 34, sizePx: 26, delayMs: 600 },
  { leftPct: 3, topPct: 46, sizePx: 22, delayMs: 1900 },
  { leftPct: 45, topPct: 55, sizePx: 18, delayMs: 900 },
  { leftPct: 70, topPct: 16, sizePx: 16, delayMs: 2400 },
];

/**
 * the hand drawn white starbursts from the snoopy stage, flashing in and out.
 * @returns {JSX.Element} the sparkle layer.
 */
export function SparkleBursts() {
  return (
    <div className={styles.posterDecor} aria-hidden="true">
      {SPARKLE_BURSTS.map((burst) => (
        <span
          key={`${burst.leftPct}-${burst.topPct}`}
          className={styles.burst}
          style={{
            left: `${burst.leftPct}%`,
            top: `${burst.topPct}%`,
            width: `${burst.sizePx}px`,
            height: `${burst.sizePx}px`,
            animationDelay: `${burst.delayMs}ms`,
          }}
        />
      ))}
    </div>
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
