"use client";

import { FLY_KILLERS } from "@/app/flies/flyKillsApi";
import { useFlyKills } from "@/lib/useFlyKills";
import FlyPile from "./FlyPile";
import KillerCard from "./KillerCard";
import styles from "./flies.module.css";

/**
 * the whole /flies page: the scoreboard on the wall and the pile of dead flies on
 * the floor. no login, anyone can add a kill for anyone.
 *
 * the house display shows the same scene as a full-screen panel: no buttons, no
 * error line (it just keeps the last tally and retries), sized for its screen.
 *
 * @param {object} props - component props.
 * @param {boolean} [props.display] - render as the read-only /display panel.
 * @returns {JSX.Element} the page body.
 */
export default function FlyKillCounter({ display = false }: { display?: boolean }) {
  const { tally, error, addKill, removeKill } = useFlyKills();
  const killsFor = new Map(tally?.killers.map((entry) => [entry.killer, entry.kills]));
  const mostKills = tally ? Math.max(...tally.killers.map((entry) => entry.kills)) : 0;

  let headline = "Counting the bodies...";
  if (tally) headline = `${tally.total} ${tally.total === 1 ? "fly" : "flies"} down in the house`;

  return (
    <main className={display ? `${styles.room} ${styles.displayRoom}` : styles.room}>
      <section className={styles.wall}>
        <header className={styles.header}>
          <h1 className={styles.title}>Fly Kill Count</h1>
          <p className={styles.headline} aria-live="polite">{headline}</p>
        </header>

        <ul className={styles.board}>
          {FLY_KILLERS.map((killer) => {
            const kills = killsFor.get(killer) ?? null;
            return (
              <KillerCard
                key={killer}
                killer={killer}
                kills={tally ? kills ?? 0 : null}
                leading={mostKills > 0 && kills === mostKills}
                onAdd={display ? undefined : addKill}
                onRemove={display ? undefined : removeKill}
              />
            );
          })}
        </ul>

        {error && !display && <p className={styles.error} role="status">{error}</p>}
      </section>

      <section className={styles.floor} aria-label={tally ? `a pile of ${tally.total} dead flies` : "the fly pile"}>
        <div className={styles.planks} aria-hidden="true" />
        {tally && <FlyPile total={tally.total} />}
      </section>
    </main>
  );
}
