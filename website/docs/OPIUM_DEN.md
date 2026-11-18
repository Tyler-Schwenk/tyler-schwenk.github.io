# Opium Den

## Overview

`/opium-den` is the music page: what the project is, the DJ booth (the live stream and
past sets), and a list of outside radio and sets worth listening to. The page itself is a
server component; the booth is the only client part.

## DJ Booth

Laid out like a streaming app. When Tyler's practicing on the decks, whatever's playing
streams to the booth live, and every session is recorded and shows up underneath as a
past set once it ends. The pipeline (rekordbox, butt, icecast, recording) is in
`pi/docs/services/dj-stream.md`.

- **Live hero**: the DJ board art, a "live now" badge, how long it's been on and how many
  are listening, and a big round play button. Off air, it's greyed out with a note to
  check back.
- **Past sets**: a numbered track list, newest first. Each row shows the title (or the
  date when untitled), the date, the start of the description, and the length. Tapping a
  row plays or pauses it; the playing row is highlighted with bouncing bars. Sets with a
  description get an "about this set" toggle that shows it in full (line breaks kept).
- **Player bar**: pinned to the bottom once anything plays. Art, title, play/pause, back
  15 s / forward 30 s, a seek bar with elapsed and total time, and volume. For the live
  stream the seek bar is a LIVE pill. On phones it folds down to title, play/pause, and a
  thin progress line. While it's up it pads the page's bottom so nothing hides under it.
- **One player for everything** (`useAudioPlayer`): a single audio element, so playing a
  set stops the stream and vice versa. Pausing the live stream hangs up instead of
  buffering, and playing it again reconnects at the live edge. It sets the media session,
  so phones show the title and controls on the lock screen.
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
| `website/app/opium-den/page.tsx` | The page and its metadata |
| `website/components/opium-den/DjBooth.tsx` | The booth: wires the hero, list and bar to one player |
| `website/components/opium-den/LiveHero.tsx` | The live stream card |
| `website/components/opium-den/SetList.tsx` | The past sets track list |
| `website/components/opium-den/PlayerBar.tsx` | The now-playing bar |
| `website/components/opium-den/SliderBar.tsx` | Seek and volume slider (a range input under a styled track) |
| `website/components/opium-den/EqBars.tsx` | The bouncing equalizer (`.den-eq-bar` in `globals.css`) |
| `website/components/opium-den/playerIcons.tsx` | Play, pause, skip, volume and spinner icons |
| `website/lib/useAudioPlayer.ts` | The shared audio element: play/pause/seek/volume state, live-edge reconnects, media session |
| `website/lib/useDjStream.ts` | Polls `/dj/status` and `/dj/sets` |
| `website/app/opium-den/djApi.ts` | Types, fetchers and urls for the `/dj` endpoints, shared with the admin tab |

Times and lengths are formatted with `parseBackendTime`, `formatDate`, `formatDuration`
and `formatElapsed` from `website/app/admin/format.ts`.
