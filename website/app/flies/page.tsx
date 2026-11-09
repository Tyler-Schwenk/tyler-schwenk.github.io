import type { Metadata } from "next";
import Navigation from "@/components/Navigation";
import FlyKillCounter from "@/components/flies/FlyKillCounter";

export const metadata: Metadata = {
  title: "Fly Kill Count",
  description: "Every fly killed in our house, who got it, and the pile of bodies.",
};

/**
 * the house fly kill counter. everything's live from the backend, so the page
 * itself is just the shell.
 *
 * @returns {JSX.Element} the page.
 */
export default function FliesPage() {
  return (
    <>
      <Navigation />
      <FlyKillCounter />
    </>
  );
}
