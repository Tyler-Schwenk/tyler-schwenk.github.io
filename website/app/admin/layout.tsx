import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

// the admin page is dark all the way to the edges, including the overscroll
// bounce on phones, which shows the body rather than the page
const ADMIN_BACKGROUND_CSS = "html, body { background: #020617; }";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// viewport-fit=cover so the bottom tab bar can pad itself clear of the iPhone home indicator
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#020617",
};

/**
 * Layout for /admin: dark page background, kept out of search engines.
 * @param props.children - The admin page.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{ADMIN_BACKGROUND_CSS}</style>
      {children}
    </>
  );
}
