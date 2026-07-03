"use client";

interface TagChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  count?: number;
}

/**
 * A small bordered tag chip -- used as both a filter toggle (browse view)
 * and a selected/removable tag (add-recipe form), depending on which
 * handlers are passed.
 *
 * @param {TagChipProps} props - Component props.
 * @param {string} props.label - Tag name to display.
 * @param {boolean} [props.active=false] - Whether the chip is in its selected/brand state.
 * @param {() => void} [props.onClick] - Click handler; renders the chip as a toggle button when set.
 * @param {() => void} [props.onRemove] - Remove handler; shows a dismiss "x" when set.
 * @param {number} [props.count] - Optional recipe count shown after the label.
 * @returns {JSX.Element} The tag chip.
 */
export default function TagChip({ label, active = false, onClick, onRemove, count }: TagChipProps) {
  const base =
    "inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 text-xs font-medium font-[family-name:var(--k-font-sans)] transition-colors duration-[120ms]";
  const palette = active
    ? "bg-[var(--k-brand-softer)] border-[var(--k-border-brand-subtle)] text-[var(--k-fg-brand-strong)]"
    : "bg-[var(--k-neutral-primary-soft)] border-[var(--k-border-default)] text-[var(--k-heading)]";

  const content = (
    <>
      <span>{label}</span>
      {typeof count === "number" && <span className="text-[var(--k-body-subtle)]">({count})</span>}
      {onRemove && (
        <button
          type="button"
          aria-label={`remove tag ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 -mr-0.5 rounded-[2px] hover:bg-[var(--k-neutral-tertiary)] px-1"
        >
          x
        </button>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} ${palette} hover:bg-[var(--k-neutral-secondary-medium)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--k-border-brand)]`}
      >
        {content}
      </button>
    );
  }

  return <span className={`${base} ${palette}`}>{content}</span>;
}
