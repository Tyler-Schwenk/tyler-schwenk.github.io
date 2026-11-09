"use client";

import { FLY_KILLER_NAMES, type FlyKiller } from "@/app/flies/flyKillsApi";
import styles from "./flies.module.css";

type KillerCardProps = {
  /** whose card it is. */
  killer: FlyKiller;
  /** their kills, null while the tally's loading. */
  kills: number | null;
  /** whether they have the most kills in the house. */
  leading: boolean;
  /** logs a kill for them. leave both handlers out for a read-only tile (the display). */
  onAdd?: (killer: FlyKiller) => void;
  /** takes back their newest kill. */
  onRemove?: (killer: FlyKiller) => void;
};

/**
 * one person's scoreboard tile: name, kill count, and the buttons to add a kill or
 * take one back. without onAdd and onRemove it's just the name and count.
 *
 * @param {KillerCardProps} props - component props.
 * @returns {JSX.Element} the tile.
 */
export default function KillerCard({ killer, kills, leading, onAdd, onRemove }: KillerCardProps) {
  const name = FLY_KILLER_NAMES[killer];
  const loading = kills === null;

  return (
    <li className={`${styles.card} ${leading ? styles.cardLeading : ""}`}>
      {leading && <span className={styles.leaderTag}>Top swatter</span>}
      <h2 className={styles.cardName}>{name}</h2>
      {/* keyed on the count so the pop animation replays on every change */}
      <p key={kills ?? "loading"} className={styles.cardCount} aria-label={loading ? `${name}: loading` : `${name}: ${kills} kills`}>
        {loading ? "--" : kills}
      </p>
      {onAdd && onRemove && (
        <div className={styles.cardButtons}>
          <button
            type="button"
            className={styles.removeButton}
            onClick={() => onRemove(killer)}
            disabled={loading || kills === 0}
            aria-label={`take back one of ${name}'s kills`}
          >
            -
          </button>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => onAdd(killer)}
            disabled={loading}
            aria-label={`add a kill for ${name}`}
          >
            +1
          </button>
        </div>
      )}
    </li>
  );
}
