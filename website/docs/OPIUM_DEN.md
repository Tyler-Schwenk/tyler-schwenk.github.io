# Opium Den

## Overview

The opium den is the music section, two pages sharing one layout:

- `/opium-den`: what the project is, the DJ booth (the way into the live room, and past
  sets), and a list of outside radio and sets worth listening to.
- `/opium-den/live`: the live room. The stream, how long it's been on, who's listening,
  and a chat.

`app/opium-den/layout.tsx` wraps both: the home button, the den's look (`.den-page`), and
the shared player (`DenPlayerProvider`). The player lives in the layout, so music keeps
playing when you move between the den and the room. Both pages are server components for
their metadata; the booth and the room are the client parts.

## Look

A dark oxblood room: Inter throughout, hairline dividers instead of nested cards, and red
for anything you can play and anything live.

- Colours are Tailwind theme tokens in `globals.css` (`@theme`): `den-bg`, `den-raised`
  (the chat panel), `den-ink` (text), `den-muted`, `den-faint`, `den-line` (red-tinted
  hairlines), `den-accent` (red, for fills and dots) and `den-accent-soft` (red as text:
  links, chat names, the "Live now" label). Use them as `bg-den-bg`, `text-den-muted`,
  `border-den-line`, etc.
- Red shows up as: the play buttons (round, red, white icon), the seek bar's fill, the
  rule under each section heading, the playing set's title and bouncing bars, link and
  row hovers, and the live row and room lighting up while on air.
