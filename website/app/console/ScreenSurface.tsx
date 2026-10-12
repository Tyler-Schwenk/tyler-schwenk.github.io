import type { ReactNode } from "react";
import { quadTransform, type ConsoleScreen } from "./sceneGeometry";

/**
 * A box at the screen's native resolution, warped in perspective onto where
 * that screen sits in the illustration. Its parent must be laid out in
 * illustration pixels. The transform also makes it the containing block for
 * `position: fixed` children, so a display panel that fills the viewport
 * fills the screen instead. Clicking (or enter/space on) it calls `onSelect`.
 * @param props.screen - Which screen, with its resolution and corners.
 * @param props.label - What selecting it does, for screen readers.
 * @param props.onSelect - Called when it's clicked or activated from the keyboard.
 * @param props.children - What's on it, laid out at native resolution.
 */
export default function ScreenSurface({
  screen,
  label,
  onSelect,
  children,
}: {
  screen: ConsoleScreen;
  label: string;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect();
      }}
      className="absolute left-0 top-0 cursor-zoom-in overflow-hidden bg-black"
      style={{
        width: screen.widthPx,
        height: screen.heightPx,
        transformOrigin: "0 0",
        transform: quadTransform(screen.quad, screen.widthPx, screen.heightPx),
      }}
    >
      {children}
    </div>
  );
}
