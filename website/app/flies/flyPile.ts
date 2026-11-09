import { seededUnit } from "@/lib/seededRandom";

/**
 * lays out the pile of dead flies on /flies.
 *
 * it's a tiny sandpile: the floor is split into columns, each fly lands near the
 * middle (roughly normal), and if its column already stands too far above a
 * neighbor it slides down that side until it finds a spot. so the flies heap into
 * a mound and spread out as it grows. every number comes from the fly's index, so
 * the pile looks the same on every screen and adding a fly never moves the others.
 *
 * heights are in fly heights (the sprite's height), and x is a percent of the pile's
 * width, so the page can draw it at any size.
 */

/** how many columns the floor's split into. more makes a smoother mound. */
const PILE_COLUMNS = 29;
/** how much one fly raises its column, in fly heights. under 1 since they overlap. */
const LAYER_STEP = 0.28;
/** how far a column can stand above a neighbor before flies slide off it, in fly heights. sets how steep the mound gets. */
const MAX_STEP_HEIGHT = 0.6;
/** spread of where flies land, as a fraction of the pile width (one standard deviation). */
const LANDING_SPREAD = 0.2;
/** gap kept clear at each side of the floor, as a fraction of the pile width. */
const EDGE_MARGIN = 0.06;
/** irwin-hall with 4 uniforms: their sum has mean 2 and this standard deviation. */
const NORMAL_SAMPLES = 4;
const NORMAL_SAMPLES_SD = Math.sqrt(NORMAL_SAMPLES / 12);
/** back flies sit this much higher on screen at the far edge, in fly heights. fakes depth. */
const DEPTH_LIFT = 0.45;
/** back flies are drawn this much smaller at the far edge. */
const DEPTH_SHRINK = 0.18;
/** how much darker the farthest-back flies are. */
const DEPTH_SHADE = 0.12;
/** a fly this far below the top of its column, in fly heights, is fully in shadow. */
const BURIED_SHADE_DEPTH = 1.4;
/** how dark a fully buried fly gets. */
const MAX_BURIED_SHADE = 0.55;
/**
 * most flies drawn at once. past this, the most buried ones are skipped to keep the DOM
 * small. they're in the dark middle of the pile, mostly covered by their neighbors.
 */
const MAX_DRAWN_FLIES = 800;
/** z-index steps per fly height, so higher flies draw over lower ones. */
const Z_PER_HEIGHT = 20;
/** extra z-index for the frontmost flies, so at the same height front covers back. */
const Z_DEPTH_RANGE = 8;
const FULL_TURN_DEG = 360;
const PERCENT = 100;

/** one fly in the pile, ready to draw. */
export type PiledFly = {
  /** the fly's place in the pile, 0 is the first one ever. */
  index: number;
  /** horizontal center, percent of the pile width. */
  xPct: number;
  /** how high its bottom sits, in fly heights. */
  height: number;
  /** spin, in degrees. */
  angleDeg: number;
  /** mirrored left to right. */
  flipped: boolean;
  /** draw size multiplier, smaller toward the back. */
  scale: number;
  /** css brightness, 1 is untouched. */
  brightness: number;
  /** stacking order. */
  zIndex: number;
};

/** the pile, ready to draw. */
export type FlyPileLayout = {
  /** the flies to draw, in index order. past MAX_DRAWN_FLIES the most buried are left out. */
  flies: PiledFly[];
  /** the top of the tallest column, in fly heights. */
  peakHeight: number;
};

/**
 * a seeded number from a rough normal distribution, mean 0 and standard deviation 1.
 *
 * @param {string} seed - the fly's seed.
 * @returns {number} the sample.
 */
function seededNormal(seed: string): number {
  let sum = 0;
  for (let sample = 0; sample < NORMAL_SAMPLES; sample++) {
    sum += seededUnit(seed, `normal-${sample}`);
  }
  return (sum - NORMAL_SAMPLES / 2) / NORMAL_SAMPLES_SD;
}

/**
 * where a fly first hits the pile, before it slides anywhere.
 *
 * @param {string} seed - the fly's seed.
 * @returns {number} a column index.
 */
