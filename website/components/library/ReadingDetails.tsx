import type { ReadBook } from "@/app/library/libraryData";
import styles from "./library.module.css";
import StarRating from "./StarRating";

// dates are plain calendar days, so format them in UTC or they'd slip a day west of greenwich
const READ_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

type ReadingDetailsProps = {
  book: ReadBook;
  /** heading level for the title, so it fits wherever the details are shown */
  titleAs: "h3" | "h4";
};

/**
 * What I thought of a book: title, subtitle, author, rating, the day I finished it,
 * and my review if I wrote one. shared by the reading log and the shelf carousel.
 *
 * @param {ReadingDetailsProps} props - The book and the title's heading level.
 * @returns {JSX.Element} The details, no wrapper.
 */
export default function ReadingDetails({ book, titleAs: TitleTag }: ReadingDetailsProps) {
  return (
    <>
      <TitleTag className={styles.entryTitle}>{book.title}</TitleTag>
      {book.subtitle && <p className={styles.entrySubtitle}>{book.subtitle}</p>}
      <p className={styles.entryAuthor}>{book.author}</p>
      <p className={styles.entryMeta}>
        <StarRating rating={book.rating} />
        <time dateTime={book.dateRead} className={styles.entryDate}>
          {READ_DATE_FORMAT.format(new Date(book.dateRead))}
        </time>
      </p>
      {book.review && <p className={styles.review}>{book.review}</p>}
    </>
  );
}
