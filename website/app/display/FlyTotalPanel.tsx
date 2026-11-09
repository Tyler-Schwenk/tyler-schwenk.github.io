"use client";

import type { CSSProperties } from "react";
import { useFlyKills } from "@/lib/useFlyKills";
import styles from "@/components/flies/flies.module.css";

// the top screen's bottom edge is partly hidden, so the count sits above center
const TOTAL_CENTER_FROM_TOP_PCT = 40;

/**
 * display panel for the top screen during the fly slot: the house's total fly kills,
 * big, on the same wall as /flies. polls the backend through useFlyKills.
 *
 * @returns {JSX.Element} the panel.
 */
export default function FlyTotalPanel() {
  const { tally } = useFlyKills();
  const totalStyle: CSSProperties = { top: `${TOTAL_CENTER_FROM_TOP_PCT}%` };

  return (
    <div className={`${styles.room} ${styles.displayRoom} ${styles.totalScreen}`}>
      <div className={styles.total} style={totalStyle}>
        {/* keyed on the count so the pop animation replays on every kill */}
        <p key={tally?.total ?? "loading"} className={styles.totalCount}>
          {tally ? tally.total : "--"}
        </p>
        <p className={styles.totalLabel}>{tally?.total === 1 ? "fly killed" : "flies killed"}</p>
      </div>
    </div>
  );
}
