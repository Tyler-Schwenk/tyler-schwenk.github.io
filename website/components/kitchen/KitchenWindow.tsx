"use client";

import { ReactNode } from "react";

interface KitchenWindowProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  floating?: boolean;
  className?: string;
  bodyClassName?: string;
}

/**
 * A retro desktop-OS "window": a title bar over a bordered body.
 *
 * The default content container for The Kitchen section (see
 * website/docs/themes/cookbook.md -> cards.md). Floating windows get the
 * warm directional shadow; in-flow windows (the default page layout) don't.
 *
 * @param {KitchenWindowProps} props - Component props.
 * @param {string} props.title - Title-bar label.
 * @param {ReactNode} props.children - Body content.
 * @param {ReactNode} [props.actions] - Optional controls shown on the right of the title bar.
 * @param {boolean} [props.floating=false] - Whether to apply the floating window shadow.
 * @param {string} [props.className] - Extra classes on the outer frame.
 * @param {string} [props.bodyClassName] - Extra classes on the body.
 * @returns {JSX.Element} The window chrome wrapping the given content.
 */
export default function KitchenWindow({
  title,
  children,
  actions,
  floating = false,
  className = "",
  bodyClassName = "",
}: KitchenWindowProps) {
  return (
    <div
      className={`border border-[var(--k-border-default)] rounded-[3px] overflow-hidden ${className}`}
      style={floating ? { boxShadow: "var(--k-shadow-window)" } : undefined}
    >
      <div className="h-8 flex items-center justify-between gap-2 px-3 border-b border-[var(--k-border-default)] bg-[var(--k-menu-bar)]">
        <span className="text-[13px] font-semibold text-[var(--k-heading)] font-[family-name:var(--k-font-sans)] truncate">
          {title}
        </span>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div className={`bg-[var(--k-neutral-primary-soft)] p-5 md:p-6 ${bodyClassName}`}>{children}</div>
    </div>
  );
}
