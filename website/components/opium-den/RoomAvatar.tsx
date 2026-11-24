"use client";

import { djRoomPhotoUrl } from "@/app/opium-den/djApi";
import { characterFor } from "./roomCharacters";

// an inverted character: dark where it was light, with its colours turned back round
const INVERTED_FILTER = "[filter:invert(1)_hue-rotate(180deg)]";

/**
 * how someone looks in the live room: their uploaded photo in a round frame, or their
 * dancing character (looping, or a still frame under reduced motion or when still is
 * asked for). inverted characters get a filter.
 *
 * @param {object} props
 * @param {number} props.avatar - their number from the pi, which picks the character.
 * @param {number | null} [props.photoId] - their photo, which wins over the character.
 * @param {boolean} [props.still] - draw the character's still frame, like the picker's unselected tiles.
 * @param {string} [props.className] - size classes: a height for characters (they keep their width), height and width for photos.
 * @returns {JSX.Element} the avatar.
 */
export default function RoomAvatar({
  avatar,
  photoId = null,
  still = false,
  className = "h-11 sm:h-14",
}: {
  avatar: number;
  photoId?: number | null;
  still?: boolean;
  className?: string;
}) {
  if (photoId !== null) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a static export can't optimize images from the pi
      <img
        src={djRoomPhotoUrl(photoId)}
        alt=""
        decoding="async"
        className={`aspect-square w-auto max-w-none rounded-full border-2 border-den-ink object-cover ${className}`}
      />
    );
  }
  const { dancer, inverted } = characterFor(avatar);
  const filter = inverted ? INVERTED_FILTER : "";
  if (still) {
    // eslint-disable-next-line @next/next/no-img-element -- a static export can't optimize images
    return <img src={dancer.stillSrc} alt="" decoding="async" className={`w-auto max-w-none ${filter} ${className}`} />;
  }
  return (
    <picture className="block">
      <source srcSet={dancer.stillSrc} media="(prefers-reduced-motion: reduce)" />
      <img src={dancer.animSrc} alt="" decoding="async" className={`w-auto max-w-none ${filter} ${className}`} />
    </picture>
  );
}
