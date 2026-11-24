"use client";

import { useEffect, useState } from "react";
import {
  fetchDjSet,
  fetchDjSetChat,
  fetchDjSetPeople,
  fetchDjSetWaveform,
  type DjSet,
  type DjSetChatMessage,
  type DjSetVisit,
} from "@/app/opium-den/djApi";

/** what useDjSetReplay hands back. */
export type DjSetReplay = {
  /** the set, null until it loads. */
  set: DjSet | null;
  /** its chat on its timeline, oldest first. null until it loads. */
  messages: DjSetChatMessage[] | null;
  /** who was in the live room, on its timeline. empty until it loads, and if it can't. */
  visits: DjSetVisit[];
  /** its waveform, null until it loads (or if it couldn't be worked out). */
  peaks: number[] | null;
  /** why the set or its chat couldn't load. */
  error: string | null;
  /** why the waveform couldn't load. the page still works without it. */
  waveformError: string | null;
};

/**
 * loads one recorded set for its replay page: the set and its chat together, then who
 * was in the room and the waveform on their own (the pi may need a few seconds to work
 * out an older set's waveform). the page works without either, so they fail quietly.
 * loaded once, no polling: a finished set doesn't change (bar a rename).
 *
 * @param {number | null} setId - the set's id, null when the url didn't give a valid one.
 * @returns {DjSetReplay} the set, its chat, its people and waveform, and what went wrong.
 */
export function useDjSetReplay(setId: number | null): DjSetReplay {
  const [set, setSet] = useState<DjSet | null>(null);
  const [messages, setMessages] = useState<DjSetChatMessage[] | null>(null);
  const [visits, setVisits] = useState<DjSetVisit[]>([]);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waveformError, setWaveformError] = useState<string | null>(null);

  useEffect(() => {
    if (setId === null) return;
    let cancelled = false;

    Promise.all([fetchDjSet(setId), fetchDjSetChat(setId)])
      .then(([loadedSet, loadedMessages]) => {
        if (cancelled) return;
        setSet(loadedSet);
        setMessages(loadedMessages);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(`${err.message}. it might have been deleted, or the pi's down.`);
      });

    fetchDjSetPeople(setId)
      .then((loaded) => {
        if (!cancelled) setVisits(loaded);
      })
      .catch(() => {
        // the replay's fine without its people, it just doesn't show them
      });

    fetchDjSetWaveform(setId)
      .then((waveform) => {
        if (!cancelled) setPeaks(waveform.peaks);
      })
      .catch((err: Error) => {
        if (!cancelled) setWaveformError(`${err.message}, so it's just a plain seek bar for now.`);
      });

    return () => {
      cancelled = true;
    };
  }, [setId]);

  return { set, messages, visits, peaks, error, waveformError };
}
