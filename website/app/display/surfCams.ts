/**
 * Client for the surfcam agent running on the kiosk machine (see
 * pi/services/surfcam-agent/README.md). The agent plays the actual video in
 * mpv on top of the kiosk browser -- these calls just tell it what to do --
 * and serves each cam's current surf conditions.
 */

// the agent only listens on the kiosk machine's own loopback, so this only works when
// the page is running in the kiosk browser
export const SURFCAM_AGENT_URL = "http://127.0.0.1:8765";

const AGENT_UNREACHABLE_MESSAGE = "surfcam agent unreachable -- this panel only works on the kiosk";

/**
 * The cams, in rotation order, with the short name the shortcut menu shows.
 * Ids must match CAMS in surfcam_agent.py.
 */
export const SURF_CAMS = [
  { id: "pb", label: "Pacific Beach" },
  { id: "la-jolla-shores", label: "La Jolla Shores" },
  { id: "scripps", label: "Scripps Pier" },
  { id: "scripps-underwater", label: "Scripps underwater" },
  { id: "moonlight", label: "Moonlight Beach" },
] as const;

/** Cam ids the agent knows about. */
export type SurfCamId = (typeof SURF_CAMS)[number]["id"];

type SurfCamAction = "prepare" | "show" | "stop";

/**
 * Waves at the cam's beach, from CDIP's nearshore nowcast (total significant
 * height, peak period and direction). Direction is where they come from,
 * degrees clockwise from north.
 */
export interface WavesReading {
  height_ft: number;
  period_s: number;
  direction_deg: number;
  direction_compass: string;
  /** When the nowcast is for, formatted like "1:00 PM". */
  as_of: string;
}

/** Wind at the cam. Direction is where it comes from, degrees clockwise from north. */
export interface WindReading {
  speed_mph: number;
  gusts_mph: number | null;
  direction_deg: number;
  direction_compass: string;
  /** Where it's from, like "measured at Scripps Pier" or "forecast model". */
  note: string;
}

/** A predicted high or low inside the graph window. */
export interface TideTurn {
  at_ms: number;
  /** Formatted like "1:25 PM". */
  at: string;
  height_ft: number;
  kind: "high" | "low";
}

/** [epoch ms, height in ft] */
export type TidePoint = [number, number];

/**
 * Tide now plus the curve around it. `source` names the station when it isn't
 * at the cam. Times are epoch ms; `next_turn_at` is pre-formatted local time.
 */
export interface TideReading {
  height_ft: number;
  /** True when height_ft is the gauge's measurement, false when it's the prediction. */
  measured: boolean;
  rising: boolean;
  next_turn_kind: "high" | "low";
  next_turn_at: string;
  source: string | null;
  /** When the agent worked this out; where the graph's "now" marker goes. */
  now_ms: number;
  window_start_ms: number;
  window_end_ms: number;
  /** Predicted heights across the whole window, every 6 minutes. */
  predicted: TidePoint[];
  /** Measured heights over the past part of the window; may be empty. */
  observed: TidePoint[];
  turns: TideTurn[];
}

/** A cam's conditions, as served by GET /cams/<cam>/conditions. Missing readings are null. */
export interface SurfConditions {
  name: string;
  waves: WavesReading | null;
  wind: WindReading | null;
  tide: TideReading | null;
}

/** Either the agent's response body, or a human-readable reason it couldn't be had. */
type AgentResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

/**
 * Makes one request to the agent.
 * @param path - Path under the agent's url, like `/cams/pb/show`.
 * @param method - HTTP method.
 * @returns The decoded json body, or an error message.
 */
async function callAgent<T>(path: string, method: "GET" | "POST"): Promise<AgentResult<T>> {
  try {
    const res = await fetch(`${SURFCAM_AGENT_URL}${path}`, { method });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { data: body as T };
    return { error: body.error ?? `surfcam agent returned ${res.status}` };
  } catch {
    return { error: AGENT_UNREACHABLE_MESSAGE };
  }
}

/**
 * Sends one player action to the agent.
 * @param camId - Which cam to act on.
 * @param action - prepare (buffer hidden), show (bring fullscreen), or stop.
 * @returns null on success, or a human-readable error message.
 */
async function sendSurfCamAction(camId: SurfCamId, action: SurfCamAction): Promise<string | null> {
  const result = await callAgent<unknown>(`/cams/${camId}/${action}`, "POST");
  return result.error ?? null;
}

/**
 * Starts buffering a cam in the background, so it can appear instantly when
 * its panel comes up. Failures are only logged -- showSurfCam retries.
 * @param camId - Cam to preload.
 */
export async function prepareSurfCam(camId: SurfCamId): Promise<void> {
  const error = await sendSurfCamAction(camId, "prepare");
  if (error) console.warn(`display: could not prepare surf cam ${camId}: ${error}`);
}

/**
 * Brings a cam fullscreen (preparing it first if it wasn't already).
 * @param camId - Cam to show.
 * @returns null on success, or an error message to display.
 */
export function showSurfCam(camId: SurfCamId): Promise<string | null> {
  return sendSurfCamAction(camId, "show");
}

/**
 * Stops a cam's player and frees its memory.
 * @param camId - Cam to stop.
 */
export async function stopSurfCam(camId: SurfCamId): Promise<void> {
  await sendSurfCamAction(camId, "stop");
}

/**
 * Fetches a cam's current waves, wind and tide from the agent (cached there,
 * so this is cheap).
 * @param camId - Cam whose spot to read.
 * @returns The conditions, or an error message to display.
 */
export function fetchSurfConditions(camId: SurfCamId): Promise<AgentResult<SurfConditions>> {
  return callAgent<SurfConditions>(`/cams/${camId}/conditions`, "GET");
}
