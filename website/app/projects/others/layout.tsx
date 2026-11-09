import type { ReactNode } from "react";
import { ogCard, pageMetadata } from "@/lib/siteMetadata";

export const metadata = pageMetadata({
  title: "Inspiration/Misc",
  description: "Random things that inspire me or that I find interesting",
  path: "/projects/others",
  image: ogCard("others", "pixel art light bulb"),
});

/**
 * layout for /projects/others. only here to give the page its own title and link preview,
 * since the page itself is a client component and can't export metadata.
 * @param props.children - the others page.
 */
export default function OthersLayout({ children }: { children: ReactNode }) {
  return children;
}
