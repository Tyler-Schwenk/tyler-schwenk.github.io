import type { ReactNode } from "react";
import Navigation from "@/components/Navigation";

/**
 * the frame around every opium den page: the home button and the den's look (.den-page
 * in globals.css). the player isn't here, it's site-wide (app/layout.tsx). see
 * website/docs/OPIUM_DEN.md.
 *
 * @param {object} props
 * @param {ReactNode} props.children - the page.
 * @returns {JSX.Element} the layout.
 */
export default function OpiumDenLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navigation />
      {/* one screen tall, less the player bar the body is padded for, so short pages (the room) don't scroll */}
      <div className="den-page min-h-[calc(100dvh-var(--den-bar-clearance,0px))] bg-den-bg text-den-ink">
        {children}
      </div>
    </>
  );
}
