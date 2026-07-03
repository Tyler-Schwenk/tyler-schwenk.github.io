"use client";

import { useState } from "react";
import TagChip from "./TagChip";
import { KitchenInput, KitchenLabel } from "./KitchenFormControls";
import { TagWithCount } from "./types";

const MAX_TAG_NAME_LENGTH = 50;

interface TagPickerProps {
  availableTags: TagWithCount[];
  selected: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Freeform + pick-from-existing tag editor.
 *
 * Type a name and press Enter/comma to add it (creating a new tag if it
 * doesn't already exist), or click one of the existing tags to add it.
 * Selected tags show as removable chips above the input.
 *
 * @param {TagPickerProps} props - Component props.
 * @param {TagWithCount[]} props.availableTags - Tags already in use elsewhere, for the suggestion list.
 * @param {string[]} props.selected - Currently selected tag names.
 * @param {(tags: string[]) => void} props.onChange - Called with the updated selection.
 * @returns {JSX.Element} The tag picker.
 */
export default function TagPicker({ availableTags, selected, onChange }: TagPickerProps) {
  const [draft, setDraft] = useState("");

  const selectedLower = selected.map((t) => t.toLowerCase());
  const suggestions = availableTags.filter((t) => !selectedLower.includes(t.name.toLowerCase()));

  /**
   * Adds a trimmed, non-empty tag name to the selection if it's not already there.
   *
   * @param {string} raw - The raw tag name to add.
   */
  function addTag(raw: string) {
    const name = raw.trim().slice(0, MAX_TAG_NAME_LENGTH);
    if (!name || selectedLower.includes(name.toLowerCase())) return;
    onChange([...selected, name]);
    setDraft("");
  }

  return (
    <div>
      <KitchenLabel htmlFor="tag-picker-input">Tags</KitchenLabel>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((name) => (
            <TagChip key={name} label={name} active onRemove={() => onChange(selected.filter((t) => t !== name))} />
          ))}
        </div>
      )}

      <KitchenInput
        id="tag-picker-input"
        type="text"
        value={draft}
        onChange={(e) => {
          const value = e.target.value;
          if (value.endsWith(",")) {
            addTag(value.slice(0, -1));
          } else {
            setDraft(value);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag(draft);
          }
        }}
        placeholder="type a tag and press enter"
      />

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {suggestions.slice(0, 20).map((tag) => (
            <TagChip key={tag.id} label={tag.name} count={tag.recipe_count} onClick={() => addTag(tag.name)} />
          ))}
        </div>
      )}
    </div>
  );
}
