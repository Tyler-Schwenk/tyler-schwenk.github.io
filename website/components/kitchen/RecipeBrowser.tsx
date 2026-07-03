"use client";

import { useCallback, useEffect, useState } from "react";
import KitchenWindow from "./KitchenWindow";
import KitchenButton from "./KitchenButton";
import { KitchenInput } from "./KitchenFormControls";
import TagChip from "./TagChip";
import RecipeCard from "./RecipeCard";
import AddRecipeModal from "./AddRecipeModal";
import RecipeDetailModal from "./RecipeDetailModal";
import AdminLoginModal from "./AdminLoginModal";
import { useAdminAuth } from "./useAdminAuth";
import { API_BASE, Recipe, TagWithCount } from "./types";

// wait this long after the last keystroke before re-querying the backend
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Fetches recipes from the backend, applying the current search text and
 * selected tag filters.
 *
 * @param {string} search - Free-text search query.
 * @param {string[]} selectedTags - Tag names the recipe must all have.
 * @returns {Promise<Recipe[]>} Matching recipes.
 */
async function fetchRecipes(search: string, selectedTags: string[]): Promise<Recipe[]> {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));
  const res = await fetch(`${API_BASE}/recipes?${params.toString()}`);
  if (!res.ok) throw new Error("failed to load recipes");
  return res.json();
}

/**
 * The Kitchen's recipe box: search, tag filters, a random-pick button, a
 * grid of recipes, and the entry points for adding a recipe or logging in
 * as admin to edit/delete. Owns all recipe/tag data fetching.
 *
 * @returns {JSX.Element} The recipe browser section.
 */
export default function RecipeBrowser() {
  const { token, isAdmin, login, logout } = useAdminAuth();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [allTags, setAllTags] = useState<TagWithCount[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [randomizing, setRandomizing] = useState(false);

  /** Reloads the tag list (with fresh recipe counts) from the backend. */
  const refreshTags = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/recipes/tags`);
      if (res.ok) setAllTags(await res.json());
    } catch {
      // non-critical -- the tag picker just won't show suggestions
    }
  }, []);

  useEffect(() => {
    refreshTags();
  }, [refreshTags]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      fetchRecipes(search, selectedTags)
        .then((data) => {
          if (!cancelled) setErrorMsg(null);
          if (!cancelled) setRecipes(data);
        })
        .catch(() => {
          if (!cancelled) setErrorMsg("couldn't load recipes - check your connection and try again");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, selectedTags]);

  /** Toggles a tag filter chip on/off. */
  function toggleTag(name: string) {
    setSelectedTags((prev) => (prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]));
  }

  /** Picks a random recipe (within the current filters) and opens its detail view. */
  async function handleRandom() {
    setRandomizing(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));
      const res = await fetch(`${API_BASE}/recipes/random?${params.toString()}`);
      if (res.status === 404) {
        setErrorMsg("no recipes match those filters yet");
        return;
      }
      if (!res.ok) throw new Error("random pick failed");
      setSelectedRecipe(await res.json());
    } catch {
      setErrorMsg("couldn't reach the server - check your connection and try again");
    } finally {
      setRandomizing(false);
    }
  }

  return (
    <>
      <KitchenWindow
        title="Recipe Box"
        actions={
          isAdmin ? (
            <KitchenButton size="sm" variant="ghost" onClick={logout}>
              Log Out
            </KitchenButton>
          ) : (
            <KitchenButton size="sm" variant="ghost" onClick={() => setShowLoginModal(true)}>
              Admin
            </KitchenButton>
          )
        }
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex-1">
            <KitchenInput
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search recipes..."
              aria-label="search recipes"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <KitchenButton variant="tertiary" onClick={handleRandom} disabled={randomizing}>
              {randomizing ? "Picking..." : "Random Recipe"}
            </KitchenButton>
            <KitchenButton variant="primary" onClick={() => setShowAddModal(true)}>
              Add a Recipe
            </KitchenButton>
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {allTags.map((tag) => (
              <TagChip
                key={tag.id}
                label={tag.name}
                count={tag.recipe_count}
                active={selectedTags.includes(tag.name)}
                onClick={() => toggleTag(tag.name)}
              />
            ))}
          </div>
        )}

        {errorMsg && (
          <p className="text-[13px] text-[var(--k-fg-danger-strong)] bg-[var(--k-danger-soft)] border border-[var(--k-border-danger-subtle)] rounded-[3px] px-3 py-2 mb-4">
            {errorMsg}
          </p>
        )}

        {loading ? (
          <p className="text-[13px] text-[var(--k-body-subtle)] font-[family-name:var(--k-font-sans)]">Loading recipes...</p>
        ) : recipes.length === 0 ? (
          <p className="text-[13px] text-[var(--k-body-subtle)] font-[family-name:var(--k-font-sans)]">
            No recipes yet -- add the first one.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} onClick={() => setSelectedRecipe(recipe)} />
            ))}
          </div>
        )}
      </KitchenWindow>

      {showAddModal && (
        <AddRecipeModal
          availableTags={allTags}
          onClose={() => setShowAddModal(false)}
          onCreated={(recipe) => {
            setRecipes((prev) => [recipe, ...prev]);
            refreshTags();
            setShowAddModal(false);
          }}
        />
      )}

      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          isAdmin={isAdmin}
          token={token}
          availableTags={allTags}
          onClose={() => setSelectedRecipe(null)}
          onUpdated={(updated) => {
            setRecipes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setSelectedRecipe(updated);
            refreshTags();
          }}
          onDeleted={(recipeId) => {
            setRecipes((prev) => prev.filter((r) => r.id !== recipeId));
            setSelectedRecipe(null);
            refreshTags();
          }}
        />
      )}

      {showLoginModal && <AdminLoginModal onClose={() => setShowLoginModal(false)} onLogin={login} />}
    </>
  );
}
