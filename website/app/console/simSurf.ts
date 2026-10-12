import { type AgentResult, type SurfCamId, type SurfConditions, type TidePoint, type TideTurn } from "../display/surfCams";

/**
 * Made-up surf conditions for the console page, in the surfcam agent's format
 * (GET /cams/<cam>/conditions, see pi/services/surfcam-agent/README.md), so
 * the real conditions panel and the cam stand-in's overlay can show them. The
 * tide is a harmonic curve with San Diego-ish constituents, so it has the
 * real tide's mixed two-highs-two-lows shape; waves and wind drift slowly
 * through the day and are the same for everyone looking at the same moment.
 */

const TIMEZONE = "America/Los_Angeles";
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const DEG_PER_RAD = 180 / Math.PI;

// the agent's tide graph window and point spacing
const TIDE_PAST_MS = 12 * MS_PER_HOUR;
const TIDE_FUTURE_MS = 24 * MS_PER_HOUR;
const TIDE_STEP_MS = 6 * 60 * 1000;
// mean sea level above MLLW at la jolla, and the main constituents (amplitude ft, speed
// deg/hour, phase deg); the phases are arbitrary, so the times don't match the real tide
const TIDE_MEAN_FT = 2.73;
const TIDE_CONSTITUENTS = [
  { ampFt: 1.63, degPerHour: 28.984104, phaseDeg: 140 },
  { ampFt: 0.67, degPerHour: 30.0, phaseDeg: 160 },
  { ampFt: 0.38, degPerHour: 28.43973, phaseDeg: 120 },
  { ampFt: 1.12, degPerHour: 15.041069, phaseDeg: 200 },
  { ampFt: 0.71, degPerHour: 13.943035, phaseDeg: 190 },
  { ampFt: 0.35, degPerHour: 14.958931, phaseDeg: 200 },
];
// the gauge reads a little off the prediction (surge, swell setup), as it does for real
const TIDE_SURGE_FT = 0.15;
const TIDE_SURGE_PERIOD_H = 9;
const TIDE_STATION_NAME = "Scripps Pier";
// cams at the pier read its tide gauge directly; the rest get a "from Scripps Pier" tag
const PIER_CAMS: SurfCamId[] = ["scripps", "scripps-underwater"];

// waves: height, period and direction wander between these over a few days
const WAVE_HEIGHT_FT = { min: 1.5, max: 4.5 };
const WAVE_PERIOD_S = { min: 9, max: 16 };
const WAVE_DIRECTION_DEG = { min: 200, max: 290 };
const WAVE_DRIFT_PERIOD_DAYS = { height: 2.3, period: 3.1, direction: 4.7 };
// moonlight is up north in encinitas and catches a little more swell
const MOONLIGHT_WAVE_FACTOR = 1.15;
const MOONLIGHT_CAM: SurfCamId = "moonlight";

// wind: light and offshore in the morning, a westerly sea breeze in the afternoon
const WIND_MORNING = { speedMph: 3, directionDeg: 60 };
const WIND_AFTERNOON = { speedMph: 11, directionDeg: 275 };
const WIND_BREEZE_START_HOUR = 10;
const WIND_BREEZE_FULL_HOUR = 15;
const WIND_GUST_EXTRA_MPH = 6;
const MEASURED_WIND_NOTE = "measured at Scripps Pier";
const MODEL_WIND_NOTE = "forecast model";
// the cams whose wind comes from the pier's station rather than the model (the agent's CAMS)
const MEASURED_WIND_CAMS: SurfCamId[] = ["la-jolla-shores", "scripps", "scripps-underwater"];

const COMPASS_POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const COMPASS_STEP_DEG = 360 / COMPASS_POINTS.length;

// the place names the agent shows (its CAMS' site names)
const CAM_PLACE_NAMES: Record<SurfCamId, string> = {
  pb: "Pacific Beach",
  "la-jolla-shores": "La Jolla Shores",
  scripps: "Scripps Pier",
  "scripps-underwater": "Scripps Pier (underwater)",
  moonlight: "Moonlight Beach, Encinitas",
};

const clockFormat = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, hour: "numeric", minute: "2-digit" });
const hourFormat = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, hour: "numeric", hourCycle: "h23" });

/**
 * A time like the agent formats them ("1:25 PM").
 * @param atMs - Epoch ms.
 * @returns Local clock time.
 */
function formatClock(atMs: number): string {
  return clockFormat.format(atMs);
}

/**
 * A bearing as a 16-point compass name, like the agent's compass().
 * @param deg - Bearing.
 * @returns Like "WSW".
 */
function compass(deg: number): string {
  return COMPASS_POINTS[Math.round(deg / COMPASS_STEP_DEG) % COMPASS_POINTS.length];
}

/**
 * A value that wanders smoothly between min and max with a given period.
 * @param range - Bounds.
 * @param periodDays - How long one full wander takes.
 * @param atMs - Epoch ms.
 * @returns The value.
 */
function drift(range: { min: number; max: number }, periodDays: number, atMs: number): number {
  const wave = (1 + Math.sin((2 * Math.PI * atMs) / (periodDays * MS_PER_DAY))) / 2;
  return range.min + (range.max - range.min) * wave;
}

/**
 * The predicted tide height.
 * @param atMs - Epoch ms.
 * @returns Feet above MLLW.
 */
function predictedTideFt(atMs: number): number {
  const hours = atMs / MS_PER_HOUR;
  return TIDE_CONSTITUENTS.reduce(
    (height, { ampFt, degPerHour, phaseDeg }) => height + ampFt * Math.cos((degPerHour * hours - phaseDeg) / DEG_PER_RAD),
    TIDE_MEAN_FT
  );
}

