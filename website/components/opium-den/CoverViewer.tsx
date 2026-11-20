"use client";

import { useEffect, useRef } from "react";

/**
 * a set's cover, full screen over everything. a tap anywhere, the close button or
 * escape closes it, and the page behind doesn't scroll while it's up.
 *
 * @param {object} props
 * @param {string} props.src - the full-size image.
 * @param {string} props.alt - what it is, like "cover for sunday warmup".
 * @param {() => void} props.onClose - closes it.
 * @returns {JSX.Element} the viewer.
 *
 * Side effects: locks the body's scroll and listens for escape while mounted.
 */
export default function CoverViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      // z-[10000] clears the floating home button (z-[9999] in Navigation)
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]"
    >
      {/* the api serves it at full size already, so there's nothing for next/image to do */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="max-h-full max-w-full rounded-lg object-contain" />
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/60 text-2xl leading-none text-white transition-colors hover:border-den-accent hover:text-den-accent-soft"
      >
        &times;
      </button>
    </div>
  );
}
