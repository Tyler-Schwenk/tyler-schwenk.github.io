"use client";

import Image from "next/image";
import { Recipe, recipePhotoUrl } from "./types";
import TagChip from "./TagChip";

/**
 * A clickable recipe grid tile: cover photo (or placeholder), name, and up
 * to a few tags. Opens the recipe detail modal when clicked.
 *
 * @param {object} props - Component props.
 * @param {Recipe} props.recipe - The recipe to summarize.
 * @param {() => void} props.onClick - Called when the card is activated.
 * @returns {JSX.Element} The recipe card.
 */
export default function RecipeCard({ recipe, onClick }: { recipe: Recipe; onClick: () => void }) {
  const cover = recipe.photos[0];
  const visibleTags = recipe.tags.slice(0, 3);

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-[3px] border border-[var(--k-border-default)] bg-[var(--k-neutral-primary-soft)] overflow-hidden hover:border-[var(--k-border-default-strong)] hover:bg-[var(--k-neutral-secondary-medium)] active:shadow-[inset_0_2px_4px_var(--k-inset-press)] transition-colors duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--k-border-brand)]"
    >
      <div className="aspect-square bg-[var(--k-neutral-secondary-soft)] relative">
        {cover ? (
          <Image
            src={recipePhotoUrl(cover.id, true)}
            alt={recipe.name ?? "recipe photo"}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--k-body-subtle)] text-3xl font-[family-name:var(--k-font-serif)]">
            ?
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-[15px] font-medium text-[var(--k-heading)] font-[family-name:var(--k-font-serif)] truncate">
          {recipe.name || "Untitled recipe"}
        </h3>
        {visibleTags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {visibleTags.map((tag) => (
              <TagChip key={tag.id} label={tag.name} />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
