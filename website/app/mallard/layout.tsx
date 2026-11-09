import type { ReactNode } from "react";
import { ogCard, pageMetadata } from "@/lib/siteMetadata";

export const metadata = pageMetadata({
  title: "Mallard Counter",
  description: "The Mallard Counter is to be taken seriously.",
  path: "/mallard",
  image: ogCard("mallard", "pixel art mallard duck"),
});

/**
 * layout for /mallard. only here to give the page its own title and link preview,
 * since the page itself is a client component and can't export metadata.
 * @param props.children - the mallard page.
 */
export default function MallardLayout({ children }: { children: ReactNode }) {
  return children;
}
