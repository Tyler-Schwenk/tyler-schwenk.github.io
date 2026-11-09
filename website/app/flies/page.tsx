import Navigation from "@/components/Navigation";
import FlyKillCounter from "@/components/flies/FlyKillCounter";
import { pageMetadata } from "@/lib/siteMetadata";

// the fly card is 3:2, not the usual 1200x630
const FLIES_PREVIEW_WIDTH_PX = 1200;
const FLIES_PREVIEW_HEIGHT_PX = 800;

export const metadata = pageMetadata({
  title: "Fly Kill Count",
  description: "Every fly killed in our house, who got it, and the pile of bodies.",
  path: "/flies",
  image: {
    url: "/images/og/flies.jpg",
    width: FLIES_PREVIEW_WIDTH_PX,
    height: FLIES_PREVIEW_HEIGHT_PX,
    alt: "pixel art dead fly with x eyes",
  },
});

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
