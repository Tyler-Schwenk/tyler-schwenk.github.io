"use client";

import { InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes } from "react";

const FIELD_CLASSES =
  "block w-full border-[3px] border-[var(--n-border-default)] bg-[var(--n-neutral-primary-soft)] px-3 py-2.5 text-[15px] text-[var(--n-heading)] placeholder:text-[var(--n-body-subtle)] font-[family-name:var(--n-font-sans)] transition-shadow duration-100 ease-linear focus:outline focus:outline-[3px] focus:outline-offset-[3px] focus:outline-[var(--n-brand)] focus:shadow-[var(--n-shadow-sm)]";

/**
 * A neobrutalist form field label -- bold, uppercase, high-contrast.
 *
 * @param {LabelHTMLAttributes<HTMLLabelElement>} props - Standard label props.
 * @returns {JSX.Element} The label.
 */
export function NeoLabel({ className = "", ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`block text-xs font-bold uppercase tracking-wide text-[var(--n-heading)] font-[family-name:var(--n-font-sans)] mb-2 ${className}`}
      {...rest}
    />
  );
}

/**
 * A neobrutalist text input: thick border, flat fill, no radius. Focus adds
 * a hard offset shadow instead of a soft glow.
 *
 * @param {InputHTMLAttributes<HTMLInputElement>} props - Standard input props.
 * @returns {JSX.Element} The input.
 */
export function NeoInput({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD_CLASSES} ${className}`} {...rest} />;
}

/**
 * A neobrutalist textarea, matching NeoInput's styling.
 *
 * @param {TextareaHTMLAttributes<HTMLTextAreaElement>} props - Standard textarea props.
 * @returns {JSX.Element} The textarea.
 */
export function NeoTextarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD_CLASSES} resize-y ${className}`} {...rest} />;
}
