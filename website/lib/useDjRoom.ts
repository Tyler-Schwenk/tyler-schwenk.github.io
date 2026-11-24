"use client";

import { useEffect, useState } from "react";
import { ChatNameTakenError, checkInDjRoom, leaveDjRoom, type DjRoomPerson } from "@/app/opium-den/djApi";
import { chatOwnerKey } from "@/lib/useDjChat";

// the pi drops anyone it hasn't heard from in 40 s, so this leaves room for a missed one
const CHECK_IN_INTERVAL_MS = 15000;

/** what useDjRoom hands back. */
export type DjRoomPresence = {
  /** everyone in the room, you included, in the order they came in. null until the first check-in. */
  people: DjRoomPerson[] | null;
  /** why the last check-in failed, null when it worked. */
  error: string | null;
  /** the pi's reason when someone else has your name, null otherwise. you're not in the room while it's set. */
  nameTaken: string | null;
};

/**
 * keeps you in the live room while the page is open: checks in with your chat name right
 * away and every 15 s while the tab's visible (straight away again when it comes back),
 * and leaves when the page closes. nothing happens without a name (the room passes "" off
 * air, when it's closed), and each check-in is saved on the pi for the set's replay. if
 * the name's someone else's it stops and says so, until the name changes.
 *
 * @param {string} nickname - your chat name, "" before one's picked or while off air.
 * @returns {DjRoomPresence} who's in the room, the last error, and whether your name's taken.
 *
 * Side effects: posts check-ins to the pi, and a leave on unmount and when the page hides.
 */
export function useDjRoom(nickname: string): DjRoomPresence {
  const [people, setPeople] = useState<DjRoomPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState<{ nickname: string; reason: string } | null>(null);

  useEffect(() => {
    if (!nickname) return;
    let stopped = false;
    const checkIn = async () => {
      try {
        const room = await checkInDjRoom(nickname, chatOwnerKey());
        if (stopped) return;
        setPeople(room);
        setError(null);
      } catch (err) {
        if (stopped) return;
        if (err instanceof ChatNameTakenError) {
          stopped = true;
          setTaken({ nickname, reason: err.message });
          return;
        }
        setError((err as Error).message);
      }
    };
    const checkInIfVisible = () => {
      if (!document.hidden && !stopped) checkIn();
    };
    checkIn();
    const timer = setInterval(checkInIfVisible, CHECK_IN_INTERVAL_MS);
    document.addEventListener("visibilitychange", checkInIfVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", checkInIfVisible);
    };
  }, [nickname]);

  // leaving only on the way out, not on a name change, so a leave can't land after the new name's check-in
  useEffect(() => {
    const leave = () => leaveDjRoom(chatOwnerKey());
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, []);

  return { people, error, nameTaken: taken?.nickname === nickname ? taken.reason : null };
}
