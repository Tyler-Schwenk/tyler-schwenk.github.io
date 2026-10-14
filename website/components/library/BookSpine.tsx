import type { CSSProperties } from "react";
import { seededRange } from "@/lib/seededRandom";
import type { OwnedBook } from "@/app/library/libraryData";
import styles from "./library.module.css";
import { clothClassFor } from "./bookCloth";

// spine size ranges, so the shelf looks like a real mix of books
const SPINE_MIN_WIDTH_PX = 38;
const SPINE_MAX_WIDTH_PX = 54;
const SPINE_MIN_HEIGHT_PX = 150;
const SPINE_MAX_HEIGHT_PX = 196;

type BookSpineProps = {
  book: OwnedBook;
  /** true while this book is pulled out and shown in the shelf's caption */
  selected: boolean;
  onSelect: () => void;
};

/**
 * One owned book standing on the shelf: a cloth spine with the title and author
 * running down it. it's a button, so tapping or clicking it (or Enter/Space) picks
 * it. size and color come from the book id, so they're stable.
 *
 * @param {BookSpineProps} props - The book, whether it's picked, and the pick handler.
 * @returns {JSX.Element} The spine, in a fixed-height slot that sits on the shelf plank.
 */
export default function BookSpine({ book, selected, onSelect }: BookSpineProps) {
  const spineStyle = {
    width: `${seededRange(book.id, "spine-width", SPINE_MIN_WIDTH_PX, SPINE_MAX_WIDTH_PX)}px`,
    height: `${seededRange(book.id, "spine-height", SPINE_MIN_HEIGHT_PX, SPINE_MAX_HEIGHT_PX)}px`,
  } as CSSProperties;

  return (
    <li className={styles.spineSlot}>
      <button
        type="button"
        className={`${styles.spine} ${styles[clothClassFor(book.id)]}`}
        style={spineStyle}
        title={`${book.title} by ${book.author}`}
        aria-pressed={selected}
        onClick={onSelect}
      >
        <span className={styles.spineLabel}>
          <span className={styles.spineTitle}>{book.title}</span>
          <span className={styles.spineAuthor}>{book.author}</span>
        </span>
      </button>
    </li>
  );
}
