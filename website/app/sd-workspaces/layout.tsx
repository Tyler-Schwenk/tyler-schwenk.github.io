import type { ReactNode } from "react";
import { ogCard, pageMetadata } from "@/lib/siteMetadata";

export const metadata = pageMetadata({
  title: "SD Workspaces",
  description: "Rating the best coffee shops and cafes to work from in San Diego",
  path: "/sd-workspaces",
  image: ogCard("sd-workspaces", "pixel art coffee mug"),
});

/**
 * layout for /sd-workspaces. only here to give the page its own title and link preview,
 * since the page itself is a client component and can't export metadata.
 * @param props.children - the sd-workspaces page.
 */
export default function SdWorkspacesLayout({ children }: { children: ReactNode }) {
  return children;
}
