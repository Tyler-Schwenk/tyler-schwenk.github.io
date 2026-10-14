import type { ComponentType } from "react";
import type { DecorKind } from "./shelfLayout";
import styles from "./library.module.css";

// each piece is drawn in its own viewBox and shown at that size (1 unit = 1px)
const PLANT_WIDTH_PX = 110;
const PLANT_HEIGHT_PX = 160;
const HOOKAH_WIDTH_PX = 90;
const HOOKAH_HEIGHT_PX = 196;
const CANDLE_WIDTH_PX = 44;
const CANDLE_HEIGHT_PX = 100;

// where the plant's leaves fan out from, and each leaf's [angle in degrees, scale]
const PLANT_STEM_BASE = "translate(55 106)";
const PLANT_LEAVES = [
  [-72, 1.0],
  [-50, 1.3],
  [-28, 1.45],
  [-10, 1.6],
  [8, 1.5],
  [26, 1.4],
  [46, 1.25],
  [68, 1.0],
] as const;
// small leaves along the vine trailing over the pot's edge: [x, y, angle]
const VINE_LEAVES = [
  [86, 114, 70],
  [96, 126, 110],
  [97, 140, 80],
  [94, 152, 120],
] as const;
const VINE_LEAF_SCALE = 0.42;

/**
 * a potted plant with a vine trailing over the edge of its pot.
 *
 * @returns {JSX.Element} Plant drawing.
 */
function Plant() {
  return (
    <svg width={PLANT_WIDTH_PX} height={PLANT_HEIGHT_PX} viewBox={`0 0 ${PLANT_WIDTH_PX} ${PLANT_HEIGHT_PX}`}>
      <defs>
        <g id="shelf-leaf">
          <path d="M0 0 C9 -7 11 -24 0 -38 C-11 -24 -9 -7 0 0 Z" fill="#4c7a3a" />
          <path d="M0 0 C9 -7 11 -24 0 -38 Z" fill="#6f9e4c" />
        </g>
      </defs>
      {PLANT_LEAVES.map(([angle, scale]) => (
        <use key={angle} href="#shelf-leaf" transform={`${PLANT_STEM_BASE} rotate(${angle}) scale(${scale})`} />
      ))}
      <path d="M76 108 C96 112 102 130 94 156" fill="none" stroke="#4c7a3a" strokeWidth="2" />
      {VINE_LEAVES.map(([x, y, angle]) => (
        <use key={y} href="#shelf-leaf" transform={`translate(${x} ${y}) rotate(${angle}) scale(${VINE_LEAF_SCALE})`} />
      ))}
      <path d="M32 116 H78 L72 158 H38 Z" fill="#9c4f2c" />
      <path d="M62 116 H78 L72 158 H60 Z" fill="#000" opacity="0.15" />
      <rect x="28" y="104" width="54" height="13" rx="2" fill="#b8663d" />
      <rect x="28" y="104" width="54" height="3" rx="1.5" fill="#fff" opacity="0.15" />
    </svg>
  );
}

/**
 * a hookah: glass base, brass stem, tray, clay bowl with lit coals, and a hose
 * hanging down to the shelf.
 *
 * @returns {JSX.Element} Hookah drawing.
 */
