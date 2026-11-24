"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import type { EventFlier } from "@/app/events/data";

const FLIER_IMAGE_WIDTH_PX = 1200;
const FLIER_IMAGE_HEIGHT_PX = 1600;

/**
 * an event's flier taped down like a photo in the zine, with a rubber stamp on the
 * corner. tapping it opens the flier full screen; escape or tapping outside closes it.
 *
 * @param {object} props - component props.
 * @param {EventFlier} props.flier - the flier image.
 * @param {boolean} props.past - whether the event already happened, which picks the stamp.
 * @returns {JSX.Element} the taped flier, plus the full screen view while it's open.
 */
export default function ZineFlier({ flier, past }: { flier: EventFlier; past: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  return (
    <>
      <button type="button" className="zine-photo" onClick={() => setIsOpen(true)} aria-label="Open the flier full screen">
        <span className="zine-tape" />
        <Image
          src={flier.src}
          alt={flier.alt}
          width={FLIER_IMAGE_WIDTH_PX}
          height={FLIER_IMAGE_HEIGHT_PX}
          sizes="(max-width: 760px) 100vw, 560px"
          priority
        />
        <span className="zine-cap">tap for the full flier</span>
        {past ? (
          <span className="zine-stamp blue">
            <span>
              <small>thanks!</small>
              Been &amp;<br />gone
            </span>
          </span>
        ) : (
          <span className="zine-stamp">
            <span>
              <small>come thru</small>
              See you<br />there
            </span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="zine-modal" role="dialog" aria-modal="true" aria-label={flier.alt}>
          <button type="button" className="zine-modal-backdrop" onClick={() => setIsOpen(false)} aria-label="Close the flier" />
          <div className="zine-modal-sheet">
            <Image src={flier.src} alt={flier.alt} width={FLIER_IMAGE_WIDTH_PX} height={FLIER_IMAGE_HEIGHT_PX} sizes="900px" />
            <button type="button" className="zine-btn" onClick={() => setIsOpen(false)} autoFocus>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
