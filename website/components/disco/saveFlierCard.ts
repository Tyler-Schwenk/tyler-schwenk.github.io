// draws a still version of the flier as a png people can keep, and hands it to
// the phone's share sheet (so it can go straight to photos) or downloads it.
// drawn by hand on a canvas instead of screenshotting the page, so it looks the
// same on every device and doesn't need a library.

import {
  BOX_ROW_COUNT,
  DIAMOND_ROW_COUNT,
  DISCO_DETAILS,
  DISCO_LETTER_COLORS,
  DISCO_PAGE_URL_TEXT,
  NIGHT_SKY_BOTTOM,
  NIGHT_SKY_TOP,
  ORNAMENT_BLUE,
  ORNAMENT_LIME,
  ORNAMENT_TEAL,
} from "./constants";
import { STARS } from "./Ornaments";

/** 4:5, the shape phones show biggest in a camera roll or a story */
const CARD_WIDTH_PX = 1080;
const CARD_HEIGHT_PX = 1350;
const CARD_FILE_NAME = "disco-december.png";
const CARD_MIME_TYPE = "image/png";

// safari can drop a download if its object url is revoked in the same tick as the click
const DOWNLOAD_URL_LIFETIME_MS = 10000;

const STAR_SIZE_SCALE = 1.6;
const STAR_GLOW_PX = 8;

const BOX_SIZE_PX = 52;
const BOX_GAP_PX = 14;
const BOX_RING_STEP_PX = 6;
const BOX_RING_COUNT = 4;
const BOX_ROW_Y_PX = 110;

const TITLE_FONT_PX = 150;
const TITLE_LINE_HEIGHT_PX = 170;
const TITLE_FIRST_BASELINE_PX = 340;

const DIAMOND_SIZE_PX = 22;
const DIAMOND_GAP_PX = 58;
const DIAMOND_ROW_Y_PX = 590;

const LABEL_FONT_PX = 26;
const VALUE_FONT_PX = 50;
const VALUE_LINE_PX = 60;
const DETAILS_START_Y_PX = 680;
const LABEL_TO_VALUE_PX = 70;
const DETAIL_GAP_PX = 50;

const HIGHLIGHT_FONT_PX = 36;
const HIGHLIGHT_LINE_PX = 56;
const HIGHLIGHTS_GAP_PX = 30;

const URL_FONT_PX = 28;
const URL_BOTTOM_MARGIN_PX = 50;

const OUTLINE_PX = 3;
const LETTER_SHADOW_PX = 18;

export interface FlierCardInfo {
  title: string;
}

export type SaveResult = "shared" | "downloaded" | "cancelled";

/**
 * finds the actual family name next/font gave the disco font. it's hashed, so it
 * has to be read off the css variable the root layout sets.
 * @returns {string} a css font-family list starting with the disco font.
 */
function discoFontFamily(): string {
  const family = getComputedStyle(document.body).getPropertyValue("--font-disco").trim();
  return family || "Georgia, serif";
}

/**
 * makes sure the disco font is loaded, since canvas text silently falls back to a
 * default font if it isn't. only the first family is loaded: next/font's fallback
 * face points at a local font (times new roman) that plenty of phones don't have,
 * and loading a missing local font rejects the whole load. if the disco font
 * itself won't load, the card still gets drawn, just in a fallback font.
 * @param {string} family - the css font-family list from discoFontFamily.
 */
async function loadDiscoFont(family: string): Promise<void> {
  const primaryFamily = family.split(",")[0].trim();
  try {
    await document.fonts.load(`${TITLE_FONT_PX}px ${primaryFamily}`);
  } catch (error) {
    console.warn(`disco invite: couldn't load ${primaryFamily} for the saved card, drawing it in a fallback font`, error);
  }
}

/**
 * draws text one letter at a time, each in the next palette color, centered on a point.
 * @param {CanvasRenderingContext2D} ctx - card context, with its font already set.
 * @param {string} text - the line to draw.
 * @param {number} centerX - horizontal center in px.
 * @param {number} baselineY - baseline in px.
 */
