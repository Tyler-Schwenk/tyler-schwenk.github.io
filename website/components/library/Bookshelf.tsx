"use client";

import { useEffect, useRef, useState } from "react";
import type { ShelfBook } from "@/app/library/libraryData";
import styles from "./library.module.css";
import BookCover from "./BookCover";
import BookSpine from "./BookSpine";
import ReadingDetails from "./ReadingDetails";
import ShelfDecor from "./ShelfDecor";
import { layoutShelf } from "./shelfLayout";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * The shelf of owned books, lying in stacks with some decor between them. tapping
 * (or clicking) a book pulls it out and opens a drawer under the shelf with its
 * cover, my rating and my review. the drawer scrolls into view when it opens, since
 * on a phone it can be well below the book that was tapped.
 *
 * @param {object} props - Component props.
 * @param {ShelfBook[]} props.books - Owned books in shelf order.
 * @returns {JSX.Element} The shelf plus its drawer.
 */
export default function Bookshelf({ books }: { books: ShelfBook[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const selected = books.find((book) => book.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    drawerRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
  }, [selectedId]);

  /** picks a book, or puts it back if it's already the one pulled out. */
  const toggleBook = (bookId: string) => {
    setSelectedId((current) => (current === bookId ? null : bookId));
  };

  return (
    <div>
      <div className={styles.shelf}>
        {layoutShelf(books).map((item) => (
          <div key={item.id} className={styles.shelfSlot}>
            {item.kind === "decor" ? (
              <ShelfDecor kind={item.decor} />
            ) : (
              <ul className={styles.stack}>
                {item.books.map((book) => (
                  <BookSpine
                    key={book.id}
                    book={book}
                    selected={book.id === selectedId}
                    onSelect={() => toggleBook(book.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <div ref={drawerRef} className={styles.drawer} aria-live="polite">
        {selected ? (
          // keyed so the open animation replays when switching books
          <div key={selected.id} className={styles.drawerCard}>
            <BookCover bookId={selected.id} title={selected.title} author={selected.author} coverSrc={selected.coverSrc} />
            <div className={styles.entryBody}>
              {selected.read ? (
                <ReadingDetails book={selected.read} titleAs="h3" />
              ) : (
                <>
                  <h3 className={styles.entryTitle}>{selected.title}</h3>
                  <p className={styles.entryAuthor}>{selected.author}</p>
                  <p className={styles.entryDate}>Haven&apos;t read it yet</p>
                </>
              )}
            </div>
            <button type="button" className={styles.drawerClose} onClick={() => setSelectedId(null)} aria-label="Put the book back">
              {"×"}
            </button>
          </div>
        ) : (
          <p className={styles.drawerHint}>Pick a book to see what I thought of it</p>
        )}
      </div>
    </div>
  );
}
