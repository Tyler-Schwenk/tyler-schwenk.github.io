# Opium Den

## Overview

The opium den is the music section. It has two parts sharing one layout and look:

- `/opium-den`: the den itself. What the project is (a self hosted music library to stream
  and share, still to come), a link over to the live section, and a list of outside radio
  and sets worth listening to.
- **The live section**, everything DJ, under `/opium-den/live`:
  - `/opium-den/live`: the section's front page. The live monitor (the way into the room, with
    the live alerts signup) and every past set.
  - `/opium-den/live/room`: the live room, the live stream's full view. The stream, how
    long it's been on, who's listening, and a chat.
  - `/opium-den/live/set?id=<set id>`: a past set's full view, with its waveform and its
    chat replaying as it plays.
  - `/opium-den/live/alerts`: signing up for an email when Tyler goes live, and where those
    emails' confirm and unsubscribe links land.
- `/opium-den/set?id=` is where set pages used to be. It forwards to the same set under
  `/opium-den/live/set`, since links to it were already shared.

`app/opium-den/layout.tsx` wraps them all: the home button and the den's look
(`.den-page`). The player isn't in it: it's site-wide, in the root layout (see Player
below). The pages are server components for their metadata; the live monitor, set list, room
and set replay are the client parts.

## Look

A seismograph's chart paper: warm off-white paper, black ink, faint grid lines, and one
signal red for anything you can play and anything live. Sets are drawn as their waveforms,
mirrored about the middle like a seismograph trace.

- Colours are Tailwind theme tokens in `globals.css` (`@theme`): `den-bg` (the paper),
  `den-raised` (panels on it: the monitor, the chat), `den-ink` (text, rules, waveforms),
  `den-muted`, `den-faint`, `den-line` (grid lines and the hairlines between rows),
  `den-accent` (signal red, for fills) and `den-accent-soft` (a darker red for text, so it
  reads on the paper). Use them as `bg-den-bg`, `text-den-muted`, `border-den-line`, etc.
- Type: Inter Tight (`font-den`, extra bold and tightly tracked for the big headings) and
  JetBrains Mono (`font-den-mono`, small and usually uppercase, for times, counts, labels,
  chat names and status lines). Both are loaded in `app/layout.tsx`.
- Panels are square with a 1px ink border; full-width ink rules sit under headings and
  above footers. `.den-grid` is the chart paper (grid lines every 25px down and 40px
  across), behind the live monitor and the set page's waveform.
- Red shows up as: the round play buttons, played waveform bars and playheads, the
  blinking on air dot (`.den-rec-blink`), the playing set's title, the red edge on the
  room's header and the den's live panel while on air, underlines on mono links, and the
  full stop after the big headings.
- `.den-invert` flips the tokens to light ink on black. The player bar uses it, so its
  controls take the same classes as everywhere else.
