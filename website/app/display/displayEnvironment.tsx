"use client";

import { createContext, useContext, type ComponentType } from "react";
import SurfCamPanel from "./SurfCamPanel";
import { connectBpmAgent, type BpmConnector } from "./bpmAgent";
import { reportPlayingPreset } from "./kioskControl";
import { fetchSurfConditions, type AgentResult, type SurfCamId, type SurfConditions } from "./surfCams";

/**
 * Where the display panels get what only exists on the kiosk: the bpm stream,
 * surf conditions, the surf cam video and the remote's "now playing". The
 * kiosk uses the agents on displaytop (the default); the console page swaps in
 * a simulation so the same panels run anywhere.
 */
export interface DisplayEnvironment {
  /** Opens the bpm stream. */
  connectBpm: BpmConnector;
  /** A cam's waves, wind and tide. */
  fetchSurfConditions: (camId: SurfCamId) => Promise<AgentResult<SurfConditions>>;
  /** What the monitor shows during a cam slot. Rendered keyed by cam. */
  SurfCamPanel: ComponentType<{ camId: SurfCamId }>;
  /** Tells the remote which milkdrop preset is playing (null when milkdrop closes). */
  reportPlayingPreset: (name: string | null) => void;
}

/** The real thing: the agents on displaytop. */
export const KIOSK_ENVIRONMENT: DisplayEnvironment = {
  connectBpm: connectBpmAgent,
  fetchSurfConditions,
  SurfCamPanel,
  reportPlayingPreset,
};

const DisplayEnvironmentContext = createContext<DisplayEnvironment>(KIOSK_ENVIRONMENT);

/** Puts panels below it in another environment (the console page's simulation). */
export const DisplayEnvironmentProvider = DisplayEnvironmentContext.Provider;

/**
 * The environment the panels are running in.
 * @returns The kiosk's, unless a DisplayEnvironmentProvider says otherwise.
 */
export function useDisplayEnvironment(): DisplayEnvironment {
  return useContext(DisplayEnvironmentContext);
}
