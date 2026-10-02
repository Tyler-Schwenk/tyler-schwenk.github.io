/**
 * Client for the surfcam agent running on the kiosk machine (see
 * pi/services/surfcam-agent/README.md). The agent plays the actual video in
 * mpv on top of the kiosk browser -- these calls just tell it what to do --
 * and serves each cam's current surf conditions.
 */

// the agent only listens on the kiosk machine's own loopback, so this only works when
// the page is running in the kiosk browser
const SURFCAM_AGENT_URL = "http://127.0.0.1:8765";

const AGENT_UNREACHABLE_MESSAGE = "surfcam agent unreachable -- this panel only works on the kiosk";

/** Cam ids the agent knows about. Keep in sync with CAMS in surfcam_agent.py. */
export type SurfCamId = "pb" | "la-jolla-shores" | "scripps-underwater";

type SurfCamAction = "prepare" | "show" | "stop";

/** Swell at the cam. Direction is where it comes from, degrees clockwise from north. */
export interface SwellReading {
  height_ft: number;
  period_s: number;
  direction_deg: number;
  direction_compass: string;
}

/** Wind at the cam. Direction is where it comes from, degrees clockwise from north. */
export interface WindReading {
  speed_mph: number;
  gusts_mph: number | null;
  direction_deg: number;
  direction_compass: string;
}

/** Tide right now. `source` names the station when it isn't at the cam. */
export interface TideReading {
  height_ft: number;
  rising: boolean;
  next_turn_kind: "high" | "low";
  /** Already formatted in the cams' local time, like "1:25 PM". */
  next_turn_at: string;
  source: string | null;
}

/** A cam's conditions, as served by GET /cams/<cam>/conditions. Missing readings are null. */
export interface SurfConditions {
  name: string;
  swell: SwellReading | null;
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
 * Fetches a cam's current swell, wind and tide from the agent (cached there,
 * so this is cheap).
 * @param camId - Cam whose spot to read.
 * @returns The conditions, or an error message to display.
 */
export function fetchSurfConditions(camId: SurfCamId): Promise<AgentResult<SurfConditions>> {
  return callAgent<SurfConditions>(`/cams/${camId}/conditions`, "GET");
}
