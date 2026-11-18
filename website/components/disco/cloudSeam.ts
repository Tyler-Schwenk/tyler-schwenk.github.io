// draws one frame of the clouds parting: the cloud video split down the middle
// along a puffy, scalloped seam, with each half slid out to its side. the seam
// gets an inked outline so the cut edge looks like part of the line drawing.

/**
 * relative heights of the puffs down the seam, top to bottom. uneven so it looks
 * hand drawn. each half starts at a different spot in the list, so the two cut
 * edges don't mirror each other.
 */
const PUFF_HEIGHT_WEIGHTS = [1.3, 0.7, 1.0, 0.6, 1.2, 0.8, 1.1, 0.65, 0.9];

/** how far each puff bulges past the seam line, as a fraction of its height */
const PUFF_BULGE_RATIOS = [0.55, 0.85, 0.6, 0.95, 0.7, 0.9, 0.5, 0.8, 0.65];

const TOTAL_PUFF_WEIGHT = PUFF_HEIGHT_WEIGHTS.reduce((sum, weight) => sum + weight, 0);

/** the furthest any puff can reach past the seam line, as a fraction of the canvas height */
const MAX_BULGE_HEIGHT_RATIO = (Math.max(...PUFF_HEIGHT_WEIGHTS) / TOTAL_PUFF_WEIGHT) * Math.max(...PUFF_BULGE_RATIOS);

/** where in the lists the right half starts */
const RIGHT_SIDE_PUFF_OFFSET = 4;

/** the seam's ink, matching the dark lines of the cloud drawing */
const SEAM_INK = "rgba(45, 22, 58, 0.9)";
const SEAM_INK_WIDTH_PX = 3;

/** halves push slightly toward the viewer as they part */
const PART_ZOOM = 0.12;

type Side = "left" | "right";

/**
 * cubic ease in-out, so the clouds start slow, sweep, and settle.
 * @param {number} t - linear progress, 0 to 1.
 * @returns {number} eased progress, 0 to 1.
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * traces the scalloped seam down the middle, top to bottom, puffs bulging toward
 * the other half. every puff is centered on the same line, so neighbours meet
 * cleanly with no little jogs between them.
 * @param {CanvasRenderingContext2D} ctx - context to add the path to.
 * @param {number} width - canvas width in px.
 * @param {number} height - canvas height in px.
 * @param {Side} side - which half this seam belongs to; its puffs bulge into the other half.
 */
function traceSeam(ctx: CanvasRenderingContext2D, width: number, height: number, side: Side): void {
  const count = PUFF_HEIGHT_WEIGHTS.length;
  const offset = side === "left" ? 0 : RIGHT_SIDE_PUFF_OFFSET;
  const bulgesRight = side === "left";
  let top = 0;
  for (let i = 0; i < count; i += 1) {
    const index = (i + offset) % count;
    const puffHeight = (PUFF_HEIGHT_WEIGHTS[index] / TOTAL_PUFF_WEIGHT) * height;
    const centerY = top + puffHeight / 2;
    const bulge = puffHeight * PUFF_BULGE_RATIOS[index];
    ctx.ellipse(width / 2, centerY, bulge, puffHeight / 2, 0, -Math.PI / 2, Math.PI / 2, !bulgesRight);
    top += puffHeight;
  }
}

/**
 * draws the video into the canvas the way css object-fit: cover would.
 * @param {CanvasRenderingContext2D} ctx - context to draw on.
 * @param {HTMLVideoElement} video - the playing cloud loop.
 * @param {number} width - canvas width in px.
 * @param {number} height - canvas height in px.
 */
function drawCover(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, width: number, height: number): void {
  const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
  const drawWidth = video.videoWidth * scale;
  const drawHeight = video.videoHeight * scale;
  ctx.drawImage(video, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

/**
 * draws one half of the clouds, clipped to its side of the seam and slid outward.
 * @param {CanvasRenderingContext2D} ctx - context to draw on.
 * @param {HTMLVideoElement} video - the playing cloud loop.
 * @param {Side} side - which half.
 * @param {number} progress - eased parting progress, 0 (closed) to 1 (fully open).
 */
function drawHalf(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, side: Side, progress: number): void {
  const { width, height } = ctx.canvas;
  const direction = side === "left" ? -1 : 1;
  // far enough that the biggest puff clears the screen edge, even fully zoomed
  const travel = (width / 2 + height * MAX_BULGE_HEIGHT_RATIO) * (1 + PART_ZOOM);
  const outerEdgeX = side === "left" ? 0 : width;

  ctx.save();
  ctx.translate(direction * travel * progress, 0);
  // zoom around the half's outer edge so it swells as it leaves
  const zoom = 1 + PART_ZOOM * progress;
  ctx.translate(outerEdgeX, height / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-outerEdgeX, -height / 2);

  ctx.beginPath();
  ctx.moveTo(outerEdgeX, 0);
  traceSeam(ctx, width, height, side);
  ctx.lineTo(outerEdgeX, height);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  drawCover(ctx, video, width, height);
  ctx.restore();

  ctx.beginPath();
  traceSeam(ctx, width, height, side);
  ctx.strokeStyle = SEAM_INK;
  // the canvas may be drawn at a capped pixel ratio, so scale by what it actually uses
  ctx.lineWidth = SEAM_INK_WIDTH_PX * (width / (ctx.canvas.clientWidth || width));
  ctx.stroke();
  ctx.restore();
}

/**
 * draws the clouds part way open. the canvas is cleared first, so whatever's
 * behind it shows through the gap.
 * @param {CanvasRenderingContext2D} ctx - context of a canvas covering the screen.
 * @param {HTMLVideoElement} video - the playing cloud loop.
 * @param {number} progress - eased parting progress, 0 (closed) to 1 (fully open).
 */
export function drawPartingClouds(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, progress: number): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!video.videoWidth) {
    return;
  }
  drawHalf(ctx, video, "left", progress);
  drawHalf(ctx, video, "right", progress);
}
