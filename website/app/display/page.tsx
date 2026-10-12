"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import ControlOverlay from "./ControlOverlay";
import TrashPanel from "./TrashPanel";
import { useTrashTakeover } from "./trashTakeover";
import { msUntilNextClockSlot } from "./useClockSlot";
import { replayControl, useControlLog } from "./kioskControl";
import { CONTROL_CONFIG, PANEL_ROTATE_INTERVAL_MS, SHORTCUTS } from "./displayConfig";
import {
  BPM_VIEW_LABELS,
  DisplayScreen,
  pickSlots,
  rotationGridOffsetMs,
  useRotationClockSlot,
} from "./displayRotation";

/**
 * Always-on kiosk display page. Rotates through a fixed list of slots, each
 * pairing what the two screens show at the same time (photos on both, a surf
 * cam below with its conditions on top, etc). Only the active panel is
 * mounted, so an inactive panel's polling/timers stop automatically. Meant to
 * be opened in a kiosk browser (e.g. Chrome --kiosk) on a dedicated monitor,
 * not browsed normally.
 *
 * The kiosk opens one copy per screen with `?screen=primary|secondary|solo`:
 * primary is the external monitor (below), where mpv plays the surf cams;
 * secondary is the laptop's own screen (on top); solo is a lone screen, which
 * shows the primary side plus the keyboard overlay. No param means solo.
 *
 * The slots, shortcuts and bpm views themselves are listed in displayConfig.ts
 * (shared with the admin page's remote), and paired with panels in
 * displayRotation.tsx (shared with the console page's simulation).
 *
 * The active slot comes from the wall clock (see useClockSlot), not a timer
 * chain, so both screens switch at exactly the same moment and stay paired.
 * The kiosk keyboard can hold a slot, rotate only the cams, step through
 * slots and so on (see kioskControl.ts); both pages replay the same key log,
 * so they stay paired through that too.
 *
 * A panel with slow startup (a live video stream) can define `prepare`,
 * which fires PANEL_PREPARE_LEAD_MS before the panel is due on screen so it
 * can load in the background and appear already running.
 *
 * Bpm mode isn't in the rotation: it's only shown from its key (b), since it
 * keeps the mic recording while it's up. It cycles through its own views
 * (BPM_VIEWS) on the same clock as the rotation, or holds one.
 *
 * Trash night overrides all of it: while fart-pi says it's trash time (and for
 * the thanks screen after), TrashPanel replaces whatever's up, nothing gets
 * prepared, and the keyboard overlay is hidden (see trashTakeover.ts). The
 * rotation carries on underneath on the clock, so it picks up where it would
 * have been.
 *
 * Planned panels not yet implemented (add to displayRotation.tsx as each one is built,
 * using PlaceholderPanel to stub it out first if useful): MTS trolley info,
 * Pac-Tyler bike map, server status.
 */

type ScreenRole = "primary" | "secondary" | "solo";

// how long before a panel is due on screen its `prepare` hook fires. needs to
// cover the slowest panel's startup (mpv launch + first buffer)
const PANEL_PREPARE_LEAD_MS = 5_000;

const SCREEN_ROLE_PARAM = "screen";

/**
 * Reads this screen's role from the `?screen=` query param.
 * @returns The role, solo when missing or unrecognised.
 */
function readScreenRole(): ScreenRole {
  const role = new URLSearchParams(window.location.search).get(SCREEN_ROLE_PARAM);
  return role === "primary" || role === "secondary" ? role : "solo";
}

/**
 * useSyncExternalStore subscription for values that never change (the url).
 * @returns A no-op unsubscribe function.
 */
function subscribeNever(): () => void {
  return () => {};
}

// the page is statically exported, so there's no url at build time; the role reads as
// null on the server and the page renders black until it hydrates
const readNothingOnServer = () => null;

export default function DisplayPage() {
  const role = useSyncExternalStore(subscribeNever, readScreenRole, readNothingOnServer);
  const controlLog = useControlLog();
  const trash = useTrashTakeover();
  const state = useMemo(() => replayControl(controlLog, CONTROL_CONFIG), [controlLog]);
  const gridOffsetMs = rotationGridOffsetMs(state);
  const clockSlot = useRotationClockSlot(state);
  const side = role === "secondary" ? "secondary" : "primary";
  const slots = clockSlot === null ? null : pickSlots(state, clockSlot);
  // nothing's due next while trash night has the screens
  const nextPanel = trash ? null : (slots?.next?.[side] ?? null);

  useEffect(() => {
    if (!nextPanel?.prepare) return;
    const prepareTimer = setTimeout(
      () => nextPanel.prepare?.(),
      Math.max(0, msUntilNextClockSlot(PANEL_ROTATE_INTERVAL_MS, gridOffsetMs) - PANEL_PREPARE_LEAD_MS)
    );
    return () => clearTimeout(prepareTimer);
  }, [nextPanel, gridOffsetMs]);

  if (!role || clockSlot === null) return <div className="fixed inset-0 bg-black" />;
  if (trash) return <TrashPanel takeover={trash} role={role} />;
  return (
    <>
      <DisplayScreen side={side} state={state} clockSlot={clockSlot} />
      {role !== "primary" && <ControlOverlay state={state} shortcuts={SHORTCUTS} bpmViewLabels={BPM_VIEW_LABELS} />}
    </>
  );
}
