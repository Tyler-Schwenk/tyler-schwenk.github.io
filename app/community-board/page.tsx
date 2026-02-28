"use client";

import Navigation from "@/components/Navigation";
import { useMemo, useState, useRef } from "react";
import { COMMUNITY_BOARD_LINKS } from "@/data/communityBoardLinks";

const BOARD_BACKGROUND_IMAGE_PATH = "/images/cork bg 2.avif";
const BOARD_BACKGROUND_SIZE = "420px";
const BOARD_WIDTH_PX = 2400;
const BOARD_HEIGHT_PX = 1600;
const MAX_ZOOM = 1.8;
const ZOOM_SENSITIVITY = 0.001;
const DEFAULT_SCALE = 1.0;
const DEFAULT_OFFSET_X = -400;
const DEFAULT_OFFSET_Y = -200;
const NOTE_WIDTH_PX = 220;
const HEADER_NOTE_WIDTH_PX = 280;

const NOTE_COLORS = [
  "bg-yellow-200 text-amber-950",
  "bg-amber-200 text-amber-950",
  "bg-orange-200 text-amber-950",
  "bg-lime-200 text-lime-950",
];

const HEADER_COLOR = "bg-blue-300 text-blue-950";

const NOTE_POSITIONS = [
  // Friends Header
  { x: 200, y: 120 },
  // Friends (6 items)
  { x: 150, y: 280 },
  { x: 420, y: 260 },
  { x: 690, y: 290 },
  { x: 180, y: 520 },
  { x: 460, y: 540 },
  { x: 720, y: 500 },
  // Local Orgs Header
  { x: 1020, y: 120 },
  // Local Orgs (4 items)
  { x: 1000, y: 280 },
  { x: 1280, y: 300 },
  { x: 1020, y: 520 },
  { x: 1300, y: 540 },
  // Other Inspirations Header
  { x: 1780, y: 120 },
  // Other Inspirations (2 items)
  { x: 1800, y: 280 },
  { x: 1820, y: 480 },
  // Personal Links Header
  { x: 1780, y: 720 },
  // Personal Links (1 item)
  { x: 1800, y: 880 },
];

type DragState = {
  isDragging: boolean;
  lastX: number;
  lastY: number;
};

/**
 * Clamps a numeric value into an inclusive range.
 *
 * @param {number} value - Value to clamp.
 * @param {number} minimum - Minimum allowed value.
 * @param {number} maximum - Maximum allowed value.
 * @returns {number} Clamped numeric result.
 */
function clamp(value: number, minimum: number, maximum: number): number {
  if (value < minimum) {
    return minimum;
  }

  if (value > maximum) {
    return maximum;
  }

  return value;
}

/**
 * Calculates the minimum zoom level needed to fill the viewport.
 *
 * @param {number} viewportWidth - Viewport width in pixels.
 * @param {number} viewportHeight - Viewport height in pixels.
 * @returns {number} Minimum zoom scale to cover viewport.
 */
function calculateMinZoom(viewportWidth: number, viewportHeight: number): number {
  const minZoomX = viewportWidth / BOARD_WIDTH_PX;
  const minZoomY = viewportHeight / BOARD_HEIGHT_PX;
  return Math.max(minZoomX, minZoomY);
}

/**
 * Clamps pan offsets to prevent scrolling beyond board boundaries.
 *
 * @param {number} offsetX - Current X offset.
 * @param {number} offsetY - Current Y offset.
 * @param {number} currentScale - Current zoom scale.
 * @param {number} viewportWidth - Viewport width in pixels.
 * @param {number} viewportHeight - Viewport height in pixels.
 * @returns {{x: number, y: number}} Clamped offsets.
 */
function clampToBounds(
  offsetX: number,
  offsetY: number,
  currentScale: number,
  viewportWidth: number,
  viewportHeight: number
): { x: number; y: number } {
  const scaledBoardWidth = BOARD_WIDTH_PX * currentScale;
  const scaledBoardHeight = BOARD_HEIGHT_PX * currentScale;

  const minOffsetX = viewportWidth - scaledBoardWidth;
  const maxOffsetX = 0;
  const minOffsetY = viewportHeight - scaledBoardHeight;
  const maxOffsetY = 0;

  return {
    x: clamp(offsetX, minOffsetX, maxOffsetX),
    y: clamp(offsetY, minOffsetY, maxOffsetY),
  };
}

/**
 * Renders the Community Board as a full-screen 2-axis corkboard with drag and zoom.
 *
 * @returns {JSX.Element} Full-screen pan/zoom corkboard page.
 */
