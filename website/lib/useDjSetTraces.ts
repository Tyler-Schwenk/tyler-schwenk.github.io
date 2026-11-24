"use client";

import { useEffect, useRef, useState } from "react";
import { fetchDjSetChat, fetchDjSetWaveform, type DjSet, type DjSetChatMessage } from "@/app/opium-den/djApi";

/** one set's trace for the to-scale list: its waveform and its chat. */
export type DjSetTrace = {
  /** the waveform, null until it loads (or if it failed). */
  peaks: number[] | null;
  /** the waveform couldn't be loaded, so stop showing it as loading. */
  peaksFailed: boolean;
  /** the chat on the set's timeline, null until it loads (or if it failed). */
  messages: DjSetChatMessage[] | null;
};

const EMPTY_TRACE: DjSetTrace = { peaks: null, peaksFailed: false, messages: null };

/**
 * loads every listed set's waveform and chat for the live section's to-scale list, each
 * once: the section polls its sets, but a finished set's trace doesn't change, so new
 * sets get loaded as they show up and the rest are left alone. chats load all at once
 * (they're small); waveforms one at a time, newest first, since an older set's first one
 * can take the pi a few seconds and there's no point making it work out several at once.
 * a failure just leaves that set's trace empty (the list draws it flat); the set page
 * says why if anyone opens it.
 *
 * @param {DjSet[] | null} sets - the listed sets, newest first. null before they load.
 * @returns {Record<number, DjSetTrace>} each set's trace by id. a set missing from it hasn't started loading.
 *
 * Side effects: logs each failed load to the console with the set it was for.
 */
export function useDjSetTraces(sets: DjSet[] | null): Record<number, DjSetTrace> {
  const [traces, setTraces] = useState<Record<number, DjSetTrace>>({});
  // ids already asked for, so a poll handing back the same sets doesn't ask again
  const requested = useRef(new Set<number>());
  const mounted = useRef(true);
  const idsKey = sets?.map((set) => set.id).join(",") ?? "";

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!idsKey) return;
    const fresh = idsKey
      .split(",")
      .map(Number)
      .filter((id) => !requested.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => requested.current.add(id));

    const patch = (id: number, update: Partial<DjSetTrace>) => {
      if (!mounted.current) return;
      setTraces((current) => ({ ...current, [id]: { ...(current[id] ?? EMPTY_TRACE), ...update } }));
    };

    for (const id of fresh) {
      fetchDjSetChat(id)
        .then((messages) => patch(id, { messages }))
        .catch((err: Error) => console.error(`den set list: no chat for set ${id} (${err.message})`));
    }

    const loadWaveforms = async () => {
      for (const id of fresh) {
        if (!mounted.current) return;
        try {
          const waveform = await fetchDjSetWaveform(id);
          patch(id, { peaks: waveform.peaks });
        } catch (err) {
          console.error(`den set list: no waveform for set ${id} (${(err as Error).message})`);
          patch(id, { peaksFailed: true });
        }
      }
    };
    loadWaveforms();
  }, [idsKey]);

  return traces;
}
