"use client";

import Image from "next/image";
import { useState } from "react";
import PhotoLightbox, { LightboxPhoto } from "./PhotoLightbox";

interface GridPhoto extends LightboxPhoto {
  thumbSrc: string;
}

interface PhotoLightboxGridProps {
  photos: GridPhoto[];
}

/**
 * Responsive thumbnail grid with a fullscreen lightbox for browsing photos.
 * Click a thumbnail to open it; arrow buttons, arrow keys, or Escape to navigate/close.
 *
 * @param {GridPhoto[]} photos - Photos to display, in display order.
 * @returns {JSX.Element | null} The grid + lightbox, or null if there are no photos.
 */
export default function PhotoLightboxGrid({ photos }: PhotoLightboxGridProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((photo, index) => (
          <button
            key={photo.src}
            onClick={() => setOpenIndex(index)}
            className="relative aspect-square rounded-lg overflow-hidden group"
          >
            <Image
              src={photo.thumbSrc}
              alt={photo.alt}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 33vw, 200px"
            />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <PhotoLightbox
          photos={photos}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}
