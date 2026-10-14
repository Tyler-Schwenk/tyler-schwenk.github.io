# Library

## Overview

`/library` has two sections:

- **On the Shelf** -- the books I own right now, drawn as cloth spines standing on a
  wooden bookshelf, with a note that they're up for borrowing or trading. While the
  owned list is empty it shows an empty shelf with "Still shelving".
- **Reading Log** -- every book I've read, grouped by the year I finished it (newest year
  and newest book first). Each entry has the cover, title, subtitle, author, my star
  rating, the day I finished it, and my review if there is one.

It's built entirely from `data/library.json` at build time -- no backend. The page is a
server component; the only client JS is the shelf (`Bookshelf.tsx`), for picking a book.
Changing a book means editing the json and pushing.

Linked from the home menu ("THE LIBRARY", icon `public/images/8bit/library.png`), in
the "I'm feeling lucky" routes, and in the sitemap.

## Files

| File | Purpose |
|------|---------|
| `data/library.json` | All the books: `owned` and `read` lists |
| `app/library/page.tsx` | Page + metadata. Masthead, shelf, reading log |
| `app/library/libraryData.ts` | Types, the typed `OWNED_BOOKS` / `READ_BOOKS`, `getCoverSrc` (build-time cover lookup), `groupByYearRead` |
| `components/library/Bookshelf.tsx` | Client component: the shelf of spines plus the caption bar for the picked book |
| `components/library/BookSpine.tsx` | One owned book as a spine on the shelf (a button) |
| `components/library/BookCover.tsx` | Cover image, or a plain cloth binding with the title when there's no cover |
| `components/library/bookCloth.ts` | Picks a book's cloth color from its id |
| `components/library/ReadingEntry.tsx` | One book in the reading log |
| `components/library/StarRating.tsx` | Rating out of 5 as stars, or "unrated" |
| `components/library/library.module.css` | All library styling |
| `lib/seededRandom.ts` | Seeded hash helpers, shared with the community board |
| `scripts/fetch_book_covers.py` | Downloads missing covers from Open Library |
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
  spine's color and size, so changing it means renaming the cover too. A book that's in
  both lists should use the same id in each so it shares one cover and color.
- `subtitle`, `review` -- optional. Reviews keep their line breaks (blank line = new
  paragraph).
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

## Look

Old reading room: cream paper background, Libre Caslon Display headings
(`--font-garden-display`), Newsreader body text (`--font-kitchen-serif`), IBM Plex Mono for
catalog-style labels (`--font-garden-mono`).

**Shelf** -- spines wrap into rows. Every spine sits in a slot exactly `--shelf-row-height`
tall with the plank height reserved at its bottom, and the shelf background repeats one
plank tile at that same interval. That keeps a plank under every row however many rows
there are. Spine width, height, and cloth color come from the book id via
`lib/seededRandom.ts`, so they're stable across builds (38-54px wide). Long titles cut
off with an ellipsis.

Since cut-off titles can't be read on a phone (no hover), every spine is a button: tapping
or clicking one (or Enter/Space) pulls it partway off the shelf and shows its full title
and author in the caption bar under the shelf. Tapping it again or the close button puts
it back. If the book is also in the reading log, the caption links to its entry
(`#read-<id>`; entries have `scroll-margin-top` so they land below the fixed nav icon).
With nothing picked the bar just shows a hint and sits under the shelf; while a book is
picked it's `position: sticky` at the bottom of the screen, so it stays visible on a
shelf taller than the phone without covering the bottom row the rest of the time.

On devices with a real pointer, hovering a spine lifts it a little and shows a native
tooltip. The hover lift is behind `@media (hover: hover)` because touch browsers leave
`:hover` stuck on the last tapped element. Spine motion is off under
`prefers-reduced-motion`. Tap targets (close button, reading log link) are 44px.

**Reading log** -- each entry is a two-column grid (cover, details); the cover column
narrows under 480px. Dates are formatted in UTC since they're plain calendar days.

Tested in Chromium, WebKit (Safari's engine) and Firefox, at 320px, iPhone SE/13, Pixel 7,
iPad, and 1280-1920px desktop: no horizontal scroll at any width.
