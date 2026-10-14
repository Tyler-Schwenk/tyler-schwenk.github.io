import type { CSSProperties } from "react";
import { seededRange } from "@/lib/seededRandom";
import type { ShelfBook } from "@/app/library/libraryData";
import styles from "./library.module.css";
import BookCover from "./BookCover";
import { clothClassFor } from "./bookCloth";

// how thick the book is front to back -- seeded so each book's stays the same
const BOOK_MIN_THICKNESS_PX = 16;
const BOOK_MAX_THICKNESS_PX = 30;

/**
 * A book drawn as a 3D box: the cover on the front, the spine down the left side
 * (in the cover's color, or bookcloth if there's no cover), and page edges down the
 * right. turning it in 3D shows the spine or the pages, like picking up a real book.
 * it fills its parent, which needs a set size and `transform-style: preserve-3d`.
 *
 * @param {object} props - Component props.
 * @param {ShelfBook} props.book - The book to draw.
 * @returns {JSX.Element} The book, decorative only (the parent carries the label).
 */
export default function BookModel({ book }: { book: ShelfBook }) {
  const thickness = seededRange(book.id, "thickness", BOOK_MIN_THICKNESS_PX, BOOK_MAX_THICKNESS_PX);
  const spineStyle: CSSProperties = { backgroundColor: book.spineColor?.background };
  const spineClass = book.spineColor ? "" : styles[clothClassFor(book.id)];

  return (
    <span className={styles.bookModel} style={{ "--thickness": `${thickness}px` } as CSSProperties} aria-hidden="true">
      <span className={`${styles.bookFace} ${styles.bookSpine} ${spineClass}`} style={spineStyle} />
      <span className={`${styles.bookFace} ${styles.bookPages}`} />
      <span className={`${styles.bookFace} ${styles.bookFront}`}>
        <BookCover bookId={book.id} title={book.title} author={book.author} coverSrc={book.coverSrc} />
      </span>
    </span>
  );
}
