import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pac-Tyler | Tyler Schwenk",
  description: "A gamified personal challenge where I bike every street in San Diego",
};

export default function PacTylerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
