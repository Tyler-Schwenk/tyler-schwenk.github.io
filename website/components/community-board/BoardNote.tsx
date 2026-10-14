import type { CSSProperties } from "react";
import type { CommunityBoardLink } from "@/data/communityBoardLinks";
import styles from "./communityBoard.module.css";
import { seededPick, seededRange, seededUnit } from "@/lib/seededRandom";

const NOTE_TILT_MAX_DEG = 4;
const NOTE_SHIFT_X_MAX_PX = 6;
const NOTE_SHIFT_Y_MAX_PX = 10;
const PIN_SHIFT_MAX_PX = 14;
const TAPE_TILT_MAX_DEG = 6;
// fraction of notes held up with tape instead of a pushpin
const TAPE_PROBABILITY = 0.3;

// sticky colors are listed individually so they get picked more often than the other papers
const PAPER_CLASSES = [
  `${styles.sticky} ${styles.stickyYellow}`,
  `${styles.sticky} ${styles.stickyPink}`,
  `${styles.sticky} ${styles.stickyGreen}`,
  `${styles.sticky} ${styles.stickyBlue}`,
  `${styles.sticky} ${styles.stickyOrange}`,
  styles.indexCard,
  styles.scrap,
] as const;

// a faint stain lands somewhere in the lower-middle of each note, never fully opaque
const STAIN_POSITION_MIN_PCT = 20;
const STAIN_POSITION_MAX_PCT = 85;
const STAIN_ALPHA_MIN = 0.05;
const STAIN_ALPHA_MAX = 0.2;

// felt-tip and ballpoint are more common than pencil
const INK_CLASSES = [
  styles.inkBlack,
  styles.inkBlack,
  styles.inkBlue,
  styles.inkBlue,
  styles.inkPencil,
] as const;

const PIN_CLASSES = [
  styles.pinRed,
  styles.pinBlue,
  styles.pinGreen,
  styles.pinYellow,
  styles.pinWhite,
] as const;

/**
 * Turns a url into a short, human-readable host like "tavakessler.com".
 *
 * @param {string} href - Absolute url.
 * @returns {string} Host without "www.", or the raw href if it isn't a valid url.
 */
function displayHost(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

/**
 * Renders the fastener holding the note up. always sits in the paper's reserved
 * top strip, so it can't overlap the text.
 *
 * @param {{ seed: string }} props - Note id used to pick pin vs tape and its color/offset.
 * @returns {JSX.Element} Pushpin or tape strip.
 */
function Fastener({ seed }: { seed: string }) {
  if (seededUnit(seed, "fastener") < TAPE_PROBABILITY) {
    const tapeTiltDeg = seededRange(seed, "tape-tilt", -TAPE_TILT_MAX_DEG, TAPE_TILT_MAX_DEG);
    const style = { "--tape-rot": `${tapeTiltDeg}deg` } as CSSProperties;
    return <span className={styles.tape} style={style} aria-hidden="true" />;
  }

  const pinShiftPx = seededRange(seed, "pin-shift", -PIN_SHIFT_MAX_PX, PIN_SHIFT_MAX_PX);
  const style = { "--pin-shift": `${pinShiftPx}px` } as CSSProperties;
  const pinClass = seededPick(seed, "pin-color", PIN_CLASSES);
  return <span className={`${styles.pin} ${pinClass}`} style={style} aria-hidden="true" />;
}

/**
 * A single linked note on the community board. paper type, ink, stain, fastener,
 * tilt, and nudge are all derived from the link id, so a note looks the same on
 * every build but the board as a whole looks hand-tacked.
 *
 * @param {{ link: CommunityBoardLink }} props - Link to render.
 * @returns {JSX.Element} Anchor styled as a pinned piece of paper; opens in a new tab.
 */
export default function BoardNote({ link }: { link: CommunityBoardLink }) {
  const tiltDeg = seededRange(link.id, "tilt", -NOTE_TILT_MAX_DEG, NOTE_TILT_MAX_DEG);
  const shiftXPx = seededRange(link.id, "shift-x", -NOTE_SHIFT_X_MAX_PX, NOTE_SHIFT_X_MAX_PX);
  const shiftYPx = seededRange(link.id, "shift-y", 0, NOTE_SHIFT_Y_MAX_PX);
  const paperClass = seededPick(link.id, "paper", PAPER_CLASSES);
  const inkClass = seededPick(link.id, "ink", INK_CLASSES);
  const stainXPct = seededRange(link.id, "stain-x", STAIN_POSITION_MIN_PCT, STAIN_POSITION_MAX_PCT);
  const stainYPct = seededRange(link.id, "stain-y", STAIN_POSITION_MIN_PCT, STAIN_POSITION_MAX_PCT);
  const stainAlpha = seededRange(link.id, "stain-alpha", STAIN_ALPHA_MIN, STAIN_ALPHA_MAX);

  const style = {
    "--rot": `${tiltDeg}deg`,
    "--shift-x": `${shiftXPx}px`,
    "--shift-y": `${shiftYPx}px`,
    "--stain-x": `${stainXPct}%`,
    "--stain-y": `${stainYPct}%`,
    "--stain-alpha": stainAlpha,
  } as CSSProperties;

  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.note}
      style={style}
    >
      <span className={`${styles.paper} ${paperClass} ${inkClass}`}>
        <span className={styles.name}>{link.name}</span>
        <span className={styles.description}>{link.description}</span>
        <span className={styles.host}>{displayHost(link.href)}</span>
      </span>
      <Fastener seed={link.id} />
    </a>
  );
}
