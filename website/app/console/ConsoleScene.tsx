"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import ControlOverlay from "../display/ControlOverlay";
import { SHORTCUTS } from "../display/displayConfig";
import { BPM_VIEW_LABELS, DisplayScreen, type ScreenSide } from "../display/displayRotation";
import type { ControlState } from "../display/kioskControl";
import ScreenSurface from "./ScreenSurface";
import {
  LAPTOP_SCREEN,
  LID_SHADE_QUAD,
  MONITOR_SCREEN,
  SCENE_IMAGE_SIZE_PX,
  SCENE_IMAGE_SRC,
  quadBounds,
  quadPoints,
  type ConsoleScreen,
} from "./sceneGeometry";

// share of the scene area the whole illustration takes up (a little short of it, so the
// edges show as it tilts), and a zoomed-in screen
const SCENE_FIT = 0.96;
const ZOOM_FIT = 0.96;
// how far the scene leans toward the mouse at the edge of the area: just enough to read as 3d
const MAX_TILT_DEG = 2;
const TILT_PERSPECTIVE_PX = 1600;
// the "camera" move into and out of a screen
const ZOOM_TRANSITION = "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)";
// the record player's clear lid: a faint frosting over the bottom of the laptop screen, and the glint on its edge
const LID_SHADE_FILL = "rgba(214, 222, 235, 0.16)";
const LID_EDGE_STROKE = "rgba(255, 255, 255, 0.45)";
const LID_EDGE_WIDTH_PX = 1.5;

// tilting only makes sense with a mouse, and not for people who've asked for less motion
const TILT_QUERY = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

const SCREENS: Record<ScreenSide, ConsoleScreen> = { primary: MONITOR_SCREEN, secondary: LAPTOP_SCREEN };

/** Width and height in css px. */
interface Size {
  width: number;
  height: number;
}

/**
 * Tracks an element's size.
 * @returns A ref for the element, and its size (null until measured).
 */
function useElementSize(): [React.RefObject<HTMLDivElement | null>, Size | null] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}

/**
 * The stage's transform: the whole illustration fitted and centred, or zoomed so one screen fills the area.
 * @param area - The scene area's size.
 * @param focus - The screen to zoom into, or null.
 * @returns A css transform for the stage (origin top left).
 */
function stageTransform(area: Size, focus: ScreenSide | null): string {
  if (!focus) {
    const scale = (Math.min(area.width, area.height) * SCENE_FIT) / SCENE_IMAGE_SIZE_PX;
    const x = (area.width - SCENE_IMAGE_SIZE_PX * scale) / 2;
    const y = (area.height - SCENE_IMAGE_SIZE_PX * scale) / 2;
    return `translate(${x}px, ${y}px) scale(${scale})`;
  }
  const bounds = quadBounds(SCREENS[focus].quad);
  const scale = Math.min((area.width * ZOOM_FIT) / bounds.width, (area.height * ZOOM_FIT) / bounds.height);
  const x = area.width / 2 - (bounds.x + bounds.width / 2) * scale;
  const y = area.height / 2 - (bounds.y + bounds.height / 2) * scale;
  return `translate(${x}px, ${y}px) scale(${scale})`;
}

/**
 * The console drawn like a CAD render, with the simulated screens warped onto
 * it in perspective. Tapping a screen glides the view in until it fills the
 * area; tapping again (or the button) glides back out. With a mouse the
 * scene leans very slightly toward the pointer, so it reads as a space.
 * @param props.state - Control state the screens show.
 * @param props.clockSlot - Rotation clock slot (from useRotationClockSlot).
 * @param props.focus - The zoomed-in screen, or null.
 * @param props.onFocus - Zooms into a screen, or out with null.
 */
