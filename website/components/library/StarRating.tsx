import styles from "./library.module.css";

const MAX_STARS = 5;
const STAR_SLOTS = Array.from({ length: MAX_STARS }, (_, index) => index + 1);

/**
 * A rating out of 5 as filled and empty stars, or "unrated" when there's no rating.
 *
 * @param {object} props - Component props.
 * @param {number | null} props.rating - Whole stars, 1 to 5, or null.
 * @returns {JSX.Element} The stars, labelled for screen readers.
 */
export default function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) {
    return <span className={styles.unrated}>unrated</span>;
  }

  return (
    <span className={styles.stars} role="img" aria-label={`${rating} out of ${MAX_STARS} stars`}>
      {STAR_SLOTS.map((slot) => (
        <span key={slot} className={slot <= rating ? styles.starOn : styles.starOff}>
          {"★"}
        </span>
      ))}
    </span>
  );
}
