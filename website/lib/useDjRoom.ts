"use client";

import { useEffect, useState } from "react";
import { ChatNameTakenError, checkInDjRoom, leaveDjRoom, type DjRoomLook, type DjRoomPerson } from "@/app/opium-den/djApi";
import { chatOwnerKey } from "@/lib/useDjChat";

// the pi drops anyone it hasn't heard from in 40 s, so this leaves room for a missed one
const CHECK_IN_INTERVAL_MS = 15000;

/** what useDjRoom hands back. */
export type DjRoomPresence = {
  /** everyone in the room, you included, in the order they came in. null until the first check-in. */
  people: DjRoomPerson[] | null;
  /** why the last check-in failed, null when it worked. */
  error: string | null;
  /**
   * the pi's reason when it won't let you in as you are (your name or character is
   * someone else's, or your photo's been removed), null otherwise. you're not in the
   * room while it's set.
   */
  turnedAway: string | null;
};

/**
 * keeps you in the live room while the page is open: checks in with your chat name and
 * look right away and every 15 s while the tab's visible (straight away again when it
 * comes back), and leaves when the page closes. nothing happens without a name (the room
 * passes "" off air, when it's closed), and each check-in is saved on the pi for the
 * set's replay. if the pi won't take you as you are, it stops and says why, until the
 * name or look changes.
 *
 * @param {string} nickname - your chat name, "" before one's picked or while off air.
 * @param {DjRoomLook} look - the character or photo you picked, or null to leave it to the pi.
 * @returns {DjRoomPresence} who's in the room, the last error, and why you were turned away if you were.
 *
 * Side effects: posts check-ins to the pi, and a leave on unmount and when the page hides.
 */
export function useDjRoom(nickname: string, look: DjRoomLook): DjRoomPresence {
  const [people, setPeople] = useState<DjRoomPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [turnedAway, setTurnedAway] = useState<{ as: string; reason: string } | null>(null);
  // the look as a string, so a new object with the same pick doesn't restart the check-ins
  const lookKey = JSON.stringify(look);
  const asKey = `${nickname}|${lookKey}`;

  useEffect(() => {
    if (!nickname) return;
    const lookNow = JSON.parse(lookKey) as DjRoomLook;
    let stopped = false;
    const checkIn = async () => {
      try {
        const room = await checkInDjRoom(nickname, chatOwnerKey(), lookNow);
        if (stopped) return;
        setPeople(room);
        setError(null);
      } catch (err) {
        if (stopped) return;
        if (err instanceof ChatNameTakenError) {
          stopped = true;
          setTurnedAway({ as: `${nickname}|${lookKey}`, reason: err.message });
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
  }, [nickname, lookKey]);

  // leaving only on the way out, not on a name or look change, so a leave can't land after the new check-in
  useEffect(() => {
    const leave = () => leaveDjRoom(chatOwnerKey());
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, []);

  return { people, error, turnedAway: turnedAway?.as === asKey ? turnedAway.reason : null };
}
