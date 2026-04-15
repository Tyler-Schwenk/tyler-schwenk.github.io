"use client";

import Image from "next/image";
import { useState } from "react";

import type { EventFlier } from "@/app/events/data";

const FLIER_IMAGE_WIDTH = 1200;
const FLIER_IMAGE_HEIGHT = 1600;

/**
 * Renders a clickable flier with a full-screen modal preview.
 *
 * @param {object} props - Component props.
 * @param {EventFlier | undefined} props.flier - Flier image data.
 * @returns {JSX.Element | null} The flier section when present.
 */
export default function EventFlierModal({
  flier,
}: {
  flier: EventFlier | undefined;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!flier) {
    return null;
  }

  return (
    <div className="border-t border-slate-700 pt-8">
      <h2 className="text-lg font-semibold text-white mb-4">Flier</h2>
      <div className="space-y-4">
        <button
          type="button"
          className="group w-full rounded-2xl overflow-hidden border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
          onClick={() => setIsOpen(true)}
          aria-label="Open flier preview"
        >
          <Image
            src={flier.src}
            alt={flier.alt}
            width={FLIER_IMAGE_WIDTH}
            height={FLIER_IMAGE_HEIGHT}
            className="w-full h-auto transition-transform duration-300 group-hover:scale-[1.01]"
            priority
          />
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center justify-center rounded-full border border-indigo-400 px-5 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-500/30 transition"
        >
          View full screen
        </button>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-zoom-out"
            onClick={() => setIsOpen(false)}
            aria-label="Close flier preview"
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
            <Image
              src={flier.src}
              alt={flier.alt}
              width={FLIER_IMAGE_WIDTH}
              height={FLIER_IMAGE_HEIGHT}
              className="h-auto w-full"
            />
            <div className="flex items-center justify-end border-t border-slate-800 bg-slate-950/90 px-4 py-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-indigo-400 px-4 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/30 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
