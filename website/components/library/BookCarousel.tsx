"use client";

import { useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent, WheelEvent } from "react";
import type { ShelfBook } from "@/app/library/libraryData";
import styles from "./library.module.css";
import BookModel from "./BookModel";
import ReadingDetails from "./ReadingDetails";

// books further than this from the middle are hidden
const VISIBLE_RANGE = 3;
// a drag shorter than this is a click, not a swipe
const SWIPE_MIN_PX = 40;
// sideways trackpad scroll needed for one flip, and the pause before the next one so a
// single flick doesn't spin through the whole shelf
const WHEEL_STEP_PX = 60;
const WHEEL_COOLDOWN_MS = 300;

/**
 * how far a book is from the middle, going whichever way round the loop is shorter.
 *
 * @param {number} index - The book's position in the list.
 * @param {number} current - Position of the book in the middle.
 * @param {number} count - How many books there are.
 * @returns {number} Signed distance: negative is left of the middle, positive is right.
 */
function loopOffset(index: number, current: number, count: number): number {
  const forward = (((index - current) % count) + count) % count;
  return forward > count / 2 ? forward - count : forward;
}

/**
 * The books on my shelf as a looping cover carousel. the middle book faces front with
 * my rating and review under it; the rest angle away to each side and fade out (spines
 * showing on the left, page edges on the right). flip with the arrow buttons, the
 * arrow keys, a swipe, a sideways trackpad scroll, or by clicking a side book. it
 * loops, so flipping past the last book comes back round to the first.
 *
 * @param {object} props - Component props.
 * @param {ShelfBook[]} props.books - Owned books in shelf order. must not be empty.
 * @returns {JSX.Element} The carousel and the middle book's details.
 */
export default function BookCarousel({ books }: { books: ShelfBook[] }) {
  const [current, setCurrent] = useState(0);
  const pointerStartX = useRef<number | null>(null);
  // a mouse drag still fires a click when it ends, which mustn't count as picking a book
  const justSwiped = useRef(false);
  const wheelDelta = useRef(0);
  const lastWheelFlip = useRef(0);

  const count = books.length;
  const book = books[current];

  /** flips one book left (-1) or right (1), looping round the ends. */
  const flip = (direction: number) => {
    setCurrent((index) => (index + direction + count) % count);
  };

  /** arrow keys flip while focus is anywhere in the carousel. */
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    flip(event.key === "ArrowLeft" ? -1 : 1);
  };

  /** remembers where a drag started. */
  const handlePointerDown = (event: PointerEvent) => {
    pointerStartX.current = event.clientX;
    justSwiped.current = false;
  };

  /** flips if the drag went far enough sideways -- swipe left for the next book. */
  const handlePointerUp = (event: PointerEvent) => {
    if (pointerStartX.current === null) return;
    const dragX = event.clientX - pointerStartX.current;
    pointerStartX.current = null;
    if (Math.abs(dragX) < SWIPE_MIN_PX) return;
    justSwiped.current = true;
    flip(dragX < 0 ? 1 : -1);
  };

  /** flips on a sideways trackpad scroll, ignoring normal up/down page scrolling. */
  const handleWheel = (event: WheelEvent) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    wheelDelta.current += event.deltaX;
    if (Math.abs(wheelDelta.current) < WHEEL_STEP_PX) return;

    const direction = Math.sign(wheelDelta.current);
    wheelDelta.current = 0;
    const now = performance.now();
    if (now - lastWheelFlip.current < WHEEL_COOLDOWN_MS) return;
    lastWheelFlip.current = now;
    flip(direction);
  };

  /** brings a clicked side book to the middle (unless the click was the end of a swipe). */
  const handleBookClick = (index: number) => {
    if (justSwiped.current) {
      justSwiped.current = false;
      return;
    }
    setCurrent(index);
  };

  return (
    <div
      className={styles.carousel}
      role="region"
      aria-roledescription="carousel"
      aria-label="Books on my shelf"
      onKeyDown={handleKeyDown}
    >
      <div className={styles.carouselView}>
        <div
          className={styles.stage}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            pointerStartX.current = null;
          }}
          onWheel={handleWheel}
          // a mouse drag on a cover would start the browser's image drag, which cancels the swipe
          onDragStart={(event) => event.preventDefault()}
        >
          {books.map((shelfBook, index) => {
            const offset = loopOffset(index, current, count);
            const distance = Math.abs(offset);
            const hidden = distance > VISIBLE_RANGE;
            const slideStyle = {
              "--distance": distance,
              "--side": Math.sign(offset),
              zIndex: VISIBLE_RANGE + 1 - distance,
            } as CSSProperties;

            return (
              <button
                key={shelfBook.id}
                type="button"
                className={`${styles.slide} ${hidden ? styles.slideHidden : ""}`}
                style={slideStyle}
                aria-label={offset === 0 ? `${shelfBook.title} by ${shelfBook.author}` : `Show ${shelfBook.title}`}
                aria-current={offset === 0 ? "true" : undefined}
                aria-hidden={hidden}
                tabIndex={offset === 0 ? 0 : -1}
                onClick={() => handleBookClick(index)}
              >
                <BookModel book={shelfBook} />
                <span className={styles.slideShadow} aria-hidden="true" />
              </button>
            );
          })}
        </div>
        {count > 1 && (
          <>
            <button type="button" className={`${styles.carouselArrow} ${styles.carouselPrev}`} onClick={() => flip(-1)} aria-label="Previous book">
              {"‹"}
            </button>
            <button type="button" className={`${styles.carouselArrow} ${styles.carouselNext}`} onClick={() => flip(1)} aria-label="Next book">
              {"›"}
            </button>
          </>
        )}
      </div>

      <p className={styles.carouselCount} aria-hidden="true">
        {current + 1} / {count}
      </p>
      <p className={styles.srOnly} aria-live="polite">
        {`${book.title} by ${book.author}, ${current + 1} of ${count}`}
      </p>

      {/* keyed so the fade-in replays on every flip */}
      <div key={book.id} className={styles.carouselDetails}>
        {book.read ? (
          <ReadingDetails book={book.read} titleAs="h3" />
        ) : (
          <>
            <h3 className={styles.entryTitle}>{book.title}</h3>
            <p className={styles.entryAuthor}>{book.author}</p>
            <p className={styles.entryDate}>Haven&apos;t read it yet</p>
          </>
        )}
      </div>
    </div>
  );
}
