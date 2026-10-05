"use client";

import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type DragEvent, type ReactNode } from "react";

/**
 * The admin page's building blocks: buttons, form fields, cards, messages,
 * a file drop zone. Sized for thumbs first (44px touch targets, 16px inputs so
 * iOS doesn't zoom in on focus), and they just get roomier on a laptop.
 */

// how long a success/error message stays up
const FLASH_DURATION_MS = 4_000;

type ButtonVariant = "primary" | "ghost" | "danger" | "quiet";
type ButtonSize = "md" | "sm";

const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-orange-500 text-white hover:bg-orange-400",
  ghost: "bg-slate-800 text-slate-100 hover:bg-slate-700",
  danger: "bg-red-950 text-red-300 hover:bg-red-900",
  quiet: "bg-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-100",
};

const BUTTON_SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "min-h-11 px-4 text-sm",
  sm: "min-h-9 px-3 text-xs",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * A button. Defaults to type="button" so it never submits a form by accident.
 * @param props.variant - Look: primary (orange), ghost (default), danger, quiet.
 * @param props.size - md (44px tall) or sm.
 */
export function Button({ variant = "ghost", size = "md", className = "", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 ${BUTTON_VARIANT_CLASSES[variant]} ${BUTTON_SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  );
}

/** Classes for text inputs, textareas and selects. */
export const INPUT_CLASS =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none";

/**
 * A labelled form field.
 * @param props.label - Field name.
 * @param props.htmlFor - Id of the input it labels.
 * @param props.children - The input.
 */
export function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * A raised panel.
 * @param props.children - Contents.
 * @param props.className - Extra classes (padding is up to the caller).
 */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-800 bg-slate-900 ${className}`}>{children}</div>;
}

/**
 * A row above a list: what's in it on the left, actions on the right.
 * @param props.summary - Like "12 galleries".
 * @param props.children - Action buttons.
 */
export function Toolbar({ summary, children }: { summary: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <span className="text-sm text-slate-400">{summary}</span>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

/**
 * Grey placeholder text for loading and empty states.
 * @param props.children - The text.
 */
export function Muted({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-500">{children}</p>;
}

/**
 * A small pill label.
 * @param props.tone - green (good), grey (neutral) or orange (attention).
 * @param props.children - The text.
 */
export function Badge({ tone, children }: { tone: "green" | "grey" | "orange"; children: ReactNode }) {
  const tones = {
    green: "bg-green-950 text-green-300",
    grey: "bg-slate-800 text-slate-300",
    orange: "bg-orange-950 text-orange-300",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** A message shown for a few seconds after an action. */
export type Flash = { kind: "success" | "error"; text: string } | null;

/**
 * A success/error message that clears itself after FLASH_DURATION_MS.
 * @returns The current message and a function to show a new one.
 */
export function useFlash(): [Flash, (kind: "success" | "error", text: string) => void] {
  const [flash, setFlash] = useState<Flash>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  const show = useCallback((kind: "success" | "error", text: string) => {
    clearTimeout(timer.current ?? undefined);
    setFlash({ kind, text });
    timer.current = setTimeout(() => setFlash(null), FLASH_DURATION_MS);
  }, []);

  return [flash, show];
}

/**
 * Shows a Flash, if there is one.
 * @param props.flash - From useFlash.
 */
export function FlashMessage({ flash }: { flash: Flash }) {
  if (!flash) return null;
  const tone = flash.kind === "success" ? "bg-green-950 text-green-300" : "bg-red-950 text-red-300";
  return (
    <div role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${tone}`}>
      {flash.text}
    </div>
  );
}

/**
 * A thin progress bar.
 * @param props.fraction - How far along, 0 to 1.
 */
export function ProgressBar({ fraction }: { fraction: number }) {
  return (
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
      <div className="h-full bg-orange-500 transition-[width]" style={{ width: `${Math.round(fraction * 100)}%` }} />
    </div>
  );
}

/**
 * Two or three mutually exclusive choices as one segmented control.
 * @param props.options - Values and their labels.
 * @param props.value - The chosen value.
 * @param props.onChange - Called with the new value.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`min-h-10 rounded-md text-sm font-semibold transition ${
            option.value === value ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Tap to pick files, or drop them on it from a laptop.
 * @param props.label - Main text.
 * @param props.hint - Smaller text under it.
 * @param props.accept - File input accept string.
 * @param props.multiple - Allow several files.
 * @param props.onFiles - Called with the picked/dropped files (dropped ones filtered by `accept`'s type prefix).
 * @param props.disabled - Ignore taps and drops (while uploading).
 */
export function DropZone({
  label,
  hint,
  accept,
  multiple = false,
  onFiles,
  disabled = false,
}: {
  label: string;
  hint?: string;
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  // "image/*" -> "image/", so drops of other kinds are ignored like the picker would
  const typePrefix = accept.replace("*", "");

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith(typePrefix));
    onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${
        dragging ? "border-orange-500 bg-orange-500/10 text-slate-100" : "border-slate-700 text-slate-400 hover:border-slate-500"
      } ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="mt-1 text-xs text-slate-500">{hint}</span>}
      <input
        type="file"
        className="sr-only"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          onFiles([...(event.target.files ?? [])]);
          // cleared so picking the same file again still fires a change
          event.target.value = "";
        }}
      />
    </label>
  );
}
