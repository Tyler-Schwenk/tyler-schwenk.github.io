"use client";

import { RecordIcon } from "./playerIcons";

/**
 * a set's cover, square: its uploaded image cropped to fill, or a grid-line grey tile
 * with a record on it when it hasn't got one. sized by the caller (h-12 w-12 and so on).
 *
 * @param {object} props
 * @param {string | null} props.src - the image url, null for the placeholder.
 * @param {string} [props.alt] - what the image shows. empty by default, since a title sits beside it.
 * @param {boolean} [props.dim] - greyed out, for the live room off air.
 * @param {string} [props.className] - size, rounding and anything else.
 * @returns {JSX.Element} the cover.
 */
export default function SetArt({
  src,
  alt = "",
  dim = false,
  className = "h-12 w-12",
}: {
  src: string | null;
  alt?: string;
  dim?: boolean;
  className?: string;
}) {
  const dimming = dim ? "opacity-50 grayscale" : "";
  if (src) {
    return (
      // the api serves the thumbnail already sized, so there's nothing for next/image to do
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={`shrink-0 object-cover transition ${dimming} ${className}`} />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center bg-den-line transition ${dimming} ${className}`}
    >
      <RecordIcon className="h-1/2 w-1/2 text-den-ink/25" />
    </span>
  );
}