export default function CommunityBoard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [offsetX, setOffsetX] = useState(DEFAULT_OFFSET_X);
  const [offsetY, setOffsetY] = useState(DEFAULT_OFFSET_Y);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    lastX: 0,
    lastY: 0,
  });

  const boardStyle = useMemo(
    () => ({
      width: `${BOARD_WIDTH_PX}px`,
      height: `${BOARD_HEIGHT_PX}px`,
      backgroundImage: `url('${BOARD_BACKGROUND_IMAGE_PATH}')`,
      backgroundRepeat: "repeat",
      backgroundSize: BOARD_BACKGROUND_SIZE,
      transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
      transformOrigin: "top left",
    }),
    [offsetX, offsetY, scale],
  );

  /**
   * Starts a drag interaction.
   *
   * @param {React.PointerEvent<HTMLDivElement>} event - Pointer down event.
   */
  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    setDragState({
      isDragging: true,
      lastX: event.clientX,
      lastY: event.clientY,
    });
  }

  /**
   * Updates pan offsets while dragging.
   *
   * @param {React.PointerEvent<HTMLDivElement>} event - Pointer move event.
   */
  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.isDragging || !containerRef.current) {
      return;
    }

    const deltaX = event.clientX - dragState.lastX;
    const deltaY = event.clientY - dragState.lastY;

    const newOffsetX = offsetX + deltaX;
    const newOffsetY = offsetY + deltaY;

    const { width, height } = containerRef.current.getBoundingClientRect();
    const clamped = clampToBounds(newOffsetX, newOffsetY, scale, width, height);

    setOffsetX(clamped.x);
    setOffsetY(clamped.y);
    setDragState((previousDragState) => ({
      ...previousDragState,
      lastX: event.clientX,
      lastY: event.clientY,
    }));
  }

  /**
   * Ends drag mode.
   */
  function handlePointerUp() {
    setDragState((previousDragState) => ({
      ...previousDragState,
      isDragging: false,
    }));
  }

  /**
   * Zooms the board in or out using wheel input, centered on cursor position.
   *
   * @param {React.WheelEvent<HTMLDivElement>} event - Wheel event.
   */
  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();

    if (!containerRef.current) {
      return;
    }

    const { width, height } = containerRef.current.getBoundingClientRect();
    const minZoom = calculateMinZoom(width, height);
    const newScale = clamp(scale - event.deltaY * ZOOM_SENSITIVITY, minZoom, MAX_ZOOM);
    
    if (newScale === scale) {
      return;
    }

    const mouseX = event.clientX;
    const mouseY = event.clientY;

    const boardPointX = (mouseX - offsetX) / scale;
    const boardPointY = (mouseY - offsetY) / scale;

    const newOffsetX = mouseX - boardPointX * newScale;
    const newOffsetY = mouseY - boardPointY * newScale;

    const clamped = clampToBounds(newOffsetX, newOffsetY, newScale, width, height);

    setScale(newScale);
    setOffsetX(clamped.x);
    setOffsetY(clamped.y);
  }

  return (
    <>
      <Navigation />
      <main className="fixed inset-0 overflow-hidden bg-stone-900">
        <div
          ref={containerRef}
          className="absolute inset-0"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onWheel={handleWheel}
          style={{ cursor: dragState.isDragging ? "grabbing" : "grab" }}
        >
          <div className="absolute left-0 top-0" style={boardStyle}>
            {COMMUNITY_BOARD_LINKS.map((entry, index) => {
              const notePosition = NOTE_POSITIONS[index % NOTE_POSITIONS.length];
              const noteColorClass = entry.isHeader 
                ? HEADER_COLOR 
                : NOTE_COLORS[index % NOTE_COLORS.length];
              const noteWidth = entry.isHeader ? HEADER_NOTE_WIDTH_PX : NOTE_WIDTH_PX;

              if (entry.isHeader) {
                return (
                  <div
                    key={entry.id}
                    className={`absolute rounded-md p-4 shadow-[0_8px_18px_rgba(0,0,0,0.3)] ${noteColorClass}`}
                    style={{
                      left: `${notePosition.x}px`,
                      top: `${notePosition.y}px`,
                      width: `${noteWidth}px`,
                    }}
                  >
                    <h2 className="text-lg font-bold leading-snug text-center">{entry.name}</h2>
                  </div>
                );
              }

              return (
                <a
                  key={entry.id}
                  href={entry.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`absolute rounded-md p-4 shadow-[0_8px_18px_rgba(0,0,0,0.3)] hover:scale-[1.02] transition-transform ${noteColorClass}`}
                  style={{
                    left: `${notePosition.x}px`,
                    top: `${notePosition.y}px`,
                    width: `${noteWidth}px`,
                  }}
                >
                  <h2 className="text-sm font-semibold leading-snug">{entry.name}</h2>
                  <p className="mt-2 text-xs opacity-90 leading-snug">{entry.description}</p>
                </a>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
