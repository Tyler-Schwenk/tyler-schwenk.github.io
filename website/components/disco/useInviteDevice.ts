"use client";

import { useSyncExternalStore } from "react";

// a touch-first device without hover is a phone or tablet. this beats sniffing the
// user agent, and a touchscreen laptop still counts as desktop since it can hover.
const MOBILE_QUERY = "(pointer: coarse) and (hover: none)";
const PORTRAIT_QUERY = "(orientation: portrait)";

export interface InviteDevice {
  /** false until the page is running in a browser, so nothing decides on a guess */
  known: boolean;
  isMobile: boolean;
  /** only meaningful on mobile; desktops never get asked to rotate */
  isPortrait: boolean;
}

const UNKNOWN_DEVICE: InviteDevice = { known: false, isMobile: false, isPortrait: false };

// snapshots have to be stable between renders, so they're cached by a key
const deviceCache = new Map<string, InviteDevice>();

/**
 * re-renders subscribers whenever the device class or orientation changes.
 * @param {() => void} onChange - react's store change callback.
 * @returns {() => void} unsubscribes from both media queries.
 */
function subscribe(onChange: () => void): () => void {
  const queries = [window.matchMedia(MOBILE_QUERY), window.matchMedia(PORTRAIT_QUERY)];
  queries.forEach((query) => query.addEventListener("change", onChange));
  return () => queries.forEach((query) => query.removeEventListener("change", onChange));
}

/**
 * reads the current device class and orientation.
 * @returns {InviteDevice} a cached object, the same one every time nothing's changed.
 */
function getSnapshot(): InviteDevice {
  const isMobile = window.matchMedia(MOBILE_QUERY).matches;
  const isPortrait = window.matchMedia(PORTRAIT_QUERY).matches;
  const key = `${isMobile}-${isPortrait}`;
  const cached = deviceCache.get(key);
  if (cached) {
    return cached;
  }
  const device = { known: true, isMobile, isPortrait };
  deviceCache.set(key, device);
  return device;
}

/**
 * the static export has no browser, so the prerendered html starts unknown.
 * @returns {InviteDevice} the unknown placeholder.
 */
function getServerSnapshot(): InviteDevice {
  return UNKNOWN_DEVICE;
}

/**
 * tracks whether the invite is open on a phone and which way the phone's held.
 * @returns {InviteDevice} live device info, updating as the phone rotates.
 */
export function useInviteDevice(): InviteDevice {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
