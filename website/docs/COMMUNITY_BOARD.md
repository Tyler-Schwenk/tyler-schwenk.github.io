# Community Board

## Overview
`/community-board` is a wood-framed cork board with links to friends' sites, local orgs, and other favorites. Each link is a piece of paper pinned or taped to the board. It's a static server component — no client JS, no pan/zoom.

## Files
- `app/community-board/page.tsx` — page + metadata. Lays out sections from the data file.
- `data/communityBoardLinks.ts` — `COMMUNITY_BOARD_SECTIONS`, the only place links live.
- `components/community-board/BoardNote.tsx` — one linked note (paper, fastener, tilt).
- `components/community-board/BoardLabel.tsx` — masking-tape heading, used for the board title (`h1`) and section titles (`h2`).
- `components/community-board/boardJitter.ts` — seeded hash helpers (`seededUnit`, `seededRange`, `seededPick`).
- `components/community-board/communityBoard.module.css` — all board styling.

## Data Format
```ts
type CommunityBoardSection = { id: string; title: string; links: CommunityBoardLink[] };
type CommunityBoardLink = { id: string; name: string; href: string; description: string };
```
Sections render in array order, links in array order within each section. To add a link, add one entry to the right section — there are no positions to maintain.

## Note Appearance
Everything about a note's look is derived from its `id` via `boardJitter.ts`, so it's stable across builds but varies note to note:
- **Paper**: sticky note (yellow, pink, green, blue, orange), lined index card, or torn notebook scrap.
- **Fastener**: pushpin (red, blue, green, yellow, white, with a small horizontal offset) or a strip of tape (~30% of notes).
- **Ink**: black felt-tip, blue ballpoint, or pencil. Text uses `mix-blend-mode: multiply` with a slight blur so it reads as ink in the paper.
- **Wear**: every paper (and the tape) gets a shared fractal-noise grain (`--paper-grain`, an inline SVG defined on `.wall`), darkened edges, and a faint stain at a seeded position/strength. Paper colors are deliberately faded rather than bright.
- **Tilt / nudge**: up to +/-4deg rotation, small x/y offset.

Changing a link's `id` reshuffles its look. Section labels are tilted the same way from the section `id`.

Each note's paper reserves a fixed top padding strip for the fastener, so text can never run under a pin or tape. Notes show name, description, and the link's host (without `www.`). Hovering or focusing a note straightens it and lifts it. Motion is disabled under `prefers-reduced-motion`. All links open in a new tab.

## Layout
- **Phones (< 640px)**: sections stack full width, notes two across (one note centers).
- **640px and up**: notes are a fixed width and each section is exactly as wide as `min(link count, 3)` note columns. Sections flow side by side and wrap, centered. At typical desktop widths Friends and Local Orgs share the first row.
- The board is capped at `80rem` wide and the page scrolls vertically. Top padding leaves room for the fixed frog nav icon.

## Assets
- Cork texture: `/images/cork bg 2.avif`, tiled at 420px.
- Notes, pins, tape, and the wood frame are pure CSS — no images.
- Fonts: Caveat (`--font-caveat`, loaded in `app/layout.tsx`) for all handwriting.
