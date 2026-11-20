"use client";

import { useCallback, useSyncExternalStore } from "react";
import { fetchDjChat, sendDjChat, type DjChatMessage } from "@/app/opium-den/djApi";
import { usePoll } from "@/lib/usePoll";

// quick enough to feel like a chat, light enough for a handful of people on the pi
const CHAT_POLL_INTERVAL_MS = 3000;
const NICKNAME_STORAGE_KEY = "den-chat-nickname";
// same-tab writes don't fire the storage event, so the setter announces itself with this
const NICKNAME_CHANGED_EVENT = "den-chat-nickname-changed";
// the name for this page load, for when storage is blocked and can't hold it
let sessionNickname = "";
// this browser's secret key, which holds whatever chat name it sends with first in a set
const OWNER_KEY_STORAGE_KEY = "den-chat-key";
// the key for this page load, for when storage is blocked
let sessionOwnerKey = "";

/** what useDjChat hands back. */
export type DjChat = {
  /** the room's messages, oldest first. null until the first load. */
  messages: DjChatMessage[] | null;
  /** why the last load failed, null when it worked. */
  error: string | null;
  /** sends a message and shows it right away. throws with a readable reason (ChatNameTakenError when the name's someone else's). */
  send: (nickname: string, content: string) => Promise<void>;
};

/**
 * this browser's chat owner key: made once and kept in localStorage, so its name stays
 * its own for the rest of the set, reloads included. with storage blocked it only lasts
 * the page load, so a reload mid-set can't get the same name back until the next set.
 *
 * @returns {string} the key, a random uuid.
 */
function ownerKey(): string {
  try {
    const stored = window.localStorage.getItem(OWNER_KEY_STORAGE_KEY);
    if (stored) return stored;
    const created = sessionOwnerKey || crypto.randomUUID();
    window.localStorage.setItem(OWNER_KEY_STORAGE_KEY, created);
    return created;
  } catch {
    sessionOwnerKey ||= crypto.randomUUID();
    return sessionOwnerKey;
  }
}

/**
 * the live room's chat: the recent messages, re-fetched every few seconds while the tab's
 * visible (whole room each time, so moderated messages vanish too), and a way to send.
 *
 * @returns {DjChat} the messages, the last error, and send.
 */
export function useDjChat(): DjChat {
  const { data, error, setData } = usePoll(fetchDjChat, CHAT_POLL_INTERVAL_MS);

  const send = useCallback(
    async (nickname: string, content: string) => {
      const sent = await sendDjChat(nickname, content, ownerKey());
      // the next poll brings it back anyway, this just skips the wait
      setData((current) => {
        if (!current) return [sent];
        return current.some((message) => message.id === sent.id) ? current : [...current, sent];
      });
    },
    [setData]
  );

  return { messages: data, error, send };
}

/**
 * reads the saved nickname. storage can be blocked (private windows, previews), which
 * just means the name only lasts until the page closes.
 *
 * @returns {string} the nickname, or "".
 */
function readNickname(): string {
  try {
    return window.localStorage.getItem(NICKNAME_STORAGE_KEY) ?? sessionNickname;
  } catch {
    return sessionNickname;
  }
}

/**
 * listens for the nickname changing, in this tab or another.
 *
 * @param {() => void} onChange - called on a change.
 * @returns {() => void} unsubscribe.
 */
function subscribeNickname(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(NICKNAME_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(NICKNAME_CHANGED_EVENT, onChange);
  };
}

/**
 * saves the nickname for next time, best effort.
 *
 * @param {string} nickname - the new name, "" to forget it.
 */
function saveNickname(nickname: string): void {
  sessionNickname = nickname;
  try {
    if (nickname) window.localStorage.setItem(NICKNAME_STORAGE_KEY, nickname);
    else window.localStorage.removeItem(NICKNAME_STORAGE_KEY);
  } catch {
    // blocked storage: the name lasts until the page closes, which is fine
  }
  window.dispatchEvent(new Event(NICKNAME_CHANGED_EVENT));
}

/**
 * the chatter's nickname, remembered in this browser. empty on the server and until one's
 * picked.
 *
 * @returns {[string, (nickname: string) => void]} the name and a setter that saves it.
 */
export function useChatNickname(): [string, (nickname: string) => void] {
  const nickname = useSyncExternalStore(subscribeNickname, readNickname, () => "");
  return [nickname, saveNickname];
}
