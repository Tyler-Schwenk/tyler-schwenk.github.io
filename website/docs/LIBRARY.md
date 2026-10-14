# Library

## Overview

`/library` has two sections:

- **On the Shelf** -- the books I own right now, as a looping 3D cover carousel with a
  note that they're up for borrowing or trading. The middle book faces front with my
  rating and review under it; the rest angle away to each side. While the owned list is
  empty it shows "Still shelving" instead.
- **Reading Log** -- every book I've read, grouped by the year I finished it (newest year
  and newest book first). Each entry has the cover, title, subtitle, author, my star
  rating, the day I finished it, and my review if there is one.

It's built entirely from `data/library.json` at build time -- no backend. The page is a
server component; the only client JS is the carousel (`BookCarousel.tsx`), for flipping between
books.
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
| `components/library/BookCarousel.tsx` | Client component: the looping cover carousel plus the middle book's details |
| `components/library/BookModel.tsx` | A book as a 3D box: cover on the front, spine on the left, page edges on the right |
| `components/library/BookCover.tsx` | Cover image, or a plain cloth binding with the title when there's no cover |
| `components/library/bookCloth.ts` | Picks a book's cloth color from its id |
| `components/library/ReadingEntry.tsx` | One book in the reading log |
| `components/library/ReadingDetails.tsx` | Title, author, stars, date and review -- shared by the log and the carousel |
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
  book's thickness, so changing it means renaming the cover too. A book that's in
  both lists should use the same id in each so it shares one cover and color.
- `subtitle`, `review` -- optional. Reviews keep their line breaks (blank line = new
  paragraph).
- `owned` order is carousel order: the first book is in the middle when the page loads,
  and flipping right goes down the list (looping back to the top).
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

**Shelf carousel** -- a coverflow. Every owned book is a `BookModel` (a CSS 3D box:
cover on the front face, spine on the left face, page edges on the right) inside a
button. Each book gets two inline custom properties, `--distance` (steps from the middle)
and `--side` (-1 left, 0 middle, 1 right), and the CSS turns those into its transform:
pushed out sideways (`--first-gap` for the first step, `--rest-gap` after), pushed back
(`--depth-step`) and turned `--side-angle` toward the middle. So left books show their
spines and right books show their pages. Books fade toward the paper the further out they
are -- an overlay on each face, because opacity or filter on the box would flatten the
3D -- and the stage's edges fade out with a mask. All the sizes live on `.carousel` and
shrink under 480px.

It loops: a book's distance is measured whichever way round the list is shorter, so the
last book sits just left of the first. Books more than 3 steps out are hidden, which also
hides the one book that jumps from one end to the other on each flip.

Flipping: the arrow buttons (beside the books on desktop, beside the "3 / 18" count on
phones), the left/right arrow keys while focus is in the carousel, a swipe or mouse drag
of 40px+ (swipe left for the next book; vertical swipes still scroll the page), a
sideways trackpad scroll (one flip per 60px, at most one per 300ms so a flick doesn't
spin through everything), or clicking a side book to bring it to the middle. The stage
blocks the browser's native image drag, since that would cancel a mouse swipe.

Under the middle book: the count, then `ReadingDetails` (title, subtitle, author, stars,
date read, full review), fading in on each flip -- or "Haven't read it yet" for a book
that's not in the log. A visually hidden live region announces the new book on every
flip. The middle book is the only one in the tab order; the side books are reachable
with the arrows.

Spine color comes from `data/spineColors.json` (bookcloth when missing) and thickness
(16-30px) from the book id via `lib/seededRandom.ts`, so both are stable across builds.
Flip animation and the details fade are off under `prefers-reduced-motion`.

**Reading log** -- each entry is a two-column grid (cover, details); the cover column
narrows under 480px. Dates are formatted in UTC since they're plain calendar days.

Checked in Chromium at 320px and 390px (phone emulation) and 1200px: no horizontal
scroll; arrow buttons, arrow keys, mouse drag and clicking a side book all flip, and
flipping back from the first book wraps to the last.
