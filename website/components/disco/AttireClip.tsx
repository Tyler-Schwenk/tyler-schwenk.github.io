"use client";

import { useEffect, useRef } from "react";

import { ATTIRE_CLIP } from "./constants";
import styles from "./disco.module.css";

/**
 * archival 70s disco floor footage in a ringed circle, looping silently by the
 * attire line to show what to wear. it's three clips crossfaded into one video.
 * under prefers-reduced-motion it sits paused on its first frame.
 * @returns {JSX.Element} the round clip.
 */
export default function AttireClip() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      videoRef.current?.pause();
    }
  }, []);

  return (
    <video
      ref={videoRef}
      className={styles.attireClip}
      poster={ATTIRE_CLIP.posterSrc}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
    >
      <source src={ATTIRE_CLIP.webmSrc} type="video/webm" />
      <source src={ATTIRE_CLIP.mp4Src} type="video/mp4" />
    </video>
  );
}
