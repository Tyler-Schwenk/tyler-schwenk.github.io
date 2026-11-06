"use client";

import { useMemo, useState } from "react";
import { fetchKilnCurve, type KilnFiring, type KilnFiringCurve } from "@/app/kiln/kilnApi";
import { formatDate } from "@/app/kiln/kilnFormat";

/** one per comparison color (--kiln-compare-1 and on). more lines than this get hard to tell apart. */
export const COMPARE_SLOTS = 3;
/** finished firings don't change, so a lighter curve than the main one is plenty. */
const COMPARE_POINTS = 500;

/** a firing on the chart next to the main one. slot picks its color and stays put while it's on. */
export type ComparedFiring = { slot: number; curve: KilnFiringCurve };

/**
 * the css class that sets a series' color, for its line, legend and chip swatches.
 *
 * @param {number | null} slot - the comparison slot, or null for the main firing.
 * @returns {string} the class name.
 */
export const seriesClass = (slot: number | null): string => (slot === null ? "kiln-series-main" : `kiln-series-${slot + 1}`);

/**
 * keeps track of which past firings are on the chart, and loads their curves.
 *
 * each one keeps its slot, and so its color, until it's turned off, so adding or removing
 * another never repaints it.
 *
 * @param {number | null} shownFiringId - the main firing. it can't be compared with itself.
 * @returns {{ slots: Array<number | null>; compared: ComparedFiring[]; toggle: (firingId: number) => void }}
 *   the firing id in each slot, the ones loaded and ready to draw, and the on/off switch.
 */
export function useComparedFirings(shownFiringId: number | null) {
  const [slots, setSlots] = useState<Array<number | null>>(() => Array(COMPARE_SLOTS).fill(null));
  const [curves, setCurves] = useState<Record<number, KilnFiringCurve>>({});

  const isFree = (id: number | null) => id === null || id === shownFiringId;
  const removeFromSlots = (firingId: number) =>
    setSlots((previous) => previous.map((id) => (id === firingId ? null : id)));

  /**
   * turns a firing's comparison on or off. does nothing when every slot's taken.
   *
   * @param {number} firingId - the firing.
   */
  const toggle = (firingId: number) => {
    if (slots.includes(firingId)) {
      removeFromSlots(firingId);
      return;
    }
    const free = slots.findIndex(isFree);
    if (free === -1) return;
    setSlots(slots.map((id, slot) => (slot === free ? firingId : id)));
    if (curves[firingId]) return;
    fetchKilnCurve(firingId, COMPARE_POINTS)
      .then((curve) => setCurves((previous) => ({ ...previous, [firingId]: curve })))
      .catch((error) => {
        console.warn(`couldn't load firing ${firingId} to compare, so it's been turned back off:`, error);
        removeFromSlots(firingId);
      });
  };

  const compared = useMemo(
    () =>
      slots.flatMap((id, slot) =>
        id === null || id === shownFiringId || !curves[id] ? [] : [{ slot, curve: curves[id] }],
      ),
    [slots, curves, shownFiringId],
  );
  return { slots, compared, toggle };
}

/**
 * the "compare with" row: a chip per other firing, each one adding its curve to the chart.
 *
 * @param {object} props - component props.
 * @param {KilnFiring[]} props.firings - the firings that can be compared, newest first.
 * @param {Array<number | null>} props.slots - the firing id in each comparison slot.
 * @param {number | null} props.shownFiringId - the main firing, which can hold a stale slot.
 * @param {(firingId: number) => void} props.onToggle - turns a comparison on or off.
 * @returns {JSX.Element} the chips.
 */
export default function CompareFirings({
  firings,
  slots,
  shownFiringId,
  onToggle,
}: {
  firings: KilnFiring[];
  slots: Array<number | null>;
  shownFiringId: number | null;
  onToggle: (firingId: number) => void;
}) {
  const full = slots.every((id) => id !== null && id !== shownFiringId);
  return (
    <div className="kiln-compare">
      <span className="kiln-compare-label">Compare with</span>
      <div className="kiln-chips">
        {firings.map((firing) => {
          const slot = slots.indexOf(firing.id);
          const on = slot !== -1;
          return (
            <button
              key={firing.id}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              title={!on && full ? `Up to ${COMPARE_SLOTS} at once` : undefined}
              onClick={() => onToggle(firing.id)}
            >
              {on && <span className={`kiln-swatch ${seriesClass(slot)}`} aria-hidden="true" />}
              {formatDate(firing.started_at)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
