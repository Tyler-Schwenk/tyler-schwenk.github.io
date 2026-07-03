# The Kitchen Documentation

## Overview

`/kitchen` is a recipe box: a public, phone-friendly form for adding recipes (name, description, tags, photos — all optional), plus a browse view with search, tag filtering, and a "random recipe" picker. It also keeps the original friends-and-family cookbook PDF as a separate section.

All recipe data and photos are served from the Pi backend at `https://api.tyler-schwenk.com`. Unlike the gallery (which fetches at build time), the recipe browser fetches client-side at runtime, so new recipes show up immediately without a frontend redeploy.

Anyone can submit a recipe (rate-limited per IP, no login). Editing or deleting a recipe requires logging in as admin via the "Admin" link in the Recipe Box title bar — same JWT account used by the gallery admin panel (`public/admin/index.html`).

---

## Design System

The Kitchen is the first section to use the retro desktop-OS theme documented in [docs/themes/cookbook.md](themes/cookbook.md) — toasted-cream surfaces, espresso ink, glowing orange accent, sharp 3px corners, bordered "window" chrome. It's scoped to the page via a `.kitchen-theme` wrapper class so it doesn't affect the rest of the site (which uses its own retro-8-bit look).

- **Tokens**: CSS custom properties defined in [app/globals.css](../app/globals.css) under `.kitchen-theme` (light) and `.kitchen-theme` inside `@media (prefers-color-scheme: dark)` (dark). Named `--k-*` to avoid clashing with other tokens.
- **Fonts**: Newsreader (serif, headings), DM Sans (sans, body/UI), Geist Mono (mono, not currently used on this page but registered for future use) — loaded via `next/font/google` in [app/layout.tsx](../app/layout.tsx) as `--font-kitchen-serif` / `--font-kitchen-sans` / `--font-kitchen-mono`.
- **Components**: [components/kitchen/](../components/kitchen/) — `KitchenWindow` (title-bar + body chrome), `KitchenButton`, `KitchenFormControls` (input/textarea/label), `TagChip`, `KitchenModal`. Any future work in this section should reuse these instead of inlining new styles.

To extend the theme to a new page, wrap it in a `.kitchen-theme` div and use the same components/tokens — see [app/kitchen/page.tsx](../app/kitchen/page.tsx) for the pattern.

---

## Architecture

### Data Flow

```
RecipeBrowser (client component)
  ├── GET /recipes?search=&tags=     → filtered recipe list (debounced 300ms after typing)
  ├── GET /recipes/tags              → all tags + counts, for filter chips and the tag picker
  ├── GET /recipes/random?search=&tags= → random pick within current filters
  ├── POST /recipes                  → create (multipart, public, rate-limited)
  ├── PATCH /recipes/{id}            → edit (admin only)
  ├── DELETE /recipes/{id}           → delete (admin only)
  └── POST /auth/login               → admin login, JWT stored in localStorage
```

### Routes

- `/kitchen` — the only route ([app/kitchen/page.tsx](../app/kitchen/page.tsx)). Recipe detail and the add-recipe form are modals, not separate pages.

---

## Components ([components/kitchen/](../components/kitchen/))

| File | Purpose |
|---|---|
| `types.ts` | `Recipe`/`Tag`/`RecipePhoto` types, `API_BASE`, `recipePhotoUrl()` |
| `useAdminAuth.ts` | Reads/writes the admin JWT in localStorage (`kitchen-admin-token`); exposes `isAdmin`, `login`, `logout` |
| `KitchenWindow.tsx` | Title-bar + body window chrome, the default content container |
| `KitchenButton.tsx` | Button variants (primary/secondary/tertiary/ghost/danger) |
| `KitchenFormControls.tsx` | `KitchenInput`, `KitchenTextarea`, `KitchenLabel` |
| `TagChip.tsx` | Tag pill — toggleable filter, removable selection, or static display, depending on props |
| `TagPicker.tsx` | Freeform + pick-from-existing tag editor (type + Enter to add, or click a suggestion) |
| `KitchenModal.tsx` | Floating modal dialog (backdrop + title bar + body + optional footer) |
| `RecipeCard.tsx` | Grid tile — cover photo, name, up to 3 tags |
| `RecipeBrowser.tsx` | Owns all data fetching; renders search/filter/random/add controls and the grid |
| `RecipeDetailModal.tsx` | Full recipe view; admin sees Edit/Delete, edit mode reuses `TagPicker` |
| `AddRecipeModal.tsx` | The public add-recipe form; submits multipart `FormData` |
| `AdminLoginModal.tsx` | Email/password form calling `POST /auth/login` |

---

## Tags

Freeform: typing a tag name that doesn't exist yet creates it on submit (server-side, case-insensitive matching so "Breakfast" and "breakfast" reuse one tag). Tags are never deleted, even once no recipe references them (e.g. after editing a recipe to remove its last use of a tag, or deleting that recipe) — `GET /recipes/tags` returns every tag ever created, including ones with `recipe_count: 0`. There's no "manage tags" UI to prune these; they're harmless clutter at worst.

Tag filtering in the browse view is **AND**-based: selecting multiple tag chips shows only recipes that have all of them.

---

## Media URLs

| Content | URL |
|---|---|
| Recipe photo (full res) | `https://api.tyler-schwenk.com/recipes/photos/{id}/file` |
| Recipe photo (thumbnail) | `https://api.tyler-schwenk.com/recipes/photos/{id}/file?thumbnail=true` |

Photos are decoded/normalized/thumbnailed the same way gallery photos are (see [app/image_utils.py](../../pi/services/website-backend/app/image_utils.py) on the backend) — HEIC from iPhones gets converted to JPEG, EXIF rotation gets baked into the pixels.

---

## Admin Login

Click "Admin" in the Recipe Box title bar, log in with the same email/password as the gallery admin panel. The JWT is stored in localStorage under `kitchen-admin-token` (separate key from the gallery admin panel's `adminToken` — logging into one doesn't log you into the other). Once logged in, recipe detail modals show Edit/Delete buttons; "Admin" changes to "Log Out".

## See Also

- [pi/docs/api/website-backend-api.md](../../pi/docs/api/website-backend-api.md) — full Recipes API reference
- [docs/themes/cookbook.md](themes/cookbook.md) — design system spec
