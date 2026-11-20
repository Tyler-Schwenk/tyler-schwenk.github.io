import type { ReactNode } from "react";
import Navigation from "@/components/Navigation";
import DenPlayerProvider from "@/components/opium-den/DenPlayerProvider";

/**
 * the frame around every opium den page: the home button, the den's look (.den-page in
 * globals.css), and the shared player, so audio carries on between the den and the live
 * room. see website/docs/OPIUM_DEN.md.
 *
 * @param {object} props
 * @param {ReactNode} props.children - the page.
 * @returns {JSX.Element} the layout.
 */
export default function OpiumDenLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navigation />
      <div className="den-page min-h-screen bg-den-bg text-den-ink">
        <DenPlayerProvider>{children}</DenPlayerProvider>
      </div>
    </>
  );
}
