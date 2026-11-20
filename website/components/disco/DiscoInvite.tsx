"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import CloudCurtain from "./CloudCurtain";
import CloudLoop from "./CloudLoop";
import {
  CLOUD_HANDOFF_S,
  DISCO_LETTER_COLORS,
  FLOOR_GROUT,
  FLOOR_PINK,
  INVITE_VIDEO_DESKTOP_SRC,
  INVITE_VIDEO_MOBILE_SRC,
  MUSIC_HANDOFF_S,
  NIGHT_SKY_BOTTOM,
  NIGHT_SKY_TOP,
  ORNAMENT_BLUE,
  ORNAMENT_LIME,
  ORNAMENT_TEAL,
  PART_DELAY_MS,
} from "./constants";
import DiscoFlier from "./DiscoFlier";
import type { FlierCardInfo } from "./saveFlierCard";
import { useDiscoMusic } from "./useDiscoMusic";
import { useInviteDevice } from "./useInviteDevice";
import styles from "./disco.module.css";

/**
 * where the invite is in its sequence:
 * - waiting: clouds, until we know the device (and, on a phone, until it's sideways)
 * - tap: the browser blocked autoplay with sound, so the clouds get a start button
 * - playing: the invite video
 * - clouds: the video's done, the cloud loop holds for a beat
 * - parting: the clouds slide apart over the flier
 * - flier: just the flier
 */
type Stage = "waiting" | "tap" | "playing" | "clouds" | "parting" | "flier";

// the palette and ornament colors go on the stage as css variables so the
// stylesheet and the canvas card read the same values from constants.ts
const THEME_VARS = {
  ...Object.fromEntries(DISCO_LETTER_COLORS.map((color, i) => [`--c${i}`, color])),
  "--ornament-lime": ORNAMENT_LIME,
  "--ornament-blue": ORNAMENT_BLUE,
  "--ornament-teal": ORNAMENT_TEAL,
  "--sky-top": NIGHT_SKY_TOP,
  "--sky-bottom": NIGHT_SKY_BOTTOM,
  "--floor-pink": FLOOR_PINK,
  "--floor-grout": FLOOR_GROUT,
} as CSSProperties;

/**
 * calls back once the video reaches a time, checking every frame it shows.
 * uses requestVideoFrameCallback where there is one, since timeupdate only fires a few times a second.
 * @param {HTMLVideoElement} video - the playing video.
 * @param {number} targetS - the time to wait for, in seconds.
 * @param {() => void} onReached - called once, when the video's at or past targetS.
 * @returns {() => void} stops watching.
 */
function watchVideoTime(video: HTMLVideoElement, targetS: number, onReached: () => void): () => void {
  let stopped = false;
  const hasFrameCallback = typeof video.requestVideoFrameCallback === "function";

  const check = (mediaTimeS: number) => {
    if (stopped) {
      return;
    }
    if (mediaTimeS >= targetS) {
      onReached();
      return;
    }
    schedule();
  };

  function schedule() {
    if (hasFrameCallback) {
      video.requestVideoFrameCallback((_now, frame) => check(frame.mediaTime));
      return;
    }
    requestAnimationFrame(() => check(video.currentTime));
  }

  schedule();
  return () => {
    stopped = true;
  };
}

interface DiscoInviteProps {
  info: FlierCardInfo;
}

/**
 * the disco december invite: plays the invite video full screen, hands off to the
 * looping clouds at the end, parts them, and leaves the flier underneath. phones
 * held upright get asked to rotate first, and the video starts once they do.
 * @param {DiscoInviteProps} props - the event's title for the flier.
 * @returns {JSX.Element} the full screen invite.
 */
