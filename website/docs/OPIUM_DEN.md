# Opium Den

## Overview

`/opium-den` is the music page: what the project is, the DJ booth (the live stream and
past sets), and a list of outside radio and sets worth listening to. The page itself is a
server component; the booth is the only client part.

## Look

Quiet and flat on purpose: one warm near-black background, Inter throughout, hairline
dividers instead of cards, no gradients or glows. Red is kept for what's live or
playing (the live dot, the playing set's title, the bouncing bars, the seek bar on
hover), so it means something when it shows up.

- Colours are Tailwind theme tokens in `globals.css` (`@theme`): `den-bg`, `den-raised`,
  `den-ink` (text), `den-muted`, `den-faint`, `den-line` (hairlines), `den-accent` (red).
  Use them as `bg-den-bg`, `text-den-muted`, `border-den-line`, etc.
- The page's `<main>` carries `.den-page`, which sets the font and paints `html`/`body`
  the same colour, so the space the player bar pads onto the body and iOS overscroll
  don't flash white.
- The intro's "what is this" is a `<details>` disclosure styled as a text link.
- **Listen**: outside links come from `LISTEN_LINKS` in `page.tsx` (name, source, url),
  shown as rows with an arrow. Stacked name over source on phones, side by side from
  `sm` up. Only `http` urls open in a new tab, so a `#` placeholder stays put.

## DJ Booth

Laid out like a streaming app. When Tyler's practicing on the decks, whatever's playing
streams to the booth live, and every session is recorded and shows up underneath as a
past set once it ends. The pipeline (rekordbox, butt, icecast, recording) is in
`pi/docs/services/dj-stream.md`.

- **Live row** (`LiveHero`): one row between hairlines. The DJ board art, "Live from the
  den", and a status line: a pulsing red dot with "Live now", how long it's been on and
  how many are listening, plus a round play button. Off air, the art is greyed out and
  the line says it streams here when Tyler's on the decks.
- **Past sets**: a numbered track list, newest first. Each row shows the title (or the
  date when untitled), the date, the start of the description, and the length. Tapping a
  row plays or pauses it (the number turns into play/pause on hover); the playing row's
  title goes red with bouncing bars. Sets with a description get an "about this set"
  toggle that shows it in full (line breaks kept).
- **Player bar**: pinned to the bottom once anything plays. Art, title, play/pause, back
  15 s / forward 30 s, a seek bar with elapsed and total time, and volume. For the live
  stream the seek bar is a LIVE pill. On phones it folds down to a mini player (title,
  play/pause, a thin progress line). While it's up it pads the page's bottom so nothing
  hides under it. Dragging a seek bar only seeks when you let go (`useScrub`), so a drag
  is one range request to the Pi instead of dozens.
- **Now playing sheet** (phones only): tapping the mini player anywhere but play/pause
  slides up a full-screen view, like Spotify or Apple Music: big art, title, a full-width
  seek bar with elapsed and total time, and back 15 s / play / forward 30 s (just play for
  the live stream). It closes with the chevron, Escape, or a swipe down, and locks the
  page's scroll while open. Widening past the `md` breakpoint closes it.
- **One player for everything** (`useAudioPlayer`): a single audio element, so playing a
  set stops the stream and vice versa. Pausing the live stream hangs up instead of
  buffering, and playing it again reconnects at the live edge. It sets the media session,
  so phones show the title, play/pause, skip back/forward and a scrubber (position state)
  on the lock screen. Recorded sets only; the stream gets play/pause.
- Status and sets are polled every 15 s while the tab is visible (`useDjStream`), so the
  page flips to live on its own and a finished set appears shortly after it ends.
- If the backend can't be reached, the hero stays on off air with the error underneath,
  and the past sets don't show.

Titles and descriptions are set, and sets deleted, from the admin page's DJ tab
(`website/docs/ADMIN.md`).

On the home page, the opium den is the DJ board (`/images/8bit/dj_board.png`) sitting in the
cave. While the stream's live it gets music notes and a LIVE! tag (the `djLive` object field,
`website/docs/HOME.md`).

## Files

| File | Purpose |
|------|---------|
| `website/app/opium-den/page.tsx` | The page, its metadata, and the Listen links (`LISTEN_LINKS`) |
| `website/components/opium-den/DjBooth.tsx` | The booth: wires the hero, list and bar to one player |
| `website/components/opium-den/LiveHero.tsx` | The live stream row |
| `website/components/opium-den/SetList.tsx` | The past sets track list |
| `website/components/opium-den/PlayerBar.tsx` | The now-playing bar (mini player on phones) |
| `website/components/opium-den/NowPlayingSheet.tsx` | The phone's full-screen now-playing view, swipe down to close |
| `website/components/opium-den/PlayerControls.tsx` | Play/pause, skip and progress, shared by the bar and the sheet |
| `website/components/opium-den/SliderBar.tsx` | Seek and volume slider (a range input under a styled track), with a large touch version |
| `website/lib/useScrub.ts` | Holds a slider's drag position and commits it on release |
| `website/components/opium-den/EqBars.tsx` | The bouncing equalizer (`.den-eq-bar` in `globals.css`) |
| `website/components/opium-den/playerIcons.tsx` | Play, pause, skip, volume, chevron and spinner icons |
| `website/lib/useAudioPlayer.ts` | The shared audio element: play/pause/seek/volume state, live-edge reconnects, media session |
| `website/lib/useDjStream.ts` | Polls `/dj/status` and `/dj/sets` |
| `website/app/opium-den/djApi.ts` | Types, fetchers and urls for the `/dj` endpoints, shared with the admin tab |

Times and lengths are formatted with `parseBackendTime`, `formatDate`, `formatDuration`
and `formatElapsed` from `website/app/admin/format.ts`.
