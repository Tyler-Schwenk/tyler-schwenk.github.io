import type { ReactNode } from "react";
import { ogCard, pageMetadata } from "@/lib/siteMetadata";

export const metadata = pageMetadata({
  title: "The Garden",
  description: "What's growing, a timelapse of it growing, and how it's going",
  path: "/garden",
  image: ogCard("garden", "pixel art seedling"),
});

/**
 * layout for /garden. only here to give the page its own title and link preview,
 * since the page itself is a client component and can't export metadata.
 * @param props.children - the garden page.
 */
export default function GardenLayout({ children }: { children: ReactNode }) {
  return children;
}
