"use client";

import { useEffect, useState } from "react";
import { showSurfCam, stopSurfCam, type SurfCamId } from "./surfCams";

/**
 * Display panel: a live surf cam. The video isn't in this page -- the surfcam
 * agent on the kiosk machine plays it in mpv fullscreen on top of the browser (see
 * surfCams.ts). This component just asks the agent to show the cam on mount
 * and stop it on unmount, and renders a plain status screen underneath that
 * is only ever visible while the stream is starting or if something's wrong.
 * If showing fails it keeps retrying while mounted, since a held cam can stay
 * up for hours. Each mount sends its show and stop with its own token, so a
 * stop from a mount that's gone can't take down a newer one showing the same
 * cam. Render it keyed by camId, so switching cams starts a fresh mount (and a
 * fresh status).
 * @param props.camId - Which cam to show.
 */

// after a failed show, try again this long later (ms)
const SHOW_RETRY_DELAY_MS = 15_000;

export default function SurfCamPanel({ camId }: { camId: SurfCamId }) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = crypto.randomUUID();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let unmounted = false;
    const show = () => {
      showSurfCam(camId, token).then((showError) => {
        if (unmounted) return;
        setError(showError);
        if (showError) retryTimer = setTimeout(show, SHOW_RETRY_DELAY_MS);
      });
    };
    show();
    return () => {
      unmounted = true;
      clearTimeout(retryTimer);
      stopSurfCam(camId, token);
    };
  }, [camId]);

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center font-mono text-3xl text-gray-300 text-center px-8">
      {error ?? "loading surf cam..."}
    </div>
  );
}
