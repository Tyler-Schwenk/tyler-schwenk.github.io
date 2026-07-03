"use client";

import { ButtonHTMLAttributes } from "react";

export type KitchenButtonVariant = "primary" | "secondary" | "tertiary" | "ghost" | "danger";
export type KitchenButtonSize = "sm" | "base" | "lg";

const VARIANT_CLASSES: Record<KitchenButtonVariant, string> = {
  primary:
    "bg-[var(--k-button-primary)] text-[var(--k-button-primary-text)] border-[var(--k-border-default-strong)] hover:bg-[var(--k-brand)] hover:text-white",
  secondary:
    "bg-[var(--k-button-secondary)] text-[var(--k-white)] border-[var(--k-border-default-strong)] hover:bg-[var(--k-brand-strong)]",
  tertiary:
    "bg-[var(--k-neutral-primary-soft)] text-[var(--k-heading)] border-[var(--k-border-default)] hover:bg-[var(--k-neutral-secondary-medium)]",
  ghost:
    "bg-transparent text-[var(--k-heading)] border-transparent hover:bg-[var(--k-neutral-secondary-medium)]",
  danger:
    "bg-[var(--k-danger)] text-[var(--k-white)] border-[var(--k-border-danger-subtle)] hover:brightness-110",
};

const SIZE_CLASSES: Record<KitchenButtonSize, string> = {
  sm: "text-xs px-2.5 py-[5px]",
  base: "text-[13px] px-3.5 py-[7px]",
  lg: "text-sm px-[18px] py-[9px]",
};

interface KitchenButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: KitchenButtonVariant;
  size?: KitchenButtonSize;
}

/**
 * A flat, bordered retro-OS button with a pressed-key active state.
 *
 * @param {KitchenButtonProps} props - Standard button props plus variant/size.
 * @returns {JSX.Element} The styled button.
 */
export default function KitchenButton({
  variant = "tertiary",
  size = "base",
  className = "",
  disabled,
  ...rest
}: KitchenButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-[3px] border font-medium font-[family-name:var(--k-font-sans)] transition-colors duration-[120ms] active:translate-y-px active:shadow-[inset_0_2px_4px_var(--k-inset-press)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--k-border-brand)] ${
        disabled
          ? "bg-[var(--k-disabled)] text-[var(--k-fg-disabled)] border-[var(--k-border-default-subtle)] cursor-not-allowed"
          : VARIANT_CLASSES[variant]
      } ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    />
  );
}
