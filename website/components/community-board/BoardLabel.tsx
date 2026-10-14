import type { CSSProperties, ElementType } from "react";
import styles from "./communityBoard.module.css";
import { seededRange } from "@/lib/seededRandom";

const LABEL_TILT_MAX_DEG = 2.5;

type BoardLabelProps = {
  /** stable id, seeds the tilt */
  id: string;
  text: string;
  /** heading level to render, so the board title and section labels share one look */
  as?: ElementType;
  className?: string;
};

/**
 * A strip of masking tape with marker writing on it, used for the board title
 * and section headings.
 *
 * @param {BoardLabelProps} props - Label id, text, heading element, and extra class.
 * @returns {JSX.Element} Tilted tape label.
 */
export default function BoardLabel({ id, text, as: Heading = "h2", className = "" }: BoardLabelProps) {
  const tiltDeg = seededRange(id, "label-tilt", -LABEL_TILT_MAX_DEG, LABEL_TILT_MAX_DEG);
  const style = { "--rot": `${tiltDeg}deg` } as CSSProperties;

  return (
    <Heading className={`${styles.label} ${className}`} style={style}>
      {text}
    </Heading>
  );
}
