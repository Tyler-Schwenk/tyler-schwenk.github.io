"use client";

import { ReactNode } from "react";

interface KitchenModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * A floating window-style modal dialog: dimmed backdrop, title bar with a
 * close control, scrollable body, optional footer.
 *
 * @param {KitchenModalProps} props - Component props.
 * @param {string} props.title - Title-bar label.
 * @param {() => void} props.onClose - Called when the backdrop or close control is activated.
 * @param {ReactNode} props.children - Body content.
 * @param {ReactNode} [props.footer] - Optional footer content (e.g. action buttons).
 * @returns {JSX.Element} The modal, including its backdrop.
 */
export default function KitchenModal({ title, onClose, children, footer }: KitchenModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(63,20,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-[3px] border border-[var(--k-border-default-strong)] bg-[var(--k-neutral-primary-soft)] overflow-hidden"
        style={{ boxShadow: "var(--k-shadow-window)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-8 flex items-center justify-between gap-2 px-3 border-b border-[var(--k-border-default)] bg-[var(--k-menu-bar)] shrink-0">
          <span className="text-[13px] font-semibold text-[var(--k-heading)] font-[family-name:var(--k-font-sans)] truncate">
            {title}
          </span>
          <button
            type="button"
            aria-label="close"
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center rounded-[2px] text-[var(--k-heading)] hover:bg-[var(--k-neutral-secondary-medium)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--k-border-brand)]"
          >
            &times;
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-[var(--k-border-default)] flex justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
