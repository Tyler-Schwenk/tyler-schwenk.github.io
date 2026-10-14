import type { ReadBook } from "@/app/library/libraryData";
import styles from "./library.module.css";
import BookCover from "./BookCover";
import StarRating from "./StarRating";

// dates are plain calendar days, so format them in UTC or they'd slip a day west of greenwich
const READ_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * One book in the reading log: cover, title, author, rating, the day I finished it,
 * and my review if I wrote one.
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
        <h4 className={styles.entryTitle}>{book.title}</h4>
        {book.subtitle && <p className={styles.entrySubtitle}>{book.subtitle}</p>}
        <p className={styles.entryAuthor}>{book.author}</p>
        <p className={styles.entryMeta}>
          <StarRating rating={book.rating} />
          <time dateTime={book.dateRead} className={styles.entryDate}>
            {READ_DATE_FORMAT.format(new Date(book.dateRead))}
          </time>
        </p>
        {book.review && <p className={styles.review}>{book.review}</p>}
      </div>
    </li>
  );
}
