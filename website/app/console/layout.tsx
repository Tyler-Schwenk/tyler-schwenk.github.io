import type { ReactNode } from "react";
import { ogCard, pageMetadata } from "@/lib/siteMetadata";

export const metadata = pageMetadata({
  title: "The Console",
  description: "The record console in our living room and what it's hooked up to",
  path: "/console",
  image: ogCard("console", "pixel art record console"),
});

/**
 * layout for /console. only here to give the page its own title and link preview,
 * since the page itself is a client component and can't export metadata.
 * @param props.children - the console page.
 */
export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return children;
}