function Hookah() {
  return (
    <svg width={HOOKAH_WIDTH_PX} height={HOOKAH_HEIGHT_PX} viewBox={`0 0 ${HOOKAH_WIDTH_PX} ${HOOKAH_HEIGHT_PX}`}>
      <path
        d="M57 112 C80 112 86 132 82 154 C79 172 82 184 86 190"
        fill="none"
        stroke="#35523a"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <rect x="82" y="186" width="7" height="9" rx="2" fill="#c9a04f" />
      <rect x="41" y="44" width="8" height="92" fill="#b8893a" />
      <rect x="45" y="44" width="4" height="92" fill="#000" opacity="0.18" />
      <rect x="38" y="70" width="14" height="4" rx="2" fill="#d4a64a" />
      <rect x="38" y="98" width="14" height="5" rx="2" fill="#d4a64a" />
      <rect x="49" y="109" width="9" height="6" rx="1" fill="#d4a64a" />
      <path
        d="M45 194 C20 194 14 177 22 162 C28 150 38 146 38 138 H52 C52 146 62 150 68 162 C76 177 70 194 45 194 Z"
        fill="#2f6f78"
        opacity="0.9"
      />
      <path d="M24 170 C28 178 36 184 45 184 C54 184 62 178 66 170 Z" fill="#1d4c54" opacity="0.6" />
      <ellipse cx="31" cy="168" rx="3.5" ry="11" fill="#fff" opacity="0.25" />
      <rect x="36" y="132" width="18" height="8" rx="2" fill="#2a2119" />
      <ellipse cx="45" cy="46" rx="24" ry="5" fill="#9c7a35" />
      <ellipse cx="45" cy="44" rx="24" ry="5" fill="#d4a64a" />
      <path d="M33 40 H57 L52 22 H38 Z" fill="#8a4b2e" />
      <rect x="35" y="18" width="20" height="4" rx="1" fill="#c8c4bc" />
      <rect x="37" y="12" width="7" height="6" rx="1.5" fill="#4a3328" stroke="#e86a2a" strokeWidth="1.2" />
      <rect x="46" y="12" width="7" height="6" rx="1.5" fill="#4a3328" stroke="#e86a2a" strokeWidth="1.2" />
    </svg>
  );
}

/**
 * a lit candle in a brass dish. the flame flickers (unless reduced motion is on).
 *
 * @returns {JSX.Element} Candle drawing.
 */
function Candle() {
  return (
    <svg width={CANDLE_WIDTH_PX} height={CANDLE_HEIGHT_PX} viewBox={`0 0 ${CANDLE_WIDTH_PX} ${CANDLE_HEIGHT_PX}`}>
      <defs>
        <radialGradient id="shelf-candle-glow">
          <stop offset="0" stopColor="#ffcf6b" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffcf6b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="22" cy="26" r="20" fill="url(#shelf-candle-glow)" />
      <rect x="13" y="40" width="18" height="52" fill="#efe4cc" />
      <rect x="25" y="40" width="6" height="52" fill="#000" opacity="0.1" />
      <path d="M13 40 H19 V52 C19 55 15 55 15 52 V46 H13 Z" fill="#f8f0dc" />
      <ellipse cx="22" cy="40" rx="9" ry="2.5" fill="#f8f0dc" />
      <line x1="22" y1="40" x2="22" y2="33" stroke="#2a2119" strokeWidth="1.5" />
      <g className={styles.flame}>
        <path d="M22 14 C27 22 27 30 22 34 C17 30 17 22 22 14 Z" fill="#ffb347" />
        <path d="M22 22 C24.5 26 24.5 30 22 32 C19.5 30 19.5 26 22 22 Z" fill="#fff4d6" />
      </g>
      <ellipse cx="22" cy="94" rx="20" ry="5" fill="#9c7a35" />
      <ellipse cx="22" cy="92" rx="20" ry="4" fill="#d4a64a" />
    </svg>
  );
}

const DECOR_DRAWINGS: Record<DecorKind, ComponentType> = {
  plant: Plant,
  hookah: Hookah,
  candle: Candle,
};

/**
 * Something sitting on the shelf between the book stacks. purely decorative, so
 * it's hidden from screen readers.
 *
 * @param {object} props - Component props.
 * @param {DecorKind} props.kind - Which piece to draw.
 * @returns {JSX.Element} The drawing.
 */
export default function ShelfDecor({ kind }: { kind: DecorKind }) {
  const Drawing = DECOR_DRAWINGS[kind];
  return (
    <div className={styles.decor} aria-hidden="true">
      <Drawing />
    </div>
  );
}
