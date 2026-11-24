"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ShareQrOverlay from "@/components/ShareQrOverlay";
import { useLongPress } from "@/lib/useLongPress";

/**
 * the frog home button floating over the top left corner of most pages. tap it to go home;
 * hold it to pop up a qr code for the page you're on, for sharing in person.
 *
 * @returns {JSX.Element} the home button, plus the qr overlay while it's open.
 */
export default function Navigation() {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const longPress = useLongPress(() => setShareUrl(window.location.href));
  const closeShare = useCallback(() => setShareUrl(null), []);

  return (
    <nav className="fixed top-4 left-4 z-[9999]">
      <Link
        href="/"
        aria-label="Return to home (hold for a QR code to this page)"
        draggable={false}
        // the callout/select rules stop ios from opening its own link preview on hold
        className="relative block h-12 w-12 select-none [-webkit-touch-callout:none] sm:h-14 sm:w-14"
        {...longPress}
      >
        <Image
          src="/images/8bit/crlf_8bit.png"
          alt=""
          fill
          priority
          draggable={false}
          className="object-contain pixelated"
          sizes="(max-width: 640px) 48px, 56px"
        />
      </Link>
      {shareUrl && <ShareQrOverlay url={shareUrl} onClose={closeShare} />}
    </nav>
  );
}
