import type { CSSProperties, ElementType } from "react";

import { DISCO_LETTER_COLORS } from "./constants";
import styles from "./disco.module.css";

// letters pop in out of order like the video's titles. stepping through them by a
// prime stride scatters the order without randomness, so the prerendered html and
// the browser agree. (a length that's a multiple of it just pops in left to right.)
const POP_IN_STRIDE = 7;
const POP_IN_STAGGER_MS = 45;

/** one full trip through the palette, matching the letterColors keyframes */
const COLOR_CYCLE_MS = 3000;

interface DiscoTextProps {
  text: string;
  /** the element to render, e.g. "h1". defaults to a span */
  as?: ElementType;
  className?: string;
  /** added to every letter's pop-in delay, to sequence lines one after another */
  delayMs?: number;
}

/**
 * text in the invite video's style: each letter its own color from the palette,
 * popping in out of order, then the colors chase along the line. words never break mid-word.
 * @param {DiscoTextProps} props - the text, wrapper element, class, and starting delay.
 * @returns {JSX.Element} the text with the full string as its accessible label.
 */
export default function DiscoText({ text, as: Tag = "span", className, delayMs = 0 }: DiscoTextProps) {
  const letterCount = text.replace(/\s/g, "").length;
  const paletteSize = DISCO_LETTER_COLORS.length;
  const colorStepMs = COLOR_CYCLE_MS / paletteSize;
  const stride = letterCount % POP_IN_STRIDE === 0 ? 1 : POP_IN_STRIDE;
  let letterIndex = 0;

  const words = text.split(" ").map((word, wordIndex) => {
    const letters = Array.from(word).map((char) => {
      const index = letterIndex;
      letterIndex += 1;
      const popInOrder = (index * stride) % Math.max(letterCount, 1);
      // a negative delay starts each letter part way through the color cycle,
      // so its first color is palette[index] and neighbours never match
      const style: CSSProperties = {
        color: DISCO_LETTER_COLORS[index % paletteSize],
        animationDelay: `${delayMs + popInOrder * POP_IN_STAGGER_MS}ms, ${-(index % paletteSize) * colorStepMs}ms`,
      };
      return (
        <span key={index} className={styles.letter} style={style}>
          {char}
        </span>
      );
    });
    return (
      <span key={wordIndex} className={styles.word}>
        {letters}
      </span>
    );
  });

  // spaces between word spans so lines can wrap there
  const spaced = words.flatMap((word, i) => (i === 0 ? [word] : [" ", word]));

  return (
    <Tag className={className} aria-label={text}>
      <span aria-hidden="true">{spaced}</span>
    </Tag>
  );
}
