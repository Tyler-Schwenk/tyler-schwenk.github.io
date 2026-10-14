# Library

## Overview

`/library` has two sections:

- **On the Shelf** -- the books I own right now, lying flat in stacks on a wooden
  bookshelf with a plant, a hookah and a candle between them, and a note that they're up
  for borrowing or trading. Picking a book opens a drawer under the shelf with my review. While the
  owned list is empty it shows an empty shelf with "Still shelving".
- **Reading Log** -- every book I've read, grouped by the year I finished it (newest year
  and newest book first). Each entry has the cover, title, subtitle, author, my star
  rating, the day I finished it, and my review if there is one.

It's built entirely from `data/library.json` at build time -- no backend. The page is a
server component; the only client JS is the shelf (`Bookshelf.tsx`), for picking a book
and opening its drawer.
Changing a book means editing the json and pushing.

Linked from the home menu ("THE LIBRARY", icon `public/images/8bit/library.png`), in
the "I'm feeling lucky" routes, and in the sitemap.

## Files

| File | Purpose |
|------|---------|
| `data/library.json` | All the books: `owned` and `read` lists |
| `app/library/page.tsx` | Page + metadata. Masthead, shelf, reading log |
| `data/spineColors.json` | Generated: spine background + ink per book id, from its cover |
| `app/library/libraryData.ts` | Types, the typed `OWNED_BOOKS` / `READ_BOOKS`, `getCoverSrc` (build-time cover lookup), `getShelfBooks` (owned books joined with spine color, cover and log entry), `groupByYearRead` |
| `components/library/Bookshelf.tsx` | Client component: the shelf plus the drawer for the picked book |
| `components/library/shelfLayout.ts` | Splits the owned books into stacks and slots the decor between them |
| `components/library/BookSpine.tsx` | One owned book lying flat in a stack (a button) |
| `components/library/ShelfDecor.tsx` | SVG plant, hookah and candle |
| `components/library/BookCover.tsx` | Cover image, or a plain cloth binding with the title when there's no cover |
| `components/library/bookCloth.ts` | Picks a book's cloth color from its id |
| `components/library/ReadingEntry.tsx` | One book in the reading log |
| `components/library/ReadingDetails.tsx` | Title, author, stars, date and review -- shared by the log and the drawer |
| `components/library/StarRating.tsx` | Rating out of 5 as stars, or "unrated" |
| `components/library/library.module.css` | All library styling |
| `lib/seededRandom.ts` | Seeded hash helpers, shared with the community board |
| `scripts/fetch_book_covers.py` | Downloads missing covers from Open Library |
| `scripts/extract_spine_colors.py` | Regenerates `data/spineColors.json` from the covers |
| `public/images/library/covers/<id>.jpg` | Cover images, one per book id |

## Data Format

```json
{
  "owned": [
    { "id": "east-of-eden", "title": "East of Eden", "author": "John Steinbeck" }
  ],
  "read": [
    {
      "id": "the-motorcycle-diaries",
      "title": "The Motorcycle Diaries",
      "subtitle": "Notes on a Latin American Journey",
      "author": "Ernesto Che Guevara",
      "rating": 5,
      "dateRead": "2026-04-02",
      "review": "Such a banger..."
    }
  ]
}
```

- `id` -- kebab-case, unique within its list. It names the cover file and seeds the
  spine's size and offset, so changing it means renaming the cover too. A book that's in
  both lists should use the same id in each so it shares one cover and color.
- `subtitle`, `review` -- optional. Reviews keep their line breaks (blank line = new
  paragraph).
- `owned` order is shelf order: the first four books make the first stack, and so on.
- `rating` -- whole stars 1 to 5, or `null` for unrated.
- `dateRead` -- `YYYY-MM-DD`, the day I finished it. If Goodreads has no read date, use the
  date it was added. Order in the file doesn't matter; the page sorts by this.

Reviews are shown in full, so paste the complete text. The Goodreads "My Books" page cuts
long reviews off with "…" -- copy from the review's own page or the Goodreads export (CSV,
`My Review` column, `<br/>` = line break) instead.

## Covers

Covers are downloaded once and committed, not hotlinked. To fetch covers for new books:

```
python website/scripts/fetch_book_covers.py
```

It searches Open Library by title + author for every book in both lists and saves the
first result with a cover as `public/images/library/covers/<id>.jpg` (the "M" size, ~180px
wide). Books that already have a file are skipped, so it's safe to rerun. It exits 1 and
lists the ids it couldn't find a cover for.

The search sometimes picks the wrong edition (another language, a library copy with
stickers) or finds nothing. For those, find the right cover id on openlibrary.org and save
`https://covers.openlibrary.org/b/id/<cover id>-M.jpg` as the book's file by hand, or drop
in any jpg named after the id. Look over new covers before committing.

A book with no cover file gets a plain cloth cover with its title and author. The check
runs at build time (`getCoverSrc`), so a new cover shows up on the next build.

After adding or swapping covers, regenerate the spine colors:

```
python website/scripts/extract_spine_colors.py
```

It needs Pillow. For each cover it takes the dominant color (the biggest bucket after
cutting the cover down to 5 colors) as the spine background, and picks whichever of the
light/dark ink colors has more contrast on it. Output is sorted and only depends on the
cover files, so it's safe to rerun. Commit `data/spineColors.json` -- the build reads it
and doesn't need Pillow. A book missing from it gets a seeded bookcloth color instead.

## Look

Old reading room: cream paper background, Libre Caslon Display headings
(`--font-garden-display`), Newsreader body text (`--font-kitchen-serif`), IBM Plex Mono for
catalog-style labels (`--font-garden-mono`).

**Shelf** -- owned books lie flat in stacks, alternating 4 and 3 books, in the order of
the `owned` list. Within a stack the books are sorted by title + author length, shortest
on top, so it looks like a real pile. A decor piece (plant, then hookah, then candle) goes
after every other stack, starting after the first, until they run out. Decor is inline
SVG, hidden from screen readers; the candle flickers.

Stacks and decor wrap into rows. Each sits in a slot exactly `--shelf-row-height` tall
with the plank height reserved at its bottom, and the shelf background repeats one plank
tile at that same interval. That keeps a plank under every row however many rows there
are. A stack of four books, even with every title wrapped to two lines, fits in a row.

Each spine reads left to right: title, then author. They share a line when there's room
and wrap when there isn't (narrow phones), so nothing gets cut off. Spine color comes from
`data/spineColors.json`; padding (so width and thickness) and a small left/right offset
come from the book id via `lib/seededRandom.ts`, so they're stable across builds.

Every spine is a button: tapping or clicking one (or Enter/Space) slides it partway out
of its stack and opens the drawer under the shelf -- the cover plus `ReadingDetails`
(title, author, stars, date read, full review), or "Haven't read it yet" for a book
that's not in the log. The drawer clips open downward and scrolls into view, which
matters on a phone where the shelf is several screens tall. Tapping the book again or the
close button puts it back. With nothing picked the drawer is a thin bar with a hint.

On devices with a real pointer, hovering a spine slides it out a little. That's behind
`@media (hover: hover)` because touch browsers leave `:hover` stuck on the last tapped
element. Spine motion, the drawer animation and the candle flicker are off under
`prefers-reduced-motion`. The close button is a 44px tap target.

**Reading log** -- each entry is a two-column grid (cover, details); the cover column
narrows under 480px. Dates are formatted in UTC since they're plain calendar days.

Checked in Chromium at 390px (phone emulation) and 1200px: no horizontal scroll, and the
drawer opens and scrolls into view.
