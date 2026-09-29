"use client";

import Image from "next/image";
import { useEffect } from "react";

export interface LightboxPhoto {
  src: string;
  alt: string;
}

interface PhotoLightboxProps {
  photos: LightboxPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/**
 * Fullscreen photo viewer overlay. Arrow buttons/keys page through photos,
 * Escape or clicking the backdrop closes it. The parent owns which photo is open.
 *
 * @param {PhotoLightboxProps} props - Component props.
 * @param {LightboxPhoto[]} props.photos - Photos to page through, in display order.
 * @param {number} props.index - Index of the photo currently shown.
 * @param {(index: number) => void} props.onIndexChange - Called with the new index when navigating.
 * @param {() => void} props.onClose - Called when the viewer should close.
 * @returns {JSX.Element} The fullscreen overlay.
 */
export default function PhotoLightbox({ photos, index, onIndexChange, onClose }: PhotoLightboxProps) {
  const goToNext = () => onIndexChange((index + 1) % photos.length);
  const goToPrev = () => onIndexChange((index - 1 + photos.length) % photos.length);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goToNext();
      if (e.key === "ArrowLeft") goToPrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const photo = photos[index];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="photo viewer"
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={(e) => {
        // stop here so a lightbox nested inside another modal doesn't close that one too
        e.stopPropagation();
        onClose();
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-6 right-6 h-12 w-12 rounded-full border border-white/40 bg-black/60 text-white hover:text-green-400 hover:border-green-400 transition-colors text-3xl font-light z-50"
        aria-label="Close"
      >
        &times;
      </button>

      <div className="relative w-full h-full max-w-5xl max-h-[85vh] m-8" onClick={(e) => e.stopPropagation()}>
        <Image src={photo.src} alt={photo.alt} fill className="object-contain" sizes="100vw" priority />
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
            {index + 1} / {photos.length}
          </div>
        </>
      )}
    </div>
  );
}
