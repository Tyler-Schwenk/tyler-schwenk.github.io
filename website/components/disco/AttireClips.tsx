"use client";

import { useEffect, useRef } from "react";

import { ATTIRE_CLIPS } from "./constants";
import styles from "./disco.module.css";

/**
 * three archival disco floor clips in overlapping circles, looping silently
 * behind the attire line to show what to wear. under prefers-reduced-motion they
 * sit paused on their first frame.
 * @returns {JSX.Element} the cluster of round clips.
 */
export default function AttireClips() {
  const clusterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    clusterRef.current?.querySelectorAll("video").forEach((video) => video.pause());
  }, []);

  return (
    <div ref={clusterRef} className={styles.attireClips} aria-hidden="true">
      {ATTIRE_CLIPS.map((clip) => (
        <video
          key={clip.mp4Src}
          className={styles.attireClip}
          poster={clip.posterSrc}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        >
          <source src={clip.webmSrc} type="video/webm" />
          <source src={clip.mp4Src} type="video/mp4" />
        </video>
      ))}
    </div>
  );
}
