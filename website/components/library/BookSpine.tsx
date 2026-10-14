import type { CSSProperties } from "react";
import { seededRange } from "@/lib/seededRandom";
import type { ShelfBook } from "@/app/library/libraryData";
import styles from "./library.module.css";
import { clothClassFor } from "./bookCloth";

// padding ranges give each book its own width and thickness in the stack
const SPINE_MIN_PADDING_X_PX = 10;
const SPINE_MAX_PADDING_X_PX = 28;
const SPINE_MIN_PADDING_Y_PX = 5;
const SPINE_MAX_PADDING_Y_PX = 10;
// how far a book sticks out left or right of the stack's center
const SPINE_MAX_OFFSET_PX = 8;

type BookSpineProps = {
  book: ShelfBook;
  /** true while this book is pulled out and open in the shelf's drawer */
  selected: boolean;
  onSelect: () => void;
};

/**
 * One owned book lying flat in a stack, spine out, title and author reading left to
 * right. the spine takes its color from the cover (bookcloth if there's no cover).
 * it's a button, so tapping or clicking it (or Enter/Space) picks it. size and offset
 * come from the book id, so they're stable.
 *
 * @param {BookSpineProps} props - The book, whether it's picked, and the pick handler.
 * @returns {JSX.Element} The spine, as a list item in its stack.
 */
export default function BookSpine({ book, selected, onSelect }: BookSpineProps) {
  const paddingX = seededRange(book.id, "spine-padding-x", SPINE_MIN_PADDING_X_PX, SPINE_MAX_PADDING_X_PX);
  const paddingY = seededRange(book.id, "spine-padding-y", SPINE_MIN_PADDING_Y_PX, SPINE_MAX_PADDING_Y_PX);
  const offset = seededRange(book.id, "spine-offset", -SPINE_MAX_OFFSET_PX, SPINE_MAX_OFFSET_PX);
  const spineStyle: CSSProperties = {
    padding: `${paddingY}px ${paddingX}px`,
    translate: `${offset}px 0`,
    backgroundColor: book.spineColor?.background,
    color: book.spineColor?.ink,
  };
  const clothClass = book.spineColor ? "" : styles[clothClassFor(book.id)];

  return (
    <li className={styles.stackBook}>
      <button
        type="button"
        className={`${styles.spine} ${clothClass}`}
        style={spineStyle}
        aria-pressed={selected}
        onClick={onSelect}
      >
        <span className={styles.spineTitle}>{book.title}</span>
        <span className={styles.spineAuthor}>{book.author}</span>
      </button>
    </li>
  );
}
