"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface LightboxPhoto {
  src: string;
  thumbSrc: string;
  alt: string;
}

interface PhotoLightboxGridProps {
  photos: LightboxPhoto[];
}

/**
 * Responsive thumbnail grid with a fullscreen lightbox for browsing photos.
 * Click a thumbnail to open it; arrow buttons, arrow keys, or Escape to navigate/close.
 *
 * @param {LightboxPhoto[]} photos - Photos to display, in display order.
 * @returns {JSX.Element | null} The grid + lightbox, or null if there are no photos.
 */
export default function PhotoLightboxGrid({ photos }: PhotoLightboxGridProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const goToNext = () => setOpenIndex((i) => (i === null ? null : (i + 1) % photos.length));
  const goToPrev = () => setOpenIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));

  useEffect(() => {
    if (openIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowRight") goToNext();
      if (e.key === "ArrowLeft") goToPrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openIndex, photos.length]);

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
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setOpenIndex(null)}
        >
          <button
            onClick={() => setOpenIndex(null)}
            className="absolute top-6 right-6 h-12 w-12 rounded-full border border-white/40 bg-black/60 text-white hover:text-green-400 hover:border-green-400 transition-colors text-3xl font-light z-50"
            aria-label="Close"
          >
            &times;
          </button>

          <div className="relative w-full h-full max-w-5xl max-h-[85vh] m-8" onClick={(e) => e.stopPropagation()}>
            <Image
              src={photos[openIndex].src}
              alt={photos[openIndex].alt}
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />
          </div>

          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-all text-2xl"
                aria-label="Previous photo"
              >
                &larr;
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); goToNext(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-all text-2xl"
                aria-label="Next photo"
              >
                &rarr;
              </button>
              <div className="absolute top-6 left-6 text-white/75 text-sm">
                {openIndex + 1} / {photos.length}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
