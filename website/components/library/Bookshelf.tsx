"use client";

import { useState } from "react";
import type { OwnedBook } from "@/app/library/libraryData";
import styles from "./library.module.css";
import BookSpine from "./BookSpine";

type BookshelfProps = {
  books: OwnedBook[];
  /** ids of books that also have a reading log entry, so the caption can link to it */
  readIds: string[];
};

/**
 * The shelf of owned books. spine titles get cut off and phones can't hover, so
 * tapping (or clicking) a spine pulls it out and shows its full title and author in
 * a caption bar. while a book's picked the bar sticks to the bottom of the screen
 * (as long as the shelf's in view), so it's visible even when the shelf is taller than
 * the phone. with nothing picked it just sits under the shelf, out of the way.
 *
 * @param {BookshelfProps} props - Owned books, and which of them have been read.
 * @returns {JSX.Element} The shelf plus its caption bar.
 */
export default function Bookshelf({ books, readIds }: BookshelfProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = books.find((book) => book.id === selectedId) ?? null;

  /** picks a book, or puts it back if it's already the one pulled out. */
  const toggleBook = (bookId: string) => {
    setSelectedId((current) => (current === bookId ? null : bookId));
  };

  return (
    <div>
      <ul className={styles.shelf}>
        {books.map((book) => (
          <BookSpine
            key={book.id}
            book={book}
            selected={book.id === selectedId}
            onSelect={() => toggleBook(book.id)}
          />
        ))}
      </ul>
      <div className={`${styles.caption} ${selected ? styles.captionPinned : ""}`} aria-live="polite">
        {selected ? (
          <>
            <p className={styles.captionText}>
              <span className={styles.captionTitle}>{selected.title}</span>
              <span className={styles.captionAuthor}>{selected.author}</span>
            </p>
            {readIds.includes(selected.id) && (
              <a href={`#read-${selected.id}`} className={styles.captionLink}>
                In my reading log
              </a>
            )}
            <button type="button" className={styles.captionClose} onClick={() => setSelectedId(null)} aria-label="Put the book back">
              {"×"}
            </button>
          </>
        ) : (
          <p className={styles.captionHint}>Pick a book to see what it is</p>
        )}
      </div>
    </div>
  );
}
