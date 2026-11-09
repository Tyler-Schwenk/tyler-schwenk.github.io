import { Suspense } from "react";
import KilnConsole from "@/components/kiln/KilnConsole";
import { ogCard, pageMetadata } from "@/lib/siteMetadata";

export const metadata = pageMetadata({
  title: "Kiln",
  description: "Live temperature, rate of rise, and past firings from the kiln.",
  path: "/kiln",
  image: ogCard("kiln", "pixel art kiln"),
});

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
