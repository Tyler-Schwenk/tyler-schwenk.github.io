# Opium Den

## Overview

`/opium-den` is the music page: what the project is, the DJ booth (the live stream and
past sets), and a list of outside radio and sets worth listening to. The page itself is a
server component; the booth is the only client part.

## DJ Booth

When Tyler's practicing on the decks, whatever's playing streams to the booth live. Every
session is recorded and shows up underneath as a past set once it ends. The whole pipeline
(rekordbox, butt, icecast, recording) is in `pi/docs/services/dj-stream.md`.

- **Live panel**: "live now" with a pulsing dot (it holds still under `prefers-reduced-motion`),
  how long it's been on and how many are listening, and an `<audio>` player on
  `/dj/live` (`preload="none"`, so nothing downloads until play is pressed). Off air, it's
  a short note to check back.
- **Past sets**: newest first, the title (or the date when untitled) and length. Tapping a
  set opens a player for it and closes any other, so only one set loads at a time.
- Status and sets are polled every 15 s while the tab is visible (`useDjStream`), so the
  page flips to live on its own and a finished set appears shortly after it ends.
- If the backend can't be reached, the panel stays on off air with the error underneath,
  and the past sets don't show.

Sets are named and deleted from the admin page's DJ tab (`website/docs/ADMIN.md`).

On the home page, the opium den is the DJ board (`/images/8bit/dj_board.png`) sitting in the
cave. While the stream's live it gets music notes and a LIVE! tag (the `djLive` object field,
`website/docs/HOME.md`).

## Files

| File | Purpose |
|------|---------|
| `website/app/opium-den/page.tsx` | The page and its metadata |
| `website/components/opium-den/DjBooth.tsx` | The booth: live panel and past sets |
| `website/lib/useDjStream.ts` | Polls `/dj/status` and `/dj/sets` |
| `website/app/opium-den/djApi.ts` | Types, fetchers and urls for the `/dj` endpoints, shared with the admin tab |

Times and lengths are formatted with `parseBackendTime`, `formatDate`, `formatDuration`
and `formatElapsed` from `website/app/admin/format.ts`.
