"use client";

import { useEffect, useState } from "react";
import { showSurfCam, stopSurfCam, type SurfCamId } from "./surfCams";

/**
 * Display panel: a live surf cam. The video isn't in this page -- the surfcam
 * agent on displaypi plays it in mpv fullscreen on top of the browser (see
 * surfCams.ts). This component just asks the agent to show the cam on mount
 * and stop it on unmount, and renders a plain status screen underneath that
 * is only ever visible while the stream is starting or if something's wrong.
 * @param props.camId - Which cam to show.
 */
export default function SurfCamPanel({ camId }: { camId: SurfCamId }) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    showSurfCam(camId).then(setError);
    return () => {
      stopSurfCam(camId);
    };
  }, [camId]);

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center font-mono text-3xl text-gray-300 text-center px-8">
      {error ?? "loading surf cam..."}
    </div>
  );
}