- `.den-page` (on the layout's wrapper) sets the font and paints `html`/`body` the paper
  colour, so the space the player bar pads onto the body and iOS overscroll don't flash
  white. `.den-font` is just the font, for the player bar, which also shows on the rest of
  the site.
- **Covers** (`SetArt`): each set can have a cover image, uploaded from the admin page. It
  shows square and cropped to fill, in full colour: in the set list, the player bar, the live monitor and room (the set being recorded), the set
  page, and the phone's lock screen. Without one it's a grey tile with a faint record on
  it. The pixel DJ board is only on the home page now.
- The intro's "what is this" is a `<details>` disclosure styled as a mono link.
- **Listen**: outside links come from `LISTEN_LINKS` in `page.tsx` (name, source, url),
  shown as rows with an arrow. Stacked name over source on phones, side by side from
  `sm` up. Only `http` urls open in a new tab, so a `#` placeholder stays put.

## The den

`/opium-den`: the intro, then **Live from the den** (`LiveSectionLink`), one panel linking
to the live section with "my dj sets, live and recorded, with their chat" and the live
status line. It gets a red edge while the stream's on (status polled every 15 s while the
tab's visible). Then the Listen links.

## Live Section

`/opium-den/live`. When Tyler's practicing on the decks, whatever's playing streams live,
and every session is recorded and shows up here as a past set once it ends. The pipeline
(rekordbox, butt, icecast, recording) is in `pi/docs/services/dj-stream.md`.

- **Header**: an "Opium Den" back link, "Live from the den." and a line on what it is.
- **Live monitor** (`LiveHero`): the way into the room.
  A header reads out the stream in mono: "On air" with a blinking dot, when it started,
  how long it's been going (ticking every second, `useNow`), and how many are listening
  (only once someone is), with the set's cover once one's uploaded. Then a red **Listen**
  button to play it right there and **Enter the room**, which goes to
  `/opium-den/live/room`. Under that, chart paper (`LiveTrace`) with the set so far traced
  from the left edge to the pen, which is "now": its sound, measured by the Pi as it
  streams (`GET /dj/live/trace`, polled every 10 s), drawn with the same mirrored bars as a
  finished set (`WaveBars`) and as far across as the levels cover. A tick along the top
  marks each chat message, and the latest three are pinned on where they were said, each
  in its own lane (one on phones). The room's chat is polled every 15 s. Both are only
  fetched while live. Without a trace yet (the first seconds of a set, or a Pi that hasn't
  got the endpoint) it's just the baseline. A time axis runs under it: the start, halfway,
  and "now". Off air the readout says when it streams and there's a link to the room, and
  the paper says "Off air right now." with a big **Get notified when we go live** button
  (`AlertSignup prominent`) that opens the live alerts signup in place, since that's the
  main thing to do then.
- **Live alerts link**: while live, a small "Get an email when I go live" under the monitor
  opens the signup in place (see Live Alerts below). Off air the monitor has the big one
  instead.
- **Past sets** (`SetList`, `SetTrace`): three stats under the heading (how many sets, how
  many hours, and how many chat messages across them all, shown once every set's chat has
  loaded), then the sets, newest first. Each row is the set's cover,
  the title (or "untitled set"), the date and how many chat messages, and the start of the
  description (with "more" when it's long enough to be cut off). Beside it on desktop (under
  it on phones), the set's waveform drawn to scale: the longest set runs 88% of the row
  (78% on phones) and the rest are cut to match, with its length just past the end, and a
  tick above it for each chat message. A half-hour ruler runs along the top on desktop.
  The cover plays or pauses it: a play icon over it on hover (always on touchscreens),
  bouncing bars while it plays, pause on hover then. The trace is a seek bar too (the
  same `RangeOverlay` as the set page): click or drag to play from there, hover to see the
  time you'd land on. The playing set's title goes red, and its trace turns red up to a
  playhead with the time under it. The title opens the set's page.
- Each set's waveform and chat are loaded once (`useDjSetTraces`), not with every poll:
  chats all at once, waveforms one at a time, newest first, so the Pi never works out
  several at once. Until a waveform's in, its trace is flat faint bars, pulsing while it
  loads; a failed one stays flat (logged to the console).
- Status and sets are polled every 15 s while the tab is visible (`useDjStream`), so the
  page flips to live on its own and a finished set appears shortly after it ends.
- If the backend can't be reached, the monitor stays on off air with the error in its
  header, and the past sets don't show.

Covers, titles and descriptions are set, and sets deleted, from the admin page's DJ tab
(`website/docs/ADMIN.md`). A set's cover can go on while it's still recording, from the
tab's "On air now" card.

On the home page there are two ways in (object fields in `website/docs/HOME.md`):

- **The DJ board** (`/images/8bit/dj_board.png`) sitting in the cave goes to the den. While
  the stream's live, music notes float up off it (`djNotes`).
- **The radio tower** on the hill just left of the cave goes to the live section. It's idle
  (`radio-tower-idle.png`, steady red light) off air, and broadcasting
  (`radio-tower-live.png`, signal waves) with a blinking LIVE! tag while live
  (`liveIconSrc`, `liveTag`). Both sprites were cut from one sheet
  (`input/opium-den/Pixel Art Radio Towers_ Idle and Active.png`, gitignored) with the same
  canvas and base point, so the swap doesn't shift it. The DJ board sprite's full-size
  original is `input/opium-den/dj_board.png`.

Getting around: the den links to the live section and back. The room and set pages go back
to the section ("Live from the den", "All sets"), and the section's live monitor goes into the
room ("Enter the room" while live, "The room" off air).

## Live Room

`/opium-den/live/room`, laid out like a stream page: the live stream's full view. It's a
link of its own, so it can be sent around when Tyler goes live, and it's where the live
alert emails point.

- **Layout**: built around the chat. The room is exactly one screen tall (less the player
  bar when a past set's playing, via the `--den-bar-clearance` variable `PlayerBar` sets on
  the body), so the page itself never scrolls and the message box sits at the bottom where
  a thumb is. On top, a compact header panel: the set's cover, "Live room", the status
  line, the red play button, and volume on desktop. A red edge down its left while live,
  greyed out off air. The rest of the screen is the chat panel. "Live from the den" at the top goes back to the section.
- **Chat** (`LiveChat`): anyone can read it: the last few hours of messages, so the last
  set's chat stays up for a while. It follows new messages unless you've scrolled up to
  read, and scrolling it doesn't drag the page. Sending only works while the stream's live;
  off air the message box is swapped for the live alerts signup, the header says it opens
  with the next set, and an empty room points to the past sets.
  - There's only ever a message box, so typing always goes where you'd expect. Without a
    name yet, the first send opens a "Pick a name first" panel above the box instead (its
    own labelled form, a square red-outlined field, so it can't be mistaken for the
    message box, a pill outlined in ink). The message waits in the box and sends as soon as a name is picked.
    Under the box it says "chatting as <name> · change", or that you'll pick a name with
    your first message.
  - The name is remembered in this browser (`localStorage`, key `den-chat-nickname`,
    falling back to just this page load when storage is blocked). Names are small mono
    caps: your own in ink, everyone else's in red.
  - One person per name per set: the first browser to send with a name during a set holds
    it until the set ends, and nobody else can chat as it meanwhile (ignoring case). The
    next set, every name's free again, so a new device just takes its name back then. Each
    browser makes a random key once (`localStorage`, key `den-chat-key`) and sends it with
    every message. Sending as a name someone else has this set says so and opens the name
    panel again, the message still waiting in the box. Backend side:
    `pi/docs/api/website-backend-api.md#post-djchat`.
  - Messages are one line, up to 280 characters; names up to 24. Inputs are 16px on phones,
    since iOS zooms the page into anything smaller. Sending too fast (more than 8 a minute)
    gets a "slow down" note instead of the message.
  - The room is re-fetched every 3 s while the tab's visible (`useDjChat`), whole, so a
    message deleted from the admin page's DJ tab disappears for everyone. Your own message
    shows the moment it's sent.
- Status is polled every 5 s in here (faster than the section), so the listener count and
  going off air show quickly.
- While the live stream is what's loaded, the player bar steps aside in here
  (`useCoverPlayerBar`), since the header has the controls. Anything else playing (a past
  set) keeps the bar.

The backend side (`/dj/chat`, limits, moderation) is in
`pi/docs/api/website-backend-api.md#live-room-chat`.

## Live Alerts

People can sign up for an email when Tyler goes live. Alerts are never automatic: Tyler
writes and sends each one from the admin page's DJ tab (`website/docs/ADMIN.md`). The
backend, the emails and the mail setup are in `pi/docs/services/dj-stream.md#live-alerts`.

- **Signup** (`AlertSignup`): an email box and "Sign up", with a line saying they'll
  confirm by email first. Once it's sent, it turns into "check your inbox at ...", with a
  red line to check spam too. It starts as a small mono link with a red underline that opens
  it (under the section's live monitor while live), as a big pill (`prominent`: the live
  monitor off air), or open (`startOpen`: the live room off air, and the alerts page).
- **`/opium-den/live/alerts`** (`AlertsLanding`): one static page that reads its query on
  the client. `?confirm=<token>` confirms ("You're on the list"), `?unsubscribe=<token>`
  unsubscribes ("You're off the list", with the signup link in case they change their
  mind). Each runs as the page opens, as a POST, not from the link itself, so mail
  scanners that open links can't trigger them. A bad link says so and offers the signup.
  With no query it's just the signup, so it's the link to send people.
- Errors are the backend's own sentences (a bad address, too many tries, mail not set up).

## Set Page

`/opium-den/live/set?id=<set id>` (`SetReplay`), one past set replayed with its chat, like
a SoundCloud track page: the set's full view. One static page that reads `?id=` on the
client, so new sets need no rebuild. Laid out like the live room: one screen tall, less the
player bar when it's showing.

- **Header**: the cover, the title (or date), "date · length · N messages" in mono, the red play
  button, and an "about this set" toggle when it has a description. Once this set's loaded
  in the player, back 15 s and forward 30 s sit either side of play, and volume next to
  them on desktop. "All sets" at the top goes back to the section.
- **Cover**: when the set has one, tapping it opens it full screen (`CoverViewer`) over
  everything. A tap anywhere, the close button or Escape closes it.
- **Waveform** (`Waveform`): the set's loudness as bars (from `GET /dj/sets/{id}/waveform`),
  mirrored about the middle on chart paper (`WaveBars`, shared with the live section's
  to-scale list). It's the seek bar: played bars are red, and on desktop the stretch up to the mouse is faint red with the time you'd land
  on. Click or drag anywhere to play from there, even when the set isn't loaded yet
  (`play(track, startAtS)` holds the position until the file's metadata is in). Elapsed and
  total time sit in its bottom corners. An invisible range input lies over it
  (`RangeOverlay`, shared with `SliderBar`), so keyboards and screen readers seek it too.
  It's as many bars as fit the width (3px each), each the loudest of its slice. While it
  loads it's flat faint pulsing bars, and if it fails they stop pulsing, it says so and
  still seeks.
- **Chat markers**: under the waveform, a tick for every message at its moment, red once
  passed. Tap one to jump there. The message that just went by pops up as a flag by its
  tick for 5 s (`BUBBLE_VISIBLE_S`).
- **Chat replay**: only the messages up to where playback is, so the chat fills in as the
  set plays and empties back out when you skip back, like being there. It follows the newest
  line unless you've scrolled up (`useStickToBottom`, shared with the live room). Each line
  starts with its time in the set, which jumps there. The header counts "6 of 9". Before
  playing it says when the first message comes in. Your own name shows in ink, like in
  the room.
- Messages are matched to a set by time, and placed a few seconds earlier than they were
  sent, since listeners hear the stream behind the decks. How that works is in
  `pi/docs/api/website-backend-api.md` (`GET /dj/sets/{set_id}/chat`).
- The set, its chat and its waveform are loaded once (`useDjSetReplay`), no polling. The
  waveform loads on its own since an older set's first one can take the Pi a few seconds.
- A bad or missing id, or a deleted set, shows a note pointing back to the section.
- While this set's the one loaded, the player bar steps aside (`useCoverPlayerBar`). With
  a different set or the stream playing, the bar stays.

## Player

Every set and the stream play through one player for the whole site, in two forms: the
**full view** (a set's page, or the live room for the stream) and the **minimized** bar
along the bottom of every other page.

- **One player for everything** (`useAudioPlayer`, provided by `DenPlayerProvider` in the
  root layout `app/layout.tsx`, and read with `useDenPlayer`): a single audio element, so
  playing a set stops the stream and vice versa. It isn't in the page and the root layout
  never unmounts, so it keeps going as you move around the whole site (all internal links
  are `next/link`, so nothing reloads the page), with the tab in the background, or the
  phone locked. Pausing the live stream hangs up instead of buffering, and playing it
  again reconnects at the live edge. A full page reload stops it.
- **Tracks** (`PlayerTrack`, built by `djSetTrack` and `djLiveTrack` in `djApi.ts`) carry
  their full view's link (`href`) and cover thumbnail (`artSrc`) along with the title and
  audio url. The stream is always the one track id (`LIVE_TRACK_ID`), whatever set's on.
- **Lock screen**: it sets the media session, so phones show the title, the cover (the
  site's icon without one), play/pause, skip back/forward and a scrubber (position state).
  Recorded sets only; the stream gets play/pause.
- **Player bar** (`PlayerBar`): pinned to the bottom of every page once anything plays, a
  black strip (`.den-invert`) wherever on the site it shows. Cover, title, red play/pause, back 15 s / forward 30 s, a seek bar with elapsed and total
  time, volume, and an X. For the live stream the seek bar is a LIVE pill. The cover and
  title open the full view. On phones it folds down to a mini player (cover, title,
  play/pause, the X, a thin progress line) and tapping anywhere but the buttons opens the
  full view. The X is for when you're done listening (`stop`): it stops and unloads the
  audio, clears the track and takes the controls off the lock screen, and the bar's gone
  until something's played again. While
  it's up it pads the page's bottom so nothing hides under it. Dragging a seek bar only
  seeks when you let go (`useScrub`), so a drag is one range request to the Pi instead of
  dozens.
- **When the bar hides**: on the full view of whatever's loaded (the page calls
  `useCoverPlayerBar` with its track id, and the bar steps aside while they match), and on
  pages with no room for it (`/display`, the kiosk screens, and `/admin`, which has its
  own bottom nav on phones). The audio keeps playing either way.

## Files

| File | Purpose |
|------|---------|
| `website/app/layout.tsx` | The root layout; mounts `DenPlayerProvider` around the whole site |
| `website/app/opium-den/layout.tsx` | The frame for every den page: home button, `.den-page` |
| `website/app/opium-den/page.tsx` | The den, its metadata, and the Listen links (`LISTEN_LINKS`) |
| `website/app/opium-den/live/page.tsx` | The live section's page and metadata |
| `website/app/opium-den/live/room/page.tsx` | The live room's page and metadata |
| `website/app/opium-den/live/set/page.tsx` | The set page and its metadata |
| `website/app/opium-den/live/alerts/page.tsx` | The live alerts page and its metadata |
| `website/app/opium-den/set/page.tsx` | Forwards old `/opium-den/set?id=` links to the set page |
| `website/components/opium-den/DenPlayerProvider.tsx` | The site's shared player (`useDenPlayer`), the player bar, and `useCoverPlayerBar` for full views |
| `website/components/opium-den/LiveSectionLink.tsx` | The den's link over to the live section, with the live status |
| `website/components/opium-den/DjBooth.tsx` | The live section: the stats, and wires the live monitor and set list to the shared player |
| `website/components/opium-den/LiveHero.tsx` | The section's live monitor, the way into the room: the on air readout, buttons and time axis |
| `website/components/opium-den/LiveTrace.tsx` | The monitor's chart paper: the set so far traced as the room's chat, with the latest messages pinned on |
| `website/components/opium-den/LiveStatus.tsx` | The "Live now / Off air" line, shared by the den's link and the room |
| `website/components/opium-den/LiveRoom.tsx` | The live room: header and chat |
| `website/components/opium-den/LiveChat.tsx` | The room's chat panel: messages, name step, message box |
| `website/components/opium-den/SetList.tsx` | Every past set, to scale, with the half-hour ruler |
| `website/components/opium-den/SetTrace.tsx` | One set's waveform drawn to scale in the list, with its chat ticks; a seek bar |
| `website/components/opium-den/SetArt.tsx` | A set's cover, or the placeholder tile |
| `website/components/opium-den/CoverViewer.tsx` | A cover full screen, from the set page |
| `website/components/opium-den/SetReplay.tsx` | The set page: header, waveform, chat replay |
| `website/components/opium-den/Waveform.tsx` | The set page's waveform seek bar with chat markers and the passing message's flag, plus the shared bars (`WaveBars`) and helpers |
| `website/components/opium-den/ChatLine.tsx` | One chat line, shared by the room and the replay |
| `website/lib/useDjSetTraces.ts` | Loads each listed set's waveform and chat once, for the to-scale list |
| `website/lib/useNow.ts` | The current time, ticking, for the monitor's elapsed clock |
| `website/lib/useDjSetReplay.ts` | Loads a set, its chat and its waveform for the set page |
| `website/lib/useStickToBottom.ts` | Keeps a chat list on its newest line unless you've scrolled up |
| `website/components/opium-den/PlayerBar.tsx` | The minimized player along the bottom (mini player on phones) |
| `website/components/opium-den/PlayerControls.tsx` | Play/pause, skip, progress and volume, shared by the bar, the room and the set page |
| `website/components/opium-den/SliderBar.tsx` | Seek and volume slider, and `RangeOverlay` (the invisible range input the slider and waveform sit under) |
| `website/components/opium-den/EqBars.tsx` | The bouncing equalizer (`.den-eq-bar` in `globals.css`) |
| `website/components/opium-den/playerIcons.tsx` | Play, pause, skip, volume, chevron, send, external link, record and spinner icons |
| `website/lib/useAudioPlayer.ts` | The audio element: play/pause/seek/volume state, live-edge reconnects, media session |
| `website/lib/useScrub.ts` | Holds a slider's drag position and commits it on release |
| `website/lib/usePoll.ts` | Fetch now and every so often while the tab's visible; used by the hooks below and the room's status |
| `website/lib/useDjStream.ts` | Polls `/dj/status` and `/dj/sets` for the live section |
| `website/lib/useDjChat.ts` | Polls `/dj/chat`, sends messages, remembers the nickname |
| `website/components/opium-den/AlertSignup.tsx` | The live alerts signup: a link that opens an email box |
| `website/components/opium-den/AlertsLanding.tsx` | The alerts page: confirms or unsubscribes from an email's link, or the signup |
| `website/app/opium-den/djApi.ts` | Types, fetchers, urls and limits for the `/dj` endpoints (chat, covers, live alerts), the live section's paths, and sets and the stream as player tracks (`djSetTrack`, `djLiveTrack`), shared with the admin tab |

Times and lengths are formatted with `parseBackendTime`, `formatDate`, `formatDuration`
and `formatElapsed` from `website/app/admin/format.ts`.

`set_id` and `image_id` are optional in `djApi.ts`'s types and checked with `== null`: the
site deploys on push but the Pi is pulled by hand, so for a while the site can be talking
to a backend from before covers existed, and it should just show the placeholder then.
