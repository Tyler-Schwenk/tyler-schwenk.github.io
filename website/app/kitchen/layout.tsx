import type { ReactNode } from "react";
import { ogCard, pageMetadata } from "@/lib/siteMetadata";

export const metadata = pageMetadata({
  title: "The Kitchen",
  description: "Recipes and the cookbook to download",
  path: "/kitchen",
  image: ogCard("kitchen", "pixel art chef hat"),
});

/**
 * layout for /kitchen. only here to give the page its own title and link preview,
 * since the page itself is a client component and can't export metadata.
 * @param props.children - the kitchen page.
 */
export default function KitchenLayout({ children }: { children: ReactNode }) {
  return children;
}
