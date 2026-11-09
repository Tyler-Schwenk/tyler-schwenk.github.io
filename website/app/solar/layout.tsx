import type { ReactNode } from "react";
import { ogCard, pageMetadata } from "@/lib/siteMetadata";

export const metadata = pageMetadata({
  title: "Solar Setup",
  description: "The solar setup on our roof: panels, monitoring, and what it cost",
  path: "/solar",
  image: ogCard("solar", "pixel art solar panels on a roof"),
});

/**
 * layout for /solar. only here to give the page its own title and link preview,
 * since the page itself is a client component and can't export metadata.
 * @param props.children - the solar page.
 */
export default function SolarLayout({ children }: { children: ReactNode }) {
  return children;
}
