import { API_BASE } from "@/lib/api";

/** a firing's summary. times are iso utc, temps are celsius. */
export type KilnFiring = {
  id: number;
  started_at: string;
  /** null while the firing's in progress. */
  ended_at: string | null;
  last_reading_at: string;
  peak_c: number;
  peak_at: string;
};

/** the live readout. temp and rates are null while offline or the probe has a fault. */
export type KilnStatus = {
  online: boolean;
  last_reading_at: string | null;
  thermocouple_c: number | null;
  fault_status: number | null;
  /** degrees c per hour, negative when cooling, null with under a third of the window's data. */
  rise_30m_c_per_h: number | null;
  rise_60m_c_per_h: number | null;
  firing: KilnFiring | null;
};

/** a point on a firing's curve. the temp's null when the probe had a fault. */
export type KilnCurvePoint = {
  recorded_at: string;
  thermocouple_c: number | null;
};

/** a firing and its curve. bucket_s is how much time each point averages over. */
export type KilnFiringCurve = {
  firing: KilnFiring;
  bucket_s: number;
  points: KilnCurvePoint[];
};

/**
 * gets json from one of the public kiln endpoints.
 *
 * @param {string} path - path under /kiln, with any query string.
 * @returns {Promise<T>} the parsed response.
 * @throws {Error} when the backend can't be reached or answers with an error.
 */
async function getKiln<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/kiln${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`GET /kiln${path} failed with status ${res.status}`);
  }
  return res.json();
}

/**
 * gets the live readout.
 *
 * @returns {Promise<KilnStatus>} current temperature, rates, and any firing in progress.
 */
export const fetchKilnStatus = (): Promise<KilnStatus> => getKiln("/status");

/**
 * lists firings, newest first, including one in progress.
 *
 * @returns {Promise<KilnFiring[]>} firing summaries.
 */
export const fetchKilnFirings = (): Promise<KilnFiring[]> => getKiln("/firings");

/**
 * gets a firing and its temperature curve.
 *
 * @param {number} firingId - the firing's id.
 * @param {number} [maxPoints] - the most points to return. readings get averaged to fit.
 * @returns {Promise<KilnFiringCurve>} the firing and its curve, oldest first.
 */
export const fetchKilnCurve = (firingId: number, maxPoints?: number): Promise<KilnFiringCurve> =>
  getKiln(`/firings/${firingId}/curve${maxPoints ? `?max_points=${maxPoints}` : ""}`);
