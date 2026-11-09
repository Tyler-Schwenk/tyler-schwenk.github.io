import { ogCard, pageMetadata } from "@/lib/siteMetadata";

export const metadata = pageMetadata({
  title: "Pac-Tyler",
  description: "A gamified personal challenge where I bike every street in San Diego",
  path: "/pac-tyler",
  image: ogCard("pac-tyler", "pixel art pac-man"),
});

/**
 * layout for /pac-tyler. passes the page through and sets its title and link preview.
 * @param props.children - the pac-tyler page.
 */
export default function PacTylerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
