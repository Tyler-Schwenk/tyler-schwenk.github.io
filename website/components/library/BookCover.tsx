import styles from "./library.module.css";
import { clothClassFor } from "./bookCloth";

type BookCoverProps = {
  bookId: string;
  title: string;
  author: string;
  /** cover image url, or null to draw a plain cloth binding instead */
  coverSrc: string | null;
};

/**
 * A book's cover, or a plain cloth binding with the title stamped on it when there's
 * no cover image. the image is decorative -- the title's always right next to it.
 *
 * @param {BookCoverProps} props - Book id, title, author and optional cover url.
 * @returns {JSX.Element} The cover.
 */
export default function BookCover({ bookId, title, author, coverSrc }: BookCoverProps) {
  if (coverSrc) {
    // plain img: the site's a static export with unoptimized images anyway
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={coverSrc} alt="" loading="lazy" className={styles.cover} />;
  }

  return (
    <div className={`${styles.cover} ${styles.clothCover} ${styles[clothClassFor(bookId)]}`} aria-hidden="true">
      <span className={styles.clothTitle}>{title}</span>
      <span className={styles.clothAuthor}>{author}</span>
    </div>
  );
}
