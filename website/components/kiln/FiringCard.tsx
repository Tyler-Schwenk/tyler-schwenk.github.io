"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchKilnCurve, type KilnFiring } from "@/app/kiln/kilnApi";
import { formatDate, formatDuration, formatTemp, type TempUnit } from "@/app/kiln/kilnFormat";

const THUMBNAIL_POINTS = 80;
const THUMBNAIL_WIDTH = 100;
const THUMBNAIL_HEIGHT = 100;
/** keeps the curve off the tile's edges, in viewBox units. */
const THUMBNAIL_INSET = 14;

/**
 * draws a firing's curve as a path for its thumbnail, stretched to fill the tile.
 *
 * @param {Array<number | null>} temps - the temperatures, oldest first.
 * @returns {string} svg path data, empty with fewer than two temperatures.
 */
function thumbnailPath(temps: Array<number | null>): string {
  const known = temps.filter((temp): temp is number => temp !== null);
  if (known.length < 2) return "";
  const min = Math.min(...known);
  const range = Math.max(Math.max(...known) - min, 1);
  const usableWidth = THUMBNAIL_WIDTH - 2 * THUMBNAIL_INSET;
  const usableHeight = THUMBNAIL_HEIGHT - 2 * THUMBNAIL_INSET;
  return known
    .map((temp, index) => {
      const x = THUMBNAIL_INSET + (index / (known.length - 1)) * usableWidth;
      const y = THUMBNAIL_INSET + (1 - (temp - min) / range) * usableHeight;
      return `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join("");
}

/**
 * a past firing in the grid: a gray tile with its curve, then its date and peak underneath.
 * links to that firing's own view.
 *
 * @param {object} props - component props.
 * @param {KilnFiring} props.firing - the firing.
 * @param {TempUnit} props.unit - the unit to show.
 * @returns {JSX.Element} the card.
 */
export default function FiringCard({ firing, unit }: { firing: KilnFiring; unit: TempUnit }) {
  const [path, setPath] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchKilnCurve(firing.id, THUMBNAIL_POINTS)
      .then((curve) => {
        if (!cancelled) setPath(thumbnailPath(curve.points.map((point) => point.thermocouple_c)));
      })
      // the tile still works as a link without its curve
      .catch((error) => console.warn(`couldn't load the curve for firing ${firing.id}:`, error));
    return () => {
      cancelled = true;
    };
  }, [firing.id]);

  const endTime = firing.ended_at ?? firing.last_reading_at;
  const durationMs = new Date(endTime).getTime() - new Date(firing.started_at).getTime();

  return (
    <Link href={`/kiln?firing=${firing.id}`} className="kiln-card">
      <div className="kiln-card-tile">
        <svg viewBox={`0 0 ${THUMBNAIL_WIDTH} ${THUMBNAIL_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
          {path && <path d={path} className="kiln-card-line" vectorEffect="non-scaling-stroke" />}
        </svg>
      </div>
      <div className="kiln-card-text">
        <div>{formatDate(firing.started_at)}</div>
        <div>
          {formatTemp(firing.peak_c, unit)} peak, {formatDuration(durationMs)}
        </div>
      </div>
    </Link>
  );
}