function landingColumn(seed: string): number {
  const position = 0.5 + seededNormal(seed) * LANDING_SPREAD;
  const column = Math.round(position * (PILE_COLUMNS - 1));
  return Math.min(PILE_COLUMNS - 1, Math.max(0, column));
}

/**
 * slides a fly down the mound from where it landed until its column isn't too far
 * above both neighbors. the floor's ends count as walls.
 *
 * @param {number[]} heights - each column's current height.
 * @param {number} start - the column it landed in.
 * @param {string} seed - the fly's seed, for breaking ties.
 * @returns {number} the column it settles in.
 */
function settleColumn(heights: number[], start: number, seed: string): number {
  let column = start;
  for (let step = 0; step < PILE_COLUMNS; step++) {
    const left = column > 0 ? heights[column - 1] : Infinity;
    const right = column < PILE_COLUMNS - 1 ? heights[column + 1] : Infinity;
    const lowest = Math.min(left, right);
    if (heights[column] - lowest <= MAX_STEP_HEIGHT) return column;

    const goLeft = left === right ? seededUnit(seed, `tie-${step}`) < 0.5 : left < right;
    column += goLeft ? -1 : 1;
  }
  return column;
}

/**
 * a column's center, as a percent of the pile width.
 *
 * @param {number} column - the column index.
 * @returns {number} percent from the left.
 */
function columnCenterPct(column: number): number {
  const usable = 1 - 2 * EDGE_MARGIN;
  return (EDGE_MARGIN + (column / (PILE_COLUMNS - 1)) * usable) * PERCENT;
}

/**
 * how buried a fly can be and still get drawn, so about MAX_DRAWN_FLIES are (flies tied
 * at the cutoff all get drawn).
 *
 * @param {number[]} buriedBy - how far each fly is under the top of its column.
 * @returns {number} the cutoff. Infinity when every fly fits.
 */
function drawCutoff(buriedBy: number[]): number {
  if (buriedBy.length <= MAX_DRAWN_FLIES) return Infinity;
  const shallowestFirst = [...buriedBy].sort((a, b) => a - b);
  return shallowestFirst[MAX_DRAWN_FLIES - 1];
}

/**
 * lays out a pile of flies.
 *
 * @param {number} count - how many flies are in it.
 * @returns {FlyPileLayout} the flies to draw and how tall the pile is.
 */
export function layOutFlyPile(count: number): FlyPileLayout {
  const heights: number[] = new Array(PILE_COLUMNS).fill(0);
  const placed: { column: number; height: number; seed: string }[] = [];

  for (let index = 0; index < count; index++) {
    const seed = `fly-${index}`;
    const column = settleColumn(heights, landingColumn(seed), seed);
    placed.push({ column, height: heights[column], seed });
    heights[column] += LAYER_STEP;
  }

  // how far under the top of its column each fly ended up once the rest landed
  const buriedBy = placed.map(({ column, height }) => heights[column] - LAYER_STEP - height);
  const skipDeeperThan = drawCutoff(buriedBy);

  const columnWidthPct = columnCenterPct(1) - columnCenterPct(0);
  const flies: PiledFly[] = [];
  placed.forEach(({ column, height, seed }, index) => {
    const buried = buriedBy[index];
    if (buried > skipDeeperThan) return;

    const depth = seededUnit(seed, "depth");
    const buriedShade = (Math.min(buried, BURIED_SHADE_DEPTH) / BURIED_SHADE_DEPTH) * MAX_BURIED_SHADE;
    const jitter = (seededUnit(seed, "jitter") - 0.5) * columnWidthPct;
    const drawnHeight = height + depth * DEPTH_LIFT;

    flies.push({
      index,
      xPct: columnCenterPct(column) + jitter,
      height: drawnHeight,
      angleDeg: Math.round(seededUnit(seed, "angle") * FULL_TURN_DEG),
      flipped: seededUnit(seed, "flip") < 0.5,
      scale: 1 - depth * DEPTH_SHRINK,
      brightness: 1 - buriedShade - depth * DEPTH_SHADE,
      zIndex: Math.round(height * Z_PER_HEIGHT + (1 - depth) * Z_DEPTH_RANGE),
    });
  });

  return { flies, peakHeight: Math.max(...heights) };
}
