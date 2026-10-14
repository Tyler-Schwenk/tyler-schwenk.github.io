import type { ReadBook } from "@/app/library/libraryData";
import styles from "./library.module.css";
import BookCover from "./BookCover";
import ReadingDetails from "./ReadingDetails";

/**
 * One book in the reading log: its cover next to my rating and review.
 *
 * @param {object} props - Component props.
 * @param {ReadBook} props.book - The book.
 * @param {string | null} props.coverSrc - Cover image url, or null for the cloth fallback.
 * @returns {JSX.Element} The log entry.
 */
export default function ReadingEntry({ book, coverSrc }: { book: ReadBook; coverSrc: string | null }) {
  return (
    <li className={styles.entry}>
      <BookCover bookId={book.id} title={book.title} author={book.author} coverSrc={coverSrc} />
      <div className={styles.entryBody}>
        <ReadingDetails book={book} titleAs="h4" />
      </div>
    </li>
  );
}
