"use client";

export type SortOption = "top" | "new";

const OPTIONS: { key: SortOption; label: string }[] = [
  { key: "top", label: "Top" },
  { key: "new", label: "New" },
];

/**
 * Segmented "Top" / "New" sort toggle, styled as two squared block-tabs
 * (see website/docs/themes/neobrutalism.md -> tabs.md, Blocks variant). The
 * active tab reads as pressed in (no shadow); the inactive tab still has
 * its offset shadow, signaling it's clickable.
 *
 * @param {object} props - Component props.
 * @param {SortOption} props.value - Currently selected sort.
 * @param {(s: SortOption) => void} props.onChange - Selection handler.
 * @returns {JSX.Element} The toggle control.
 */
export default function NeoSortToggle({ value, onChange }: { value: SortOption; onChange: (s: SortOption) => void }) {
  return (
    <div className="inline-flex">
      {OPTIONS.map((opt, i) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={`border-[3px] border-[var(--n-border-default)] px-4 py-[9px] text-sm font-bold uppercase tracking-wide font-[family-name:var(--n-font-sans)] transition-shadow duration-100 ease-linear ${
            i > 0 ? "-ml-[3px]" : ""
          } ${
            value === opt.key
              ? "bg-[var(--n-brand)] text-black shadow-none"
              : "bg-[var(--n-neutral-primary-soft)] text-[var(--n-heading)] shadow-[var(--n-shadow-sm)] hover:bg-[var(--n-brand-softer)]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
