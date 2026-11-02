import type { Metadata } from "next";
import { Suspense } from "react";
import KilnConsole from "@/components/kiln/KilnConsole";

export const metadata: Metadata = {
  title: "Kiln | Tyler Schwenk",
  description: "Live temperature, rate of rise, and past firings from the kiln.",
};

/**
 * the kiln page. the console reads ?firing= from the url, which needs a suspense boundary
 * in a static export.
 *
 * @returns {JSX.Element} the page.
 */
export default function KilnPage() {
  return (
    <Suspense fallback={<div className="kiln-theme" />}>
      <KilnConsole />
    </Suspense>
  );
}
