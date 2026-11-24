"use client";

import { useEffect, useState } from "react";

/** rendered size of the qr image. big enough that it scans fine off a phone screen */
const QR_SIZE_PX = 512;
/** quiet zone around the code, in qr modules. scanners want at least a little */
const QR_MARGIN_MODULES = 2;

interface ShareQrOverlayProps {
  /** the link the code points at */
  url: string;
  /** called when you tap anywhere or hit escape */
  onClose: () => void;
}

/**
 * full screen qr code for a link, so a friend can scan it off your phone. tap anywhere
 * or press escape to close.
 *
 * @param {ShareQrOverlayProps} props - the link and how to close.
 * @returns {JSX.Element} the overlay.
 */
export default function ShareQrOverlay({ url, onClose }: ShareQrOverlayProps) {
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // loaded on demand: the encoder's only needed once someone actually holds the frog,
    // so it stays out of every page's bundle
    import("qrcode")
      .then((QRCode) => QRCode.toDataURL(url, { width: QR_SIZE_PX, margin: QR_MARGIN_MODULES }))
      .then((src) => { if (!cancelled) setQrSrc(src); })
      .catch((err) => {
        console.error(`couldn't make a qr code for ${url}, the link's still shown to copy by hand`, err);
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="QR code for this page"
      onClick={onClose}
      className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-black/85 p-4"
    >
      <div className="aspect-square w-full max-w-[20rem] rounded-xl bg-white p-3">
        {qrSrc && (
          // eslint-disable-next-line @next/next/no-img-element -- a data url, nothing for next/image to optimize
          <img src={qrSrc} alt={`QR code linking to ${url}`} className="pixelated h-full w-full" />
        )}
        {failed && (
          <p className="flex h-full items-center justify-center text-center text-sm text-black">
            couldn&apos;t draw the qr code
          </p>
        )}
      </div>
      <p className="max-w-[20rem] break-all text-center text-sm text-white">{url}</p>
      <p className="pixel-font text-[10px] text-white/60">tap to close</p>
    </div>
  );
}
