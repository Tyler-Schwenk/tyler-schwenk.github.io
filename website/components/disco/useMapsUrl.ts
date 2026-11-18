"use client";

import { useSyncExternalStore } from "react";

/**
 * which maps app a link should open:
 * - apple: iphones, ipads (which report as macs) and macs, via apple maps' universal link
 * - android: a geo: link, which opens whatever maps app the phone has set as default
 * - web: google maps in the browser, for everything else
 */
type MapsPlatform = "apple" | "android" | "web";

const APPLE_DEVICE_PATTERN = /iPhone|iPad|iPod|Macintosh/;
const ANDROID_PATTERN = /Android/;

/**
 * nothing to subscribe to, the platform doesn't change while the page is open.
 * @returns {() => void} a no-op unsubscribe.
 */
function subscribe(): () => void {
  return () => {};
}

/**
 * guesses the platform from the user agent. there's no feature to check for
 * "default maps app", so this is one of the few places sniffing is the only way.
 * @returns {MapsPlatform} the platform's maps flavor.
 */
function getSnapshot(): MapsPlatform {
  const userAgent = navigator.userAgent;
  if (APPLE_DEVICE_PATTERN.test(userAgent)) {
    return "apple";
  }
  if (ANDROID_PATTERN.test(userAgent)) {
    return "android";
  }
  return "web";
}

/**
 * the prerendered html has no browser, so it links to google maps until it hydrates.
 * @returns {MapsPlatform} always "web".
 */
function getServerSnapshot(): MapsPlatform {
  return "web";
}

/**
 * builds a link to an address for a platform's maps app.
 * @param {string} address - the street address, as you'd type it into a maps search.
 * @param {MapsPlatform} platform - which maps app to aim for.
 * @returns {string} a url that opens the address in that app.
 */
function mapsUrlFor(address: string, platform: MapsPlatform): string {
  const query = encodeURIComponent(address);
  if (platform === "apple") {
    return `https://maps.apple.com/?q=${query}`;
  }
  if (platform === "android") {
    return `geo:0,0?q=${query}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/**
 * a link that opens an address in the person's own maps app: apple maps on apple
 * devices, the default maps app on android, google maps on the web otherwise.
 * @param {string} address - the street address to open.
 * @returns {string} the maps url for this device.
 */
export function useMapsUrl(address: string): string {
  const platform = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return mapsUrlFor(address, platform);
}
