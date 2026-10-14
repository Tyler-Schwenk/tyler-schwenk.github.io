import type { Metadata } from "next";
import Navigation from "@/components/Navigation";
import BookCarousel from "@/components/library/BookCarousel";
import ReadingEntry from "@/components/library/ReadingEntry";
import styles from "@/components/library/library.module.css";
import { OWNED_BOOKS, READ_BOOKS, getCoverSrc, getShelfBooks, groupByYearRead } from "./libraryData";

export const metadata: Metadata = {
  title: "Library",
  description: "Books on my shelf to borrow or trade, and everything I've read with reviews",
};

/**
 * Counts things with the right plural, e.g. "1 book", "12 books".
 *
 * @param {number} count - How many.
 * @param {string} noun - Singular noun.
 * @returns {string} The count and noun.
 */
function countOf(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * The library: the bookshelf of books I own (up for borrowing or trading) and the
 * reading log of everything I've read, grouped by year. all static, built from
 * data/library.json.
 *
 * @returns {JSX.Element} Library page.
 */
export default function LibraryPage() {
  const readingYears = groupByYearRead(READ_BOOKS);
  const firstYear = readingYears[readingYears.length - 1]?.year;

  return (
    <>
      <Navigation />
      <main className={styles.page}>
        <header className={styles.masthead}>
          <p className={styles.kicker}>
            {countOf(READ_BOOKS.length, "book")} read{firstYear && ` since ${firstYear}`}
          </p>
          <h1 className={styles.title}>The Library</h1>
        </header>

        <section className={styles.section} aria-labelledby="shelf-heading">
          <h2 id="shelf-heading" className={styles.sectionHeading}>On the Shelf</h2>
          <p className={styles.note}>
            These are books ones I currently own. Let me know if you want to borrow any of them or trade!
          </p>
          {OWNED_BOOKS.length > 0 ? (
            <BookCarousel books={getShelfBooks()} />
          ) : (
            <p className={styles.note}>Still shelving. Check back soon.</p>
          )}
        </section>

        <section className={styles.section} aria-labelledby="read-heading">
          <h2 id="read-heading" className={styles.sectionHeading}>Reading Log</h2>
          {readingYears.map(({ year, books }) => (
            <div key={year} className={styles.year}>
              <h3 className={styles.yearHeading}>
                {year}
                <span className={styles.yearCount}>{countOf(books.length, "book")}</span>
              </h3>
              <ul className={styles.entries}>
                {books.map((book) => (
                  <ReadingEntry key={book.id} book={book} coverSrc={getCoverSrc(book.id)} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