export default function ConsoleScene({
  state,
  clockSlot,
  focus,
  onFocus,
}: {
  state: ControlState;
  clockSlot: number | null;
  focus: ScreenSide | null;
  onFocus: (side: ScreenSide | null) => void;
}) {
  const [areaRef, area] = useElementSize();
  const tiltRef = useRef<HTMLDivElement>(null);

  // writes the tilt straight to the element, so moving the pointer doesn't re-render the screens
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const tilt = tiltRef.current;
    if (!tilt || !window.matchMedia(TILT_QUERY).matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetX = (event.clientX - bounds.left) / bounds.width - 0.5;
    const offsetY = (event.clientY - bounds.top) / bounds.height - 0.5;
    tilt.style.transform = focus ? "" : `rotateX(${-offsetY * 2 * MAX_TILT_DEG}deg) rotateY(${offsetX * 2 * MAX_TILT_DEG}deg)`;
  };

  /**
   * A screen with what the simulation shows on it, tappable to zoom.
   * @param side - Which screen.
   * @returns The warped screen.
   */
  const renderScreen = (side: ScreenSide) => (
    <ScreenSurface
      screen={SCREENS[side]}
      label={focus === side ? `zoom out from the ${SCREENS[side].label}` : `zoom into the ${SCREENS[side].label}`}
      onSelect={() => onFocus(focus === side ? null : side)}
    >
      {clockSlot !== null && <DisplayScreen side={side} state={state} clockSlot={clockSlot} />}
      {side === "secondary" && <ControlOverlay state={state} shortcuts={SHORTCUTS} bpmViewLabels={BPM_VIEW_LABELS} />}
    </ScreenSurface>
  );

  return (
    <div
      ref={areaRef}
      className="relative h-full w-full overflow-hidden"
      style={{ perspective: TILT_PERSPECTIVE_PX }}
      onPointerMove={handlePointerMove}
      onClick={(event) => {
        // a tap off the screens while zoomed goes back out
        if (focus && event.target === event.currentTarget) onFocus(null);
      }}
    >
      {area && (
        <div ref={tiltRef} className="absolute inset-0 transition-transform duration-300 ease-out" style={{ pointerEvents: "none" }}>
          <div
            className="absolute left-0 top-0"
            style={{
              width: SCENE_IMAGE_SIZE_PX,
              height: SCENE_IMAGE_SIZE_PX,
              transformOrigin: "0 0",
              transform: stageTransform(area, focus),
              transition: ZOOM_TRANSITION,
              pointerEvents: "auto",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static export, and it's laid out in its own pixels */}
            <img
              src={SCENE_IMAGE_SRC}
              alt="Corner console: a laptop screen behind a record player on top, a monitor on the shelf below, speakers on either side"
              width={SCENE_IMAGE_SIZE_PX}
              height={SCENE_IMAGE_SIZE_PX}
              className="absolute left-0 top-0 select-none rounded-2xl shadow-2xl shadow-black/60"
              draggable={false}
              // a tap on the room (not a screen) while zoomed goes back out
              onClick={() => focus && onFocus(null)}
            />
            {renderScreen("secondary")}
            {renderScreen("primary")}
            <svg
              className="pointer-events-none absolute left-0 top-0"
              width={SCENE_IMAGE_SIZE_PX}
              height={SCENE_IMAGE_SIZE_PX}
              viewBox={`0 0 ${SCENE_IMAGE_SIZE_PX} ${SCENE_IMAGE_SIZE_PX}`}
            >
              <polygon points={quadPoints(LID_SHADE_QUAD)} fill={LID_SHADE_FILL} />
              <line
                x1={LID_SHADE_QUAD.topLeft.x}
                y1={LID_SHADE_QUAD.topLeft.y}
                x2={LID_SHADE_QUAD.topRight.x}
                y2={LID_SHADE_QUAD.topRight.y}
                stroke={LID_EDGE_STROKE}
                strokeWidth={LID_EDGE_WIDTH_PX}
              />
            </svg>
          </div>
        </div>
      )}
      {focus && (
        <button
          type="button"
          onClick={() => onFocus(null)}
          className="absolute right-3 top-3 z-10 min-h-11 rounded-lg border border-slate-600 bg-slate-900/85 px-4 font-mono text-sm text-slate-200 hover:bg-slate-800"
        >
          zoom out
        </button>
      )}
    </div>
  );
}
