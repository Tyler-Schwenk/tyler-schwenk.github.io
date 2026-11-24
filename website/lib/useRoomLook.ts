"use client";

import { useSyncExternalStore } from "react";
import type { DjRoomLook } from "@/app/opium-den/djApi";

const LOOK_STORAGE_KEY = "den-room-look";
// same-tab writes don't fire the storage event, so the setter announces itself with this
const LOOK_CHANGED_EVENT = "den-room-look-changed";
// the look for this page load, for when storage is blocked and can't hold it
let sessionLook = "";

/**
 * reads the saved look as its stored string, so useSyncExternalStore sees the same value
 * until it really changes. storage can be blocked, which just means it lasts until the page closes.
 *
 * @returns {string} the json, or "".
 */
function readLookJson(): string {
  try {
    return window.localStorage.getItem(LOOK_STORAGE_KEY) ?? sessionLook;
  } catch {
    return sessionLook;
  }
}

/**
 * turns the stored string back into a look, ignoring anything that isn't one.
 *
 * @param {string} json - what was stored.
 * @returns {DjRoomLook} the look, or null.
 */
function parseLook(json: string): DjRoomLook {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as { avatar?: unknown; photoId?: unknown };
    if (typeof value.photoId === "number") return { photoId: value.photoId };
    if (typeof value.avatar === "number") return { avatar: value.avatar };
  } catch {
    // something else wrote there; treat it as no pick
  }
  return null;
}

/**
 * listens for the look changing, in this tab or another.
 *
 * @param {() => void} onChange - called on a change.
 * @returns {() => void} unsubscribe.
 */
function subscribeLook(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(LOOK_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOOK_CHANGED_EVENT, onChange);
  };
}

/**
 * saves the look for next time, best effort.
 *
 * @param {DjRoomLook} look - the character or photo picked, or null to leave it to the pi.
 */
function saveLook(look: DjRoomLook): void {
  sessionLook = look ? JSON.stringify(look) : "";
  try {
    if (look) window.localStorage.setItem(LOOK_STORAGE_KEY, sessionLook);
    else window.localStorage.removeItem(LOOK_STORAGE_KEY);
  } catch {
    // blocked storage: it lasts until the page closes, which is fine
  }
  window.dispatchEvent(new Event(LOOK_CHANGED_EVENT));
}

/**
 * how you want to look in the live room (a character or your photo), remembered in this
 * browser like the chat name. null on the server and until one's picked.
 *
 * @returns {[DjRoomLook, (look: DjRoomLook) => void]} the look and a setter that saves it.
 */
export function useRoomLook(): [DjRoomLook, (look: DjRoomLook) => void] {
  const json = useSyncExternalStore(subscribeLook, readLookJson, () => "");
  return [parseLook(json), saveLook];
}
