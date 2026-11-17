import type { MicLayout, MicNodeId, MicPoint } from "./micData";

/** node circle radius, in svg units */
export const MIC_NODE_RADIUS = 52;

/** space between a node's edge and where a flow line starts or ends */
const FLOW_GAP = 10;

/** node labels hang under the circle, so lines that leave out the bottom start this much further out */
const LABEL_CLEARANCE = 48;

/** a line counts as leaving out the bottom when it's within 45 degrees of straight down */
const DOWNWARD_COS = Math.SQRT1_2;

/** arrowhead size, in svg units */
const ARROW_LENGTH = 16;
const ARROW_HALF_WIDTH = 9;

/** extra room around a group's nodes: the group label sits on top, node labels hang below. side room is per layout */
const GROUP_PAD_TOP = 100;
const GROUP_PAD_BOTTOM = 115;

/** everything needed to draw one flow line */
export interface FlowGeometry {
  /** svg path for the line itself, also what the particles ride along */
  path: string;
  /** svg points for the arrowhead at the end */
  arrow: string;
  /** where the label goes, halfway along the line */
  labelAt: MicPoint;
  /** rough line length, for keeping particle speed even across flows */
  length: number;
}

export interface GroupBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * moves a point toward another one by a fixed distance.
 * @param {MicPoint} from - starting point.
 * @param {MicPoint} toward - point to head toward.
 * @param {number} distance - how far to move.
 * @returns {MicPoint} the moved point.
 */
function stepToward(from: MicPoint, toward: MicPoint, distance: number): MicPoint {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: from.x + (dx / length) * distance, y: from.y + (dy / length) * distance };
}

/**
 * how far from a node's center a line should start or end, so it clears both
 * the circle and, when it heads out the bottom, the label under it.
 * @param {MicPoint} center - the node's center.
 * @param {MicPoint} toward - the point the line heads toward from the node.
 * @returns {number} distance from the center.
 */
function endpointTrim(center: MicPoint, toward: MicPoint): number {
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const headsDown = dy / (Math.hypot(dx, dy) || 1) > DOWNWARD_COS;
  return MIC_NODE_RADIUS + FLOW_GAP + (headsDown ? LABEL_CLEARANCE : 0);
}

/**
 * point on a quadratic curve.
 * @param {MicPoint} start - curve start.
 * @param {MicPoint} control - curve control point.
 * @param {MicPoint} end - curve end.
 * @param {number} t - 0 at the start, 1 at the end.
 * @returns {MicPoint} the point at t.
 */
function quadraticPoint(start: MicPoint, control: MicPoint, end: MicPoint, t: number): MicPoint {
  const a = (1 - t) * (1 - t);
  const b = 2 * (1 - t) * t;
  const c = t * t;
  return { x: a * start.x + b * control.x + c * end.x, y: a * start.y + b * control.y + c * end.y };
}

/**
 * builds the arrowhead triangle at the end of a line.
 * @param {MicPoint} tip - where the arrow points to.
 * @param {MicPoint} from - a point back along the line, sets the direction.
 * @returns {string} svg polygon points.
 */
function arrowPoints(tip: MicPoint, from: MicPoint): string {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const baseX = tip.x - ux * ARROW_LENGTH;
  const baseY = tip.y - uy * ARROW_LENGTH;
  const left = `${baseX - uy * ARROW_HALF_WIDTH},${baseY + ux * ARROW_HALF_WIDTH}`;
  const right = `${baseX + uy * ARROW_HALF_WIDTH},${baseY - ux * ARROW_HALF_WIDTH}`;
  return `${tip.x},${tip.y} ${left} ${right}`;
}

/**
 * lays out a flow line between two node centers: trimmed so it doesn't run into
 * the circles, bowed out by `bend`, with room left for the arrowhead.
 * @param {MicPoint} from - center of the node the flow leaves.
 * @param {MicPoint} to - center of the node it arrives at.
 * @param {number} bend - sideways bow as a fraction of the line's length.
 * @returns {FlowGeometry} path, arrow, label spot, and length.
 */
export function flowGeometry(from: MicPoint, to: MicPoint, bend: number): FlowGeometry {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;

  // the control point sits off the midpoint, perpendicular to the line
  const control = {
    x: (from.x + to.x) / 2 - (dy / distance) * bend * distance,
    y: (from.y + to.y) / 2 + (dx / distance) * bend * distance,
  };

  const start = stepToward(from, control, endpointTrim(from, control));
  const tip = stepToward(to, control, endpointTrim(to, control));
  const end = stepToward(tip, control, ARROW_LENGTH);

  return {
    path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
    arrow: arrowPoints(tip, control),
    labelAt: quadraticPoint(start, control, end, 0.5),
    length: Math.hypot(end.x - start.x, end.y - start.y),
  };
}

/**
 * box that fits around a set of nodes, their labels, and the group's own label.
 * @param {MicLayout} layout - the layout to read node positions from.
 * @param {MicNodeId[]} nodeIds - nodes inside the group.
 * @returns {GroupBox} the box, in svg units.
 */
export function groupBox(layout: MicLayout, nodeIds: MicNodeId[]): GroupBox {
  const points = nodeIds.map((id) => layout.positions[id]);
  const left = Math.min(...points.map((point) => point.x)) - layout.groupPadX;
  const right = Math.max(...points.map((point) => point.x)) + layout.groupPadX;
  const top = Math.min(...points.map((point) => point.y)) - GROUP_PAD_TOP;
  const bottom = Math.max(...points.map((point) => point.y)) + GROUP_PAD_BOTTOM;
  return { x: left, y: top, width: right - left, height: bottom - top };
}
