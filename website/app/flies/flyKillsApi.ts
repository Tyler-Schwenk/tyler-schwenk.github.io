import { API_BASE } from "@/lib/api";

/**
 * types and fetchers for the backend's /fly-kills endpoints (see
 * pi/docs/api/website-backend-api.md#fly-kills).
 */

/** everyone in the house, in page order. has to match FlyKiller in the backend's schemas.py. */
export const FLY_KILLERS = ["jude", "dax", "tyler", "joel"] as const;

/** one person's id, e.g. "jude". */
export type FlyKiller = (typeof FLY_KILLERS)[number];

/** names as they show on the page. */
export const FLY_KILLER_NAMES: Record<FlyKiller, string> = {
  jude: "Jude",
  dax: "Dax",
  tyler: "Tyler",
  joel: "Joel",
};

/** one person's kills. */
export type FlyKillerCount = {
  killer: FlyKiller;
  kills: number;
};

/** everyone's kills plus the size of the pile, as the backend sends it. */
export type FlyKillTally = {
  killers: FlyKillerCount[];
  total: number;
};

const FLY_KILLS_URL = `${API_BASE}/fly-kills`;

/**
 * reads a tally response, or throws with what went wrong.
 *
 * @param {Response} response - the fetch response.
 * @param {string} action - what we were doing, for the error message.
 * @returns {Promise<FlyKillTally>} the tally.
 */
async function readTally(response: Response, action: string): Promise<FlyKillTally> {
  if (!response.ok) {
    throw new Error(`couldn't ${action} (the fly counter said ${response.status})`);
  }
  return (await response.json()) as FlyKillTally;
}

/**
 * fetches everyone's kills.
 *
 * @returns {Promise<FlyKillTally>} the current tally.
 */
export async function fetchFlyKills(): Promise<FlyKillTally> {
  const response = await fetch(FLY_KILLS_URL, { cache: "no-store" });
  return readTally(response, "load the kill count");
}

/**
 * logs a kill for someone.
 *
 * @param {FlyKiller} killer - who got the fly.
 * @returns {Promise<FlyKillTally>} the tally after adding it.
 */
export async function addFlyKill(killer: FlyKiller): Promise<FlyKillTally> {
  const response = await fetch(`${FLY_KILLS_URL}/${killer}`, { method: "POST" });
  return readTally(response, `add a kill for ${FLY_KILLER_NAMES[killer]}`);
}

/**
 * takes back someone's newest kill.
 *
 * @param {FlyKiller} killer - whose kill to take back.
 * @returns {Promise<FlyKillTally>} the tally after removing it.
 */
export async function removeFlyKill(killer: FlyKiller): Promise<FlyKillTally> {
  const response = await fetch(`${FLY_KILLS_URL}/${killer}`, { method: "DELETE" });
  return readTally(response, `take back a kill from ${FLY_KILLER_NAMES[killer]}`);
}

/**
 * the tally with one person's count moved by delta, for showing a click before the
 * backend answers.
 *
 * @param {FlyKillTally} tally - the current tally.
 * @param {FlyKiller} killer - whose count changes.
 * @param {number} delta - +1 or -1.
 * @returns {FlyKillTally} a new tally.
 */
export function bumpTally(tally: FlyKillTally, killer: FlyKiller, delta: number): FlyKillTally {
  return {
    killers: tally.killers.map((entry) =>
      entry.killer === killer ? { ...entry, kills: entry.kills + delta } : entry
    ),
    total: tally.total + delta,
  };
}
