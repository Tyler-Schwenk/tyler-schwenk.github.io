/**
 * Client for the surfcam agent running on displaypi (see
 * pi/services/surfcam-agent/README.md). The agent plays the actual video in
 * mpv on top of the kiosk browser -- these calls just tell it what to do.
 */

// the agent only listens on displaypi's own loopback, so this only works when
// the page is running in the kiosk browser
const SURFCAM_AGENT_URL = "http://127.0.0.1:8765";

/** Cam ids the agent knows about. Keep in sync with CAMS in surfcam_agent.py. */
export type SurfCamId = "pb" | "scripps" | "scripps-underwater";

type SurfCamAction = "prepare" | "show" | "stop";

/**
 * Sends one action to the agent.
 * @param camId - Which cam to act on.
 * @param action - prepare (buffer hidden), show (bring fullscreen), or stop.
 * @returns null on success, or a human-readable error message.
 */
async function sendSurfCamAction(camId: SurfCamId, action: SurfCamAction): Promise<string | null> {
  try {
    const res = await fetch(`${SURFCAM_AGENT_URL}/cams/${camId}/${action}`, { method: "POST" });
    if (res.ok) return null;
    const body = await res.json().catch(() => ({}));
    return body.error ?? `surfcam agent returned ${res.status}`;
  } catch {
    return "surfcam agent unreachable -- this panel only works on displaypi";
  }
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
