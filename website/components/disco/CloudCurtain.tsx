"use client";

import { useEffectEvent, useLayoutEffect, useRef } from "react";

import CloudLoop from "./CloudLoop";
import { drawPartingClouds, easeInOutCubic } from "./cloudSeam";
import { PART_DURATION_MS } from "./constants";
import styles from "./disco.module.css";

// sharper than this just costs battery on a full screen canvas
const MAX_CANVAS_DPR = 2;

// the invite video is 16:9, and its cloud shot is a 4:3 picture with black bars
// down the sides. the curtain matches that size at the handoff, then grows to fill.
const INVITE_VIDEO_ASPECT = 16 / 9;
const CLOUD_ASPECT = 4 / 3;

/**
 * how small the full screen clouds have to start to line up with the video's
 * pillarboxed clouds. the video's shown object-fit: contain, the curtain cover.
 * @param {number} width - stage width in px.
 * @param {number} height - stage height in px.
 * @returns {number} the curtain's starting scale, 1 or less.
 */
function handoffScale(width: number, height: number): number {
  const videoHeight = Math.min(height, width / INVITE_VIDEO_ASPECT);
  const curtainHeight = Math.max(height, width / CLOUD_ASPECT);
  return videoHeight / curtainHeight;
}

interface CloudCurtainProps {
  /** shown and looping. it rises at the video's handoff point, starting from loop frame 0 */
  up: boolean;
  /** slide the clouds apart to show what's underneath */
  parting: boolean;
  /** called once the clouds are fully off screen */
  onParted: () => void;
}

/**
 * the cloud loop as a curtain over the flier. it sits paused on its first frame
 * until it's raised, so it can take over from the invite video without a jump,
 * then splits down the middle and slides away when it's told to part.
 * @param {CloudCurtainProps} props - whether it's up, whether it's parting, and the done callback.
 * @returns {JSX.Element} the curtain layer.
 */
export default function CloudCurtain({ up, parting, onParted }: CloudCurtainProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const finishParting = useEffectEvent(onParted);

  // a layout effect so the starting scale is set before the curtain's first paint
  useLayoutEffect(() => {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame) {
      return;
    }
    if (up) {
      const curtain = frame.parentElement ?? document.body;
      frame.style.setProperty("--start-scale", String(handoffScale(curtain.clientWidth, curtain.clientHeight)));
    }
    if (!up) {
      video.pause();
      video.currentTime = 0;
      return;
    }
    video.play().catch((error: unknown) => {
      // muted video should always be allowed to play; if not, the poster frame still covers the gap
      console.warn("disco invite: cloud curtain couldn't start looping, showing its still frame instead", error);
    });
  }, [up]);

  // a layout effect so the first split frame is on the canvas before the browser
  // paints the hidden video, otherwise the flier flashes through for a frame
  useLayoutEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!parting || !video || !canvas || !ctx) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishParting();
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_CANVAS_DPR);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);

    drawPartingClouds(ctx, video, 0);

    let frameId = 0;
    const startedAt = performance.now();
    const drawFrame = (now: number) => {
      const linear = Math.min(1, (now - startedAt) / PART_DURATION_MS);
      drawPartingClouds(ctx, video, easeInOutCubic(linear));
      if (linear < 1) {
        frameId = requestAnimationFrame(drawFrame);
        return;
      }
      finishParting();
    };
    frameId = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(frameId);
  }, [parting]);

  const classNames = [styles.curtain, up && styles.curtainUp, parting && styles.curtainParting]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames}>
      <div ref={frameRef} className={styles.curtainFrame}>
        <CloudLoop ref={videoRef} autoPlay={false} />
      </div>
      <canvas ref={canvasRef} className={styles.curtainCanvas} aria-hidden="true" />
    </div>
  );
}
