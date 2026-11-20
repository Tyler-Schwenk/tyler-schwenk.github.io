import { Suspense } from "react";
import AlertsLanding from "@/components/opium-den/AlertsLanding";
import { DEFAULT_PREVIEW_IMAGE, pageMetadata } from "@/lib/siteMetadata";

export const metadata = pageMetadata({
  title: "Live alerts",
  description: "Get an email when there's a live DJ set in the Opium Den",
  path: "/opium-den/live/alerts",
  image: DEFAULT_PREVIEW_IMAGE,
});

/**
 * the live alerts page: confirms or unsubscribes from an email's link (?confirm= or
 * ?unsubscribe=), and is the signup otherwise. the frame comes from
 * app/opium-den/layout.tsx, the player from the root layout.
 *
 * @returns {JSX.Element} the alerts page.
 */
export default function AlertsPage() {
  // useSearchParams needs a suspense boundary in a static export
  return (
    <Suspense>
      <AlertsLanding />
    </Suspense>
  );
}
