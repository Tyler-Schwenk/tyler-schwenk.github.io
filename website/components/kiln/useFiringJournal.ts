"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchKilnNotes, fetchKilnPhotos, type KilnNote, type KilnPhoto } from "@/app/kiln/kilnJournalApi";
import { usePolling } from "@/lib/usePolling";

/** notes can come in during a live firing, so viewers pick them up without a reload. */
const JOURNAL_POLL_MS = 60_000;

/** a firing's notes and photos, and a way to refresh them after a change. */
export type FiringJournal = {
  notes: KilnNote[];
  photos: KilnPhoto[];
  /** reloads both right away, like after adding or changing something. */
  reload: () => void;
};

/** what's loaded, and which firing and login it's for, so a switch never shows the old one's. */
type Loaded = { key: string; notes: KilnNote[]; photos: KilnPhoto[] };

/**
 * loads a firing's notes and photos, and keeps them fresh. with the editor's token it
 * gets the private ones too.
 *
 * @param {number | null} firingId - the firing shown, or null for none.
 * @param {string | null} token - the kiln editor's jwt, or null for the public view.
 * @returns {FiringJournal} the notes and photos, empty until loaded, and a reload.
 */
export function useFiringJournal(firingId: number | null, token: string | null): FiringJournal {
  const key = `${firingId}:${token ?? ""}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // the latest key, so an answer that comes back after a switch gets dropped
  const keyRef = useRef(key);
  // declared before the polling, so it's up to date by the time a new key's first load runs
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  const reload = useCallback(() => {
    if (firingId === null) return;
    const requestKey = key;
    Promise.all([fetchKilnNotes(firingId, token), fetchKilnPhotos(firingId, token)])
      .then(([notes, photos]) => {
        if (keyRef.current === requestKey) setLoaded({ key: requestKey, notes, photos });
      })
      // the page still works without them, and the next poll tries again
      .catch((error) => console.warn(`couldn't load notes and photos for firing ${firingId}:`, error));
  }, [firingId, token, key]);

  usePolling(reload, JOURNAL_POLL_MS, key);

  const current = loaded?.key === key ? loaded : null;
  return { notes: current?.notes ?? [], photos: current?.photos ?? [], reload };
}
