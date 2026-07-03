"use client";

import { ReactNode } from "react";

interface NeoBlockProps {
  children: ReactNode;
  className?: string;
  background?: string;
  floating?: boolean;
}

/**
 * A neobrutalist "block": a flat rectangle with a thick border and a hard
 * offset shadow, the default content container for this theme. No title-bar
 * chrome -- the border and shadow alone carry the container's identity. See
 * website/docs/themes/neobrutalism.md -> cards.md.
 *
 * @param {NeoBlockProps} props - Component props.
 * @param {ReactNode} props.children - Block content.
 * @param {string} [props.className] - Extra classes (e.g. padding overrides).
 * @param {string} [props.background] - Background color class; defaults to the neutral surface.
 * @param {boolean} [props.floating=true] - Whether to use the larger `shadow-lg` (floating) vs `shadow-md` (in-flow).
 * @returns {JSX.Element} The block.
 */
export default function NeoBlock({
  children,
  className = "",
  background = "bg-[var(--n-neutral-primary-soft)]",
  floating = true,
}: NeoBlockProps) {
  return (
    <div
      className={`border-[3px] border-[var(--n-border-default)] p-5 md:p-6 ${background} ${
        floating ? "shadow-[var(--n-shadow-lg)]" : "shadow-[var(--n-shadow-md)]"
      } ${className}`}
    >
      {children}
    </div>
  );
}
