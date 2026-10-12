/**
 * Geometry for the /console scene: where each of displaytop's screens sits in
 * the console illustration, and the perspective math that warps a flat,
 * native-resolution box onto it.
 *
 * Every point is in the illustration's own pixels, read off the colored corner
 * brackets drawn on public/images/console_marked.png: red for the monitor's
 * corners, green for the laptop screen's top and the edge of the record
 * player's lid, purple for the laptop screen's real bottom (behind the lid).
 * The page shows console.webp, the same picture with the brackets painted out.
 */

export const SCENE_IMAGE_SRC = "/images/console.webp";
export const SCENE_IMAGE_SIZE_PX = 1254;

/** A point in illustration pixels. */
export interface Point {
  x: number;
  y: number;
}

/** A screen's four corners in illustration pixels, clockwise from top left. */
export interface Quad {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

/** One physical screen: its native resolution and where it shows up in the illustration. */
export interface ConsoleScreen {
  label: string;
  widthPx: number;
  heightPx: number;
  quad: Quad;
}

// the laptop screen's top corners and the line where the lid starts covering it (green brackets)
const LAPTOP_TOP_LEFT: Point = { x: 467, y: 319 };
const LAPTOP_TOP_RIGHT: Point = { x: 797, y: 338 };
const LID_EDGE_LEFT: Point = { x: 465, y: 459 };
const LID_EDGE_RIGHT: Point = { x: 797, y: 476 };
// the laptop screen's real bottom corners, seen through the lid (purple brackets)
const LAPTOP_BOTTOM_LEFT: Point = { x: 467, y: 498 };
const LAPTOP_BOTTOM_RIGHT: Point = { x: 797, y: 508 };

/** Surface Laptop 3's built-in screen (secondary, on top). */
export const LAPTOP_SCREEN: ConsoleScreen = {
  label: "laptop",
  widthPx: 2256,
  heightPx: 1504,
  quad: {
    topLeft: LAPTOP_TOP_LEFT,
    topRight: LAPTOP_TOP_RIGHT,
    bottomRight: LAPTOP_BOTTOM_RIGHT,
    bottomLeft: LAPTOP_BOTTOM_LEFT,
  },
};

/** The strip of the laptop screen behind the record player's clear lid, shaded over the content. */
export const LID_SHADE_QUAD: Quad = {
  topLeft: LID_EDGE_LEFT,
  topRight: LID_EDGE_RIGHT,
  bottomRight: LAPTOP_BOTTOM_RIGHT,
  bottomLeft: LAPTOP_BOTTOM_LEFT,
};

/** The LG monitor under the shelf (primary, where the surf cams play). */
export const MONITOR_SCREEN: ConsoleScreen = {
  label: "monitor",
  widthPx: 2560,
  heightPx: 1440,
  quad: {
    topLeft: { x: 353, y: 748 },
    topRight: { x: 872, y: 798 },
    bottomRight: { x: 872, y: 1010 },
    bottomLeft: { x: 355, y: 954 },
  },
};

/**
 * Builds the CSS `matrix3d` that maps a `width` x `height` box (with
 * `transform-origin: 0 0`) onto a quad. It's the projective transform taking
 * the unit square to the quad (Heckbert's square-to-quad), scaled down to the
 * box's size. Works for any non-degenerate convex quad.
 * @param quad - Target corners, in the box's parent's pixels.
 * @param width - The box's width in px.
 * @param height - The box's height in px.
 * @returns A `matrix3d(...)` value for the box's `transform`.
 */
export function quadTransform(quad: Quad, width: number, height: number): string {
  const { topLeft: p0, topRight: p1, bottomRight: p2, bottomLeft: p3 } = quad;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const h = (dx1 * dy3 - dx3 * dy1) / det;
  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + h * p3.x;
  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + h * p3.y;
  // css matrix3d is column-major: the u column, the v column, z, then translation
  const values = [
    a / width, d / width, 0, g / width,
    b / height, e / height, 0, h / height,
    0, 0, 1, 0,
    p0.x, p0.y, 0, 1,
  ];
  return `matrix3d(${values.join(",")})`;
}

/**
 * The smallest upright rectangle around a quad.
 * @param quad - Corners in illustration pixels.
 * @returns Its left, top, width and height.
 */
export function quadBounds(quad: Quad): { x: number; y: number; width: number; height: number } {
  const points = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * The quad as an SVG `points` string.
 * @param quad - Corners in illustration pixels.
 * @returns Like "467,319 797,338 ...".
 */
export function quadPoints(quad: Quad): string {
  const { topLeft, topRight, bottomRight, bottomLeft } = quad;
  return [topLeft, topRight, bottomRight, bottomLeft].map((p) => `${p.x},${p.y}`).join(" ");
}
