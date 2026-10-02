import type { ReactNode } from "react";

// every display panel is a fixed, full-screen layer, so the page never needs to scroll.
// without this the kiosk browser can show scrollbars along the edges of the screen
const NO_SCROLL_CSS = "html, body { overflow: hidden; }";

/**
 * Layout for the /display kiosk page: turns off page scrolling for this route only.
 * @param props.children - The display page.
 */
export default function DisplayLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{NO_SCROLL_CSS}</style>
      {children}
    </>
  );
}
