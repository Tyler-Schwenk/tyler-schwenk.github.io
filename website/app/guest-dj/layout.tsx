import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

// the admin page's dark background, all the way to the edges like it
const GUEST_DJ_BACKGROUND_CSS = "html, body { background: #020617; }";

export const metadata: Metadata = {
  title: "Guest DJ",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#020617",
};

/**
 * Layout for /guest-dj: the admin page's dark background, kept out of search engines.
 * @param props.children - The guest dj page.
 */
export default function GuestDjLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{GUEST_DJ_BACKGROUND_CSS}</style>
      {children}
    </>
  );
}
