import { Suspense } from "react";
import SetReplay from "@/components/opium-den/SetReplay";
import { DEFAULT_PREVIEW_IMAGE, pageMetadata } from "@/lib/siteMetadata";

export const metadata = pageMetadata({
  title: "Past set",
  description: "A recorded DJ set from the Opium Den, with its chat replaying as it plays",
  path: "/opium-den/live/set",
  image: DEFAULT_PREVIEW_IMAGE,
});

/**
 * one recorded set replayed with its chat, picked by ?id=: the set's full view. a static
 * page that reads the query on the client, so new sets need no rebuild. the frame comes
 * from app/opium-den/layout.tsx, the player from the root layout.
 *
 * @returns {JSX.Element} the set page.
 */
export default function SetPage() {
  // useSearchParams needs a suspense boundary in a static export
  return (
    <Suspense>
      <SetReplay />
    </Suspense>
  );
}