function drawPaletteLine(ctx: CanvasRenderingContext2D, text: string, centerX: number, baselineY: number): void {
  let x = centerX - ctx.measureText(text).width / 2;
  let colorIndex = 0;
  ctx.textAlign = "left";
  for (const char of text) {
    if (char.trim()) {
      ctx.fillStyle = DISCO_LETTER_COLORS[colorIndex % DISCO_LETTER_COLORS.length];
      colorIndex += 1;
      ctx.fillText(char, x, baselineY);
    }
    x += ctx.measureText(char).width;
  }
}

/**
 * fills the background: the night sky gradient and the same stars as the page.
 * @param {CanvasRenderingContext2D} ctx - card context.
 */
function drawSky(ctx: CanvasRenderingContext2D): void {
  const sky = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT_PX);
  sky.addColorStop(0, NIGHT_SKY_TOP);
  sky.addColorStop(1, NIGHT_SKY_BOTTOM);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CARD_WIDTH_PX, CARD_HEIGHT_PX);

  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "rgba(200, 200, 255, 0.8)";
  ctx.shadowBlur = STAR_GLOW_PX;
  for (const star of STARS) {
    ctx.beginPath();
    const radius = (star.sizePx * STAR_SIZE_SCALE) / 2;
    ctx.arc((star.leftPct / 100) * CARD_WIDTH_PX, (star.topPct / 100) * CARD_HEIGHT_PX, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * the concentric lime and blue squares across the top.
 * @param {CanvasRenderingContext2D} ctx - card context.
 */
function drawBoxRow(ctx: CanvasRenderingContext2D): void {
  const rowWidth = BOX_ROW_COUNT * BOX_SIZE_PX + (BOX_ROW_COUNT - 1) * BOX_GAP_PX;
  const startX = (CARD_WIDTH_PX - rowWidth) / 2;
  ctx.lineWidth = OUTLINE_PX;
  for (let i = 0; i < BOX_ROW_COUNT; i += 1) {
    const x = startX + i * (BOX_SIZE_PX + BOX_GAP_PX);
    for (let ring = 0; ring < BOX_RING_COUNT; ring += 1) {
      const inset = ring * BOX_RING_STEP_PX;
      ctx.strokeStyle = ring % 2 === 0 ? ORNAMENT_LIME : ORNAMENT_BLUE;
      ctx.strokeRect(x + inset, BOX_ROW_Y_PX + inset, BOX_SIZE_PX - inset * 2, BOX_SIZE_PX - inset * 2);
    }
  }
}

/**
 * the teal diamonds under the title.
 * @param {CanvasRenderingContext2D} ctx - card context.
 */
function drawDiamondRow(ctx: CanvasRenderingContext2D): void {
  const rowWidth = (DIAMOND_ROW_COUNT - 1) * DIAMOND_GAP_PX;
  const startX = (CARD_WIDTH_PX - rowWidth) / 2;
  ctx.lineWidth = OUTLINE_PX;
  for (let i = 0; i < DIAMOND_ROW_COUNT; i += 1) {
    ctx.save();
    ctx.translate(startX + i * DIAMOND_GAP_PX, DIAMOND_ROW_Y_PX);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = ORNAMENT_TEAL;
    ctx.strokeRect(-DIAMOND_SIZE_PX / 2, -DIAMOND_SIZE_PX / 2, DIAMOND_SIZE_PX, DIAMOND_SIZE_PX);
    ctx.restore();
  }
}

/** when and where, each a label over one or more lines */
const CARD_FACTS = [
  { label: "WHEN", lines: [`${DISCO_DETAILS.date} - ${DISCO_DETAILS.time}`] },
  { label: "WHERE", lines: [DISCO_DETAILS.addressStreet, DISCO_DETAILS.addressCity] },
];

/** the lines under the facts, in the palette colors */
const CARD_HIGHLIGHTS = [
  DISCO_DETAILS.lineup.join(" + "),
  `Attire: ${DISCO_DETAILS.attire}`,
  DISCO_DETAILS.phones,
];

/**
 * when, where, the lineup and the rest, then the page address.
 * @param {CanvasRenderingContext2D} ctx - card context.
 * @param {string} family - the disco font family list.
 */
function drawDetails(ctx: CanvasRenderingContext2D, family: string): void {
  const centerX = CARD_WIDTH_PX / 2;
  let y = DETAILS_START_Y_PX;
  ctx.textAlign = "center";
  for (const fact of CARD_FACTS) {
    ctx.font = `${LABEL_FONT_PX}px ${family}`;
    ctx.fillStyle = ORNAMENT_TEAL;
    ctx.fillText(fact.label, centerX, y);
    ctx.font = `${VALUE_FONT_PX}px ${family}`;
    ctx.fillStyle = DISCO_LETTER_COLORS[1];
    fact.lines.forEach((line, i) => {
      ctx.fillText(line, centerX, y + LABEL_TO_VALUE_PX + i * VALUE_LINE_PX);
    });
    y += LABEL_TO_VALUE_PX + (fact.lines.length - 1) * VALUE_LINE_PX + DETAIL_GAP_PX + LABEL_FONT_PX;
  }

  ctx.font = `${HIGHLIGHT_FONT_PX}px ${family}`;
  const highlightsTop = y + HIGHLIGHTS_GAP_PX;
  CARD_HIGHLIGHTS.forEach((line, i) => {
    drawPaletteLine(ctx, line, centerX, highlightsTop + i * HIGHLIGHT_LINE_PX);
  });

  ctx.textAlign = "center";
  ctx.font = `${URL_FONT_PX}px ${family}`;
  ctx.fillStyle = ORNAMENT_TEAL;
  ctx.fillText(DISCO_PAGE_URL_TEXT, centerX, CARD_HEIGHT_PX - URL_BOTTOM_MARGIN_PX);
}

/**
 * draws the whole card. do this ahead of time: ios only allows the share sheet
 * right after a tap, and drawing first can use up that window.
 * @param {FlierCardInfo} info - the event's title.
 * @returns {Promise<Blob>} the card as a png.
 * @throws {Error} if the browser can't give a 2d canvas or encode the png.
 */
export async function renderFlierCard(info: FlierCardInfo): Promise<Blob> {
  const family = discoFontFamily();
  await loadDiscoFont(family);

  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH_PX;
  canvas.height = CARD_HEIGHT_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("couldn't get a 2d canvas to draw the flier on; this browser may have canvas turned off");
  }

  drawSky(ctx);
  drawBoxRow(ctx);

  ctx.save();
  ctx.font = `${TITLE_FONT_PX}px ${family}`;
  ctx.shadowColor = DISCO_LETTER_COLORS[3];
  ctx.shadowBlur = LETTER_SHADOW_PX;
  info.title.split(" ").forEach((word, i) => {
    drawPaletteLine(ctx, word, CARD_WIDTH_PX / 2, TITLE_FIRST_BASELINE_PX + i * TITLE_LINE_HEIGHT_PX);
  });
  ctx.restore();

  drawDiamondRow(ctx);
  drawDetails(ctx, family);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("the browser couldn't turn the flier canvas into a png; try a screenshot instead"));
    }, CARD_MIME_TYPE);
  });
}

/**
 * downloads a blob as a file, for browsers without file sharing (mostly desktop).
 * @param {Blob} blob - the file contents.
 */
function downloadBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = CARD_FILE_NAME;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
}

/**
 * gets a rendered flier card to the person: the share sheet on phones (where
 * "save image" puts it in photos), a download everywhere else. call it straight
 * from the tap handler with a card that's already rendered.
 * @param {Blob} card - the png from renderFlierCard.
 * @param {string} title - the share sheet's title.
 * @param {boolean} preferShare - use the share sheet when the browser has one. desktop
 *   browsers often do too, but people there just want the file, so pass false for them.
 * @returns {Promise<SaveResult>} how it went out, or "cancelled" if they closed the share sheet.
 * @throws {Error} if sharing fails for any reason besides cancelling.
 */
export async function deliverFlierCard(card: Blob, title: string, preferShare: boolean): Promise<SaveResult> {
  const file = new File([card], CARD_FILE_NAME, { type: CARD_MIME_TYPE });

  if (!preferShare || !navigator.canShare?.({ files: [file] })) {
    downloadBlob(card);
    return "downloaded";
  }

  try {
    await navigator.share({ files: [file], title });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return "cancelled";
    }
    throw error;
  }
}