export default function DiscoInvite({ info }: DiscoInviteProps) {
  const device = useInviteDevice();
  const needsRotate = device.isMobile && device.isPortrait;
  const [stage, setStage] = useState<Stage>("waiting");
  const [curtainUp, setCurtainUp] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const autoStartTried = useRef(false);
  const music = useDiscoMusic();
  const { prepare: prepareMusic, startAt: startMusicAt, stop: stopMusic } = music;

  /**
   * plays the video from the top. if the browser wants a tap first, asks for one.
   * the curtain's always down when this runs: it's lowered once the clouds part.
   */
  const startVideo = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    stopMusic();
    prepareMusic();
    video.muted = false;
    video.currentTime = 0;
    video
      .play()
      .then(() => setStage("playing"))
      .catch((error: unknown) => {
        // NotAllowedError is the normal autoplay block; anything else is worth seeing in the console
        if (!(error instanceof DOMException && error.name === "NotAllowedError")) {
          console.error("disco invite: the video wouldn't play, asking for a tap instead", error);
        }
        setStage("tap");
      });
  };

  // start on our own as soon as the device is known and, on a phone, held sideways
  useEffect(() => {
    if (stage !== "waiting" || !device.known || needsRotate || autoStartTried.current) {
      return;
    }
    autoStartTried.current = true;
    startVideo();
  });

  // swap to the cloud loop the moment the video's clouds match its first frame
  useEffect(() => {
    const video = videoRef.current;
    if (stage !== "playing" || curtainUp || !video) {
      return;
    }
    return watchVideoTime(video, CLOUD_HANDOFF_S, () => setCurtainUp(true));
  }, [stage, curtainUp]);

  // just before the video fades its sound out, the song takes over in sync and
  // plays on under the flier. if the song isn't ready, the video keeps its own sound
  useEffect(() => {
    const video = videoRef.current;
    if (stage !== "playing" || !video) {
      return;
    }
    return watchVideoTime(video, MUSIC_HANDOFF_S, () => {
      if (startMusicAt(video.currentTime)) {
        video.muted = true;
      }
    });
  }, [stage, startMusicAt]);

  // hold on the clouds for a beat after the music ends, then part them
  useEffect(() => {
    if (stage !== "clouds") {
      return;
    }
    const timer = window.setTimeout(() => setStage("parting"), PART_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [stage]);

  const handleEnded = () => {
    setCurtainUp(true);
    setStage("clouds");
  };

  // the song picks up from wherever the video was skipped
  const handleSkip = () => {
    const video = videoRef.current;
    if (video && !music.playing) {
      startMusicAt(video.currentTime);
    }
    video?.pause();
    setCurtainUp(true);
    setStage("parting");
  };

  const handleVideoError = () => {
    console.error(
      "disco invite: the invite video failed to load, skipping straight to the flier. check the file exists in public/video/disco",
      videoRef.current?.error,
    );
    setStage("flier");
  };

  const handleParted = () => {
    setCurtainUp(false);
    setStage("flier");
  };

  const videoSrc = device.known ? (device.isMobile ? INVITE_VIDEO_MOBILE_SRC : INVITE_VIDEO_DESKTOP_SRC) : undefined;
  const videoShown = stage === "playing" || stage === "clouds";
  const flierShown = stage === "parting" || stage === "flier";
  const backgroundCloudsShown = stage === "waiting" || stage === "tap";

  return (
    <div className={styles.stage} style={THEME_VARS}>
      {flierShown && <DiscoFlier info={info} isMobile={device.isMobile} onReplay={startVideo} />}
      {backgroundCloudsShown && <CloudLoop />}

      <video
        ref={videoRef}
        className={`${styles.inviteVideo} ${videoShown ? styles.inviteVideoShown : ""}`}
        src={videoSrc}
        playsInline
        preload="auto"
        onEnded={handleEnded}
        onError={handleVideoError}
      />

      <CloudCurtain up={curtainUp} parting={stage === "parting"} onParted={handleParted} />

      {stage === "playing" && !curtainUp && (
        <button type="button" className={styles.skipButton} onClick={handleSkip}>
          skip
        </button>
      )}
      {flierShown && music.playing && (
        <button
          type="button"
          className={`${styles.skipButton} ${styles.soundButton}`}
          onClick={music.toggleMute}
          aria-pressed={music.muted}
        >
          {music.muted ? "sound on" : "sound off"}
        </button>
      )}
      {stage === "waiting" && needsRotate && <RotatePrompt />}
      {stage === "tap" && <StartPrompt onStart={startVideo} />}
    </div>
  );
}

/**
 * asks a phone held upright to turn sideways. the video starts on its own once it does.
 * @returns {JSX.Element} the prompt over the clouds.
 */
function RotatePrompt() {
  return (
    <div className={styles.prompt}>
      <div className={styles.promptCard}>
        <div className={styles.phone} aria-hidden="true" />
        <p className={styles.promptText}>Turn your phone sideways</p>
        <p className={styles.promptHint}>and turn your sound on</p>
      </div>
    </div>
  );
}

/**
 * a start button for when the browser won't autoplay a video with sound.
 * @param {object} props - component props.
 * @param {() => void} props.onStart - plays the video; must run straight from the tap.
 * @returns {JSX.Element} the prompt over the clouds.
 */
function StartPrompt({ onStart }: { onStart: () => void }) {
  return (
    <div className={styles.prompt}>
      <div className={styles.promptCard}>
        <p className={styles.promptText}>You&rsquo;re invited</p>
        <button type="button" className={styles.startButton} onClick={onStart}>
          Open your invite
        </button>
        <p className={styles.promptHint}>sound on</p>
      </div>
    </div>
  );
}
