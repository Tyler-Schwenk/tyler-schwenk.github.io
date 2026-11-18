"use client";

import type { Ref } from "react";

import { CLOUD_LOOP_MP4_SRC, CLOUD_LOOP_POSTER_SRC, CLOUD_LOOP_WEBM_SRC } from "./constants";
import styles from "./disco.module.css";

interface CloudLoopProps {
  /** start playing on its own. off for the curtain, which waits for its cue */
  autoPlay?: boolean;
  ref?: Ref<HTMLVideoElement>;
}

/**
 * the hand drawn cloud loop from the end of the invite video, filling its parent.
 * it's muted, so browsers let it autoplay without a tap.
 * @param {CloudLoopProps} props - whether to autoplay, and an optional ref to the video.
 * @returns {JSX.Element} a looping, cover-fit background video.
 */
export default function CloudLoop({ autoPlay = true, ref }: CloudLoopProps) {
  return (
    <video
      ref={ref}
      className={styles.cloudVideo}
      autoPlay={autoPlay}
      muted
      loop
      playsInline
      preload="auto"
      poster={CLOUD_LOOP_POSTER_SRC}
      aria-hidden="true"
    >
      <source src={CLOUD_LOOP_WEBM_SRC} type="video/webm" />
      <source src={CLOUD_LOOP_MP4_SRC} type="video/mp4" />
    </video>
  );
}