- `.den-page` (on the layout's wrapper) sets the font and a soft red glow across the top of
  the page, and paints `html`/`body` the same colour, so the space the player bar pads onto
  the body and iOS overscroll don't flash white.
- The intro's "what is this" is a `<details>` disclosure styled as a red text link.
- **Listen**: outside links come from `LISTEN_LINKS` in `page.tsx` (name, source, url),
  shown as rows with an arrow. Stacked name over source on phones, side by side from
  `sm` up. Only `http` urls open in a new tab, so a `#` placeholder stays put.

## DJ Booth

When Tyler's practicing on the decks, whatever's playing streams live, and every session
is recorded and shows up as a past set once it ends. The pipeline (rekordbox, butt,
icecast, recording) is in `pi/docs/services/dj-stream.md`.

- **Live row** (`LiveHero`): off air, one quiet row between hairlines with the DJ board
  art greyed out, when it streams, and a small "Live room" link. Live, it lights up as a red-tinted panel: "Live now",
  how long it's been on, how many are listening (only once someone is), a red play button
  to listen right there, and **Join the room**, which goes to `/opium-den/live`.
- **Past sets**: a numbered track list, newest first. Each row shows the title (or the
  date when untitled), the date, the start of the description, and the length. Tapping a
  row plays or pauses it (the number turns into a red play/pause on hover); the playing
  row's title goes red with bouncing bars. Sets with a description get an "about this set"
  toggle that shows it in full (line breaks kept).
- Status and sets are polled every 15 s while the tab is visible (`useDjStream`), so the
  page flips to live on its own and a finished set appears shortly after it ends.
- If the backend can't be reached, the live row stays on off air with the error
  underneath, and the past sets don't show.

Titles and descriptions are set, and sets deleted, from the admin page's DJ tab
(`website/docs/ADMIN.md`).

On the home page there are two ways in (object fields in `website/docs/HOME.md`):

- **The DJ board** (`/images/8bit/dj_board.png`) sitting in the cave goes to the den. While
  the stream's live, music notes float up off it (`djNotes`).
- **The radio tower** on the hill just left of the cave goes to the live room. It's idle
  (`radio-tower-idle.png`, steady red light) off air, and broadcasting
  (`radio-tower-live.png`, signal waves) with a blinking LIVE! tag while live
  (`liveIconSrc`, `liveTag`). Both sprites were cut from one sheet
  (`input/opium-den/Pixel Art Radio Towers_ Idle and Active.png`, gitignored) with the same
  canvas and base point, so the swap doesn't shift it. The DJ board sprite's full-size
  original is `input/opium-den/dj_board.png`.

The den and the room link to each other: the room's "Opium Den" link at the top, and the
den's live row ("Join the room" while live, a small "Live room" link off air).

## Live Room

`/opium-den/live`, laid out like a stream page. It's a link of its own, so it can be sent
around when Tyler goes live.

- **Layout**: built around the chat. The room is exactly one screen tall (less the player
  bar when a past set's playing, via the `--den-bar-clearance` variable `PlayerBar` sets on
  the body), so the page itself never scrolls and the message box sits at the bottom where
  a thumb is. On top, a compact header: a small DJ board, "Live from the den", the status
  line, the red play button, and volume on desktop. Red-tinted while live, greyed out off
  air. The rest of the screen is the chat. "Opium Den" at the top goes back to the den.
- **Chat** (`LiveChat`): anyone can read it: the last few hours of messages, so the last
  set's chat stays up for a while. It follows new messages unless you've scrolled up to
  read, and scrolling it doesn't drag the page. Sending only works while the stream's live;
  off air the box disappears, the header says it opens with the next set, and an empty
  room points to the past sets.
  - There's only ever a message box, so typing always goes where you'd expect. Without a
    name yet, the first send opens a "Pick a name first" panel above the box instead (its
    own labelled form, a squarer red-outlined field, so it can't be mistaken for the
    message box). The message waits in the box and sends as soon as a name is picked.
    Under the box it says "chatting as <name> · change", or that you'll pick a name with
    your first message.
  - The name is remembered in this browser (`localStorage`, key `den-chat-nickname`,
    falling back to just this page load when storage is blocked). Your own name shows in
    white, everyone else's in red.
  - Messages are one line, up to 280 characters; names up to 24. Inputs are 16px on phones,
    since iOS zooms the page into anything smaller. Sending too fast (more than 8 a minute)
    gets a "slow down" note instead of the message.
  - The room is re-fetched every 3 s while the tab's visible (`useDjChat`), whole, so a
    message deleted from the admin page's DJ tab disappears for everyone. Your own message
    shows the moment it's sent.
- Status is polled every 5 s in here (faster than the den), so the listener count and
  going off air show quickly.
- The player bar hides in the room while the live stream is what's playing, since the
  stage has the controls. Anything else playing (a past set) keeps the bar.

The backend side (`/dj/chat`, limits, moderation) is in
`pi/docs/api/website-backend-api.md#live-room-chat`.

## Player

- **One player for everything** (`useAudioPlayer`, provided by `DenPlayerProvider` and read
  with `useDenPlayer`): a single audio element, so playing a set stops the stream and vice
  versa, and it carries on across the den and the room. Pausing the live stream hangs up
  instead of buffering, and playing it again reconnects at the live edge. It sets the
  media session, so phones show the title, play/pause, skip back/forward and a scrubber
  (position state) on the lock screen. Recorded sets only; the stream gets play/pause.
- **Player bar**: pinned to the bottom once anything plays. Art, title, red play/pause,
  back 15 s / forward 30 s, a seek bar with elapsed and total time, and volume. For the
  live stream the seek bar is a LIVE pill. On phones it folds down to a mini player (title,
  play/pause, a thin progress line). While it's up it pads the page's bottom so nothing
  hides under it. Dragging a seek bar only seeks when you let go (`useScrub`), so a drag
  is one range request to the Pi instead of dozens.
- **Now playing sheet** (phones only): tapping the mini player anywhere but play/pause
  slides up a full-screen view, like Spotify or Apple Music: big art, title, a full-width
  seek bar with elapsed and total time, and back 15 s / play / forward 30 s (just play for
  the live stream). It closes with the chevron, Escape, or a swipe down, and locks the
  page's scroll while open. Widening past the `md` breakpoint closes it.

## Files

| File | Purpose |
|------|---------|
| `website/app/opium-den/layout.tsx` | The frame for both pages: home button, `.den-page`, shared player |
| `website/app/opium-den/page.tsx` | The den, its metadata, and the Listen links (`LISTEN_LINKS`) |
| `website/app/opium-den/live/page.tsx` | The live room's page and metadata |
| `website/components/opium-den/DenPlayerProvider.tsx` | The shared player (`useDenPlayer`) and the player bar, hidden in the room while live plays |
| `website/components/opium-den/DjBooth.tsx` | The booth: wires the live row and set list to the shared player |
| `website/components/opium-den/LiveHero.tsx` | The den's live row, the way into the room |
| `website/components/opium-den/LiveStatus.tsx` | The "Live now / Off air" line, shared by the row and the room |
| `website/components/opium-den/LiveRoom.tsx` | The live room: stage and chat |
| `website/components/opium-den/LiveChat.tsx` | The room's chat panel: messages, name step, message box |
| `website/components/opium-den/SetList.tsx` | The past sets track list |
| `website/components/opium-den/PlayerBar.tsx` | The now-playing bar (mini player on phones) |
| `website/components/opium-den/NowPlayingSheet.tsx` | The phone's full-screen now-playing view, swipe down to close |
| `website/components/opium-den/PlayerControls.tsx` | Play/pause, skip, progress and volume, shared by the bar, sheet and room |
| `website/components/opium-den/SliderBar.tsx` | Seek and volume slider (a range input under a styled track), with a large touch version |
| `website/components/opium-den/EqBars.tsx` | The bouncing equalizer (`.den-eq-bar` in `globals.css`) |
| `website/components/opium-den/playerIcons.tsx` | Play, pause, skip, volume, chevron, send, external link and spinner icons |
| `website/lib/useAudioPlayer.ts` | The audio element: play/pause/seek/volume state, live-edge reconnects, media session |
| `website/lib/useScrub.ts` | Holds a slider's drag position and commits it on release |
| `website/lib/usePoll.ts` | Fetch now and every so often while the tab's visible; used by the hooks below and the room's status |
| `website/lib/useDjStream.ts` | Polls `/dj/status` and `/dj/sets` for the den |
| `website/lib/useDjChat.ts` | Polls `/dj/chat`, sends messages, remembers the nickname |
| `website/app/opium-den/djApi.ts` | Types, fetchers, urls and limits for the `/dj` endpoints and chat, shared with the admin tab |

Times and lengths are formatted with `parseBackendTime`, `formatDate`, `formatDuration`
and `formatElapsed` from `website/app/admin/format.ts`.
