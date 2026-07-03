"use client";

import { InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes } from "react";

const FIELD_CLASSES =
  "block w-full rounded-[3px] border border-[var(--k-border-default)] bg-[var(--k-neutral-secondary-soft)] px-2.5 py-[7px] text-[13px] text-[var(--k-heading)] placeholder:text-[var(--k-body-subtle)] font-[family-name:var(--k-font-sans)] transition-colors duration-[120ms] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--k-border-brand)] focus:border-[var(--k-border-brand)] hover:border-[var(--k-border-default-strong)]";

/**
 * A retro-OS form field label, sized/colored per the design system.
 *
 * @param {LabelHTMLAttributes<HTMLLabelElement>} props - Standard label props.
 * @returns {JSX.Element} The label.
 */
export function KitchenLabel({ className = "", ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`block text-[13px] font-medium text-[var(--k-heading)] font-[family-name:var(--k-font-sans)] mb-1.5 ${className}`}
      {...rest}
    />
  );
}

/**
 * A retro-OS recessed text input.
 *
 * @param {InputHTMLAttributes<HTMLInputElement>} props - Standard input props.
 * @returns {JSX.Element} The input.
 */
export function KitchenInput({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD_CLASSES} ${className}`} {...rest} />;
}

/**
 * A retro-OS recessed textarea.
 *
 * @param {TextareaHTMLAttributes<HTMLTextAreaElement>} props - Standard textarea props.
 * @returns {JSX.Element} The textarea.
 */
export function KitchenTextarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD_CLASSES} resize-y ${className}`} {...rest} />;
}

/**
 * A file picker styled to match the rest of the retro-OS form controls --
 * the browser's native "Choose Files" button gets bordered/flat-button
 * treatment via the `file:` variant classes.
 *
 * @param {InputHTMLAttributes<HTMLInputElement>} props - Standard input props (type is forced to "file").
 * @returns {JSX.Element} The file input.
 */
export function KitchenFileInput({ className = "", ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <input
      type="file"
      className={`block w-full text-[13px] text-[var(--k-body)] font-[family-name:var(--k-font-sans)] file:mr-3 file:rounded-[3px] file:border file:border-[var(--k-border-default)] file:bg-[var(--k-neutral-primary-soft)] file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-[var(--k-heading)] hover:file:bg-[var(--k-neutral-secondary-medium)] ${className}`}
      {...rest}
    />
  );
}
