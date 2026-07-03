"use client";

interface NeoBadgeProps {
  children: React.ReactNode;
  color?: string;
  textColor?: string;
}

/**
 * A small bordered neobrutalist badge/tag -- flat fill, bold uppercase text,
 * no radius. Used for nicknames, timestamps, and short metadata.
 *
 * @param {NeoBadgeProps} props - Component props.
 * @param {React.ReactNode} props.children - Badge label.
 * @param {string} [props.color] - Background color class; defaults to the neutral surface.
 * @param {string} [props.textColor] - Text color class; defaults to heading.
 * @returns {JSX.Element} The badge.
 */
export default function NeoBadge({
  children,
  color = "bg-[var(--n-neutral-secondary-soft)]",
  textColor = "text-[var(--n-heading)]",
}: NeoBadgeProps) {
  return (
    <span
      className={`inline-flex items-center border-2 border-[var(--n-border-default)] px-2 py-0.5 text-xs font-bold uppercase tracking-wide font-[family-name:var(--n-font-sans)] ${color} ${textColor}`}
    >
      {children}
    </span>
  );
}
