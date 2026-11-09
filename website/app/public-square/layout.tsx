import type { ReactNode } from "react";
import { ogCard, pageMetadata } from "@/lib/siteMetadata";

export const metadata = pageMetadata({
  title: "Round Table",
  description: "A little forum on my website. Post ideas, get feedback, anonymously or not.",
  path: "/public-square",
  image: ogCard("public-square", "pixel art round table with people chatting"),
});

/**
 * layout for /public-square. only here to give the page its own title and link preview,
 * since the page itself is a client component and can't export metadata.
 * @param props.children - the public-square page.
 */
export default function PublicSquareLayout({ children }: { children: ReactNode }) {
  return children;
}