/**
 * What the gauge would read: the prediction plus a slow wobble.
 * @param atMs - Epoch ms.
 * @returns Feet above MLLW.
 */
function measuredTideFt(atMs: number): number {
  return predictedTideFt(atMs) + TIDE_SURGE_FT * Math.sin((2 * Math.PI * atMs) / (TIDE_SURGE_PERIOD_H * MS_PER_HOUR));
}

/**
 * The highs and lows along a predicted curve.
 * @param points - The curve, oldest first.
 * @returns Each turn, oldest first.
 */
function findTurns(points: TidePoint[]): TideTurn[] {
  const turns: TideTurn[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const [atMs, heightFt] = points[i];
    const isHigh = heightFt > points[i - 1][1] && heightFt >= points[i + 1][1];
    const isLow = heightFt < points[i - 1][1] && heightFt <= points[i + 1][1];
    if (isHigh || isLow) turns.push({ at_ms: atMs, at: formatClock(atMs), height_ft: heightFt, kind: isHigh ? "high" : "low" });
  }
  return turns;
}

/**
 * The tide reading at a moment, in the agent's shape.
 * @param camId - Which cam (for whether the gauge counts as local).
 * @param nowMs - Epoch ms.
 * @returns The reading.
 */
function simulateTide(camId: SurfCamId, nowMs: number): NonNullable<SurfConditions["tide"]> {
  const startMs = Math.ceil((nowMs - TIDE_PAST_MS) / TIDE_STEP_MS) * TIDE_STEP_MS;
  const predicted: TidePoint[] = [];
  const observed: TidePoint[] = [];
  for (let atMs = startMs; atMs <= nowMs + TIDE_FUTURE_MS; atMs += TIDE_STEP_MS) {
    predicted.push([atMs, predictedTideFt(atMs)]);
    if (atMs <= nowMs) observed.push([atMs, measuredTideFt(atMs)]);
  }
  const turns = findTurns(predicted);
  const nextTurn = turns.find((turn) => turn.at_ms > nowMs) ?? turns[turns.length - 1];
  return {
    height_ft: measuredTideFt(nowMs),
    measured: true,
    rising: predictedTideFt(nowMs + TIDE_STEP_MS) > predictedTideFt(nowMs),
    next_turn_kind: nextTurn.kind,
    next_turn_at: nextTurn.at,
    source: PIER_CAMS.includes(camId) ? null : TIDE_STATION_NAME,
    now_ms: nowMs,
    window_start_ms: startMs,
    window_end_ms: nowMs + TIDE_FUTURE_MS,
    predicted,
    observed,
    turns,
  };
}

/**
 * How far into the afternoon sea breeze a moment is.
 * @param nowMs - Epoch ms.
 * @returns 0 in the morning (and overnight) to 1 at full breeze.
 */
function seaBreeze(nowMs: number): number {
  const hour = Number(hourFormat.format(nowMs));
  const progress = (hour - WIND_BREEZE_START_HOUR) / (WIND_BREEZE_FULL_HOUR - WIND_BREEZE_START_HOUR);
  return Math.min(Math.max(progress, 0), 1);
}

/**
 * Made-up conditions for a cam right now.
 * @param camId - Which cam.
 * @returns Conditions in the agent's format (never fails).
 */
export function simulateSurfConditions(camId: SurfCamId): SurfConditions {
  const nowMs = Date.now();
  const factor = camId === MOONLIGHT_CAM ? MOONLIGHT_WAVE_FACTOR : 1;
  const waveDirectionDeg = drift(WAVE_DIRECTION_DEG, WAVE_DRIFT_PERIOD_DAYS.direction, nowMs);
  const breeze = seaBreeze(nowMs);
  const windSpeedMph = WIND_MORNING.speedMph + (WIND_AFTERNOON.speedMph - WIND_MORNING.speedMph) * breeze;
  const windDirectionDeg = breeze > 0.5 ? WIND_AFTERNOON.directionDeg : WIND_MORNING.directionDeg;
  const measuredWind = MEASURED_WIND_CAMS.includes(camId);
  return {
    name: CAM_PLACE_NAMES[camId],
    waves: {
      height_ft: drift(WAVE_HEIGHT_FT, WAVE_DRIFT_PERIOD_DAYS.height, nowMs) * factor,
      period_s: drift(WAVE_PERIOD_S, WAVE_DRIFT_PERIOD_DAYS.period, nowMs),
      direction_deg: waveDirectionDeg,
      direction_compass: compass(waveDirectionDeg),
      // the nowcast is hourly
      as_of: formatClock(Math.floor(nowMs / MS_PER_HOUR) * MS_PER_HOUR),
    },
    wind: {
      speed_mph: windSpeedMph,
      gusts_mph: measuredWind ? windSpeedMph + WIND_GUST_EXTRA_MPH : null,
      direction_deg: windDirectionDeg,
      direction_compass: compass(windDirectionDeg),
      note: measuredWind ? MEASURED_WIND_NOTE : MODEL_WIND_NOTE,
    },
    tide: simulateTide(camId, nowMs),
  };
}

/**
 * The DisplayEnvironment's fetchSurfConditions for the console page.
 * @param camId - Which cam.
 * @returns Made-up conditions, straight away.
 */
export async function fetchSimulatedSurfConditions(camId: SurfCamId): Promise<AgentResult<SurfConditions>> {
  return { data: simulateSurfConditions(camId) };
}
