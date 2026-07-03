"use client";

import { ButtonHTMLAttributes } from "react";

export type NeoButtonVariant = "primary" | "secondary" | "tertiary" | "danger" | "ghost";
export type NeoButtonSize = "sm" | "base" | "lg";

const VARIANT_CLASSES: Record<NeoButtonVariant, string> = {
  primary: "bg-[var(--n-brand)] text-black",
  secondary: "bg-[var(--n-pink)] text-white",
  tertiary: "bg-[var(--n-neutral-primary-soft)] text-[var(--n-heading)]",
  danger: "bg-[var(--n-danger)] text-white",
  ghost: "bg-transparent text-[var(--n-heading)] hover:bg-[var(--n-brand-softer)]",
};

const SIZE_CLASSES: Record<NeoButtonSize, string> = {
  sm: "text-xs px-3 py-1.5",
  base: "text-sm px-4 py-[9px]",
  lg: "text-base px-5 py-[11px]",
};

interface NeoButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: NeoButtonVariant;
  size?: NeoButtonSize;
}

/**
 * A flat neobrutalist block button: thick border, hard offset shadow at
 * rest, and a "press" on click -- the shadow disappears and the button
 * translates flush against the page. See website/docs/themes/neobrutalism.md.
 *
 * @param {NeoButtonProps} props - Standard button props plus variant/size.
 * @returns {JSX.Element} The styled button.
 */
export default function NeoButton({
  variant = "tertiary",
  size = "base",
  className = "",
  disabled,
  ...rest
}: NeoButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 border-[3px] font-[family-name:var(--n-font-sans)] font-bold uppercase tracking-wide transition-[transform,box-shadow] duration-100 ease-linear focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-[var(--n-brand)] ${
        disabled
          ? "bg-[var(--n-disabled)] text-[var(--n-fg-disabled)] border-[var(--n-border-default-subtle)] cursor-not-allowed shadow-none"
          : `border-[var(--n-border-default)] shadow-[var(--n-shadow-sm)] hover:shadow-[var(--n-shadow-md)] active:shadow-none active:translate-x-1 active:translate-y-1 ${VARIANT_CLASSES[variant]}`
      } ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    />
  );
}
