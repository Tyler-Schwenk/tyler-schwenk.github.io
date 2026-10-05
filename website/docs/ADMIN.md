# Admin Page Documentation

## Overview

`/admin` is the site's admin page: one login (the single admin account, JWT from
`POST /auth/login`), then tabs for everything that needs it:

| Tab | Hash | What it does |
|-----|------|--------------|
| Display remote | `#display` | Remote control for the display kiosk (displaytop): what the screens show now, and buttons for the kiosk's keys |
| Galleries | `#galleries` | Reorder, edit (name/slug/description/public), delete galleries; expand one to delete photos or add more; create a new gallery |
| Upload | `#upload` | Photos into an existing or new gallery, or a video (with the existing videos list and delete) |
| RSVPs | `#rsvps` | Event RSVPs grouped by event, with responses and a rough headcount (responders + friends); delete a response |
| Public Square | `#square` | Moderation: newest posts, expand to read comments, hard-delete a post (with its comments and votes) or a comment |

It's linked from the bottom of the home page ("ADMIN"). It's `noindex` and not in the
sitemap. The open tab lives in the url hash, so `tyler-schwenk.com/admin#display` can be
bookmarked (or saved to a phone's home screen) to open straight on the remote; `/admin`
alone opens the first tab, the remote.

The old static page lived at `/admin/` (`public/admin/index.html`); that file is now
just a redirect to `/admin`, keeping the hash, so old bookmarks still work.
`public/admin/upload.html` is an older standalone upload page and isn't linked from
anywhere.

## Layout

Phone first. On small screens the tabs are a bar along the bottom (icons + short labels,
padded clear of the iPhone home indicator via `viewport-fit=cover` and
`env(safe-area-inset-bottom)`), and the header shows the current tab's name. From the `md`
breakpoint up, the tabs move into the header and the bottom bar goes away. Touch
targets are at least 44 px, and inputs use 16 px text so iOS doesn't zoom in on focus.

Dark slate with an orange accent, matching the gallery pages.

## Architecture

### Files

| File | Purpose |
|------|---------|
| `website/app/admin/page.tsx` | Shell: login gate, `TABS`, hash-routed tab switching, header and bottom bar |
| `website/app/admin/layout.tsx` | Title, `noindex`, `viewport-fit=cover`, dark page background |
| `website/app/admin/adminApi.ts` | `createAdminFetch` (adds the JWT, logs out on 401, turns failures into `AdminRequestError`s with readable messages), `adminRequest`, `useAdminData` (load on mount, `reload`, `setData`), `AdminFetchContext` / `useAdminFetch` |
| `website/app/admin/ui.tsx` | Shared building blocks: `Button`, `Field`, `INPUT_CLASS`, `Card`, `Toolbar`, `Badge`, `useFlash` / `FlashMessage`, `ProgressBar`, `Segmented`, `DropZone` |
| `website/app/admin/icons.tsx` | Line icons for the tabs and chevrons |
| `website/app/admin/format.ts` | `slugify`, `formatBytes`, `formatDate` (backend timestamps are UTC without a zone), `formatDuration`, `formatElapsed`, `plural` |
| `website/app/admin/types.ts` | Shapes of the backend responses the page reads |
| `website/app/admin/LoginScreen.tsx` | The login form |
| `website/app/admin/DisplayTab.tsx` | The kiosk remote (below) |
| `website/app/admin/useDisplayControl.ts` | Long-polls the kiosk's state and replays it; `sendKeys`, `playingPreset` |
| `website/app/admin/PresetBrowser.tsx` | Searchable list of every milkdrop preset, to jump to one |
| `website/app/admin/GalleriesTab.tsx`, `GalleryCard.tsx` | Gallery list, reorder, new-gallery form; one gallery's card (edit form, photos panel) |
| `website/app/admin/GalleryForms.tsx` | `GalleryFields` (name/slug/description, shared by create, edit and upload) and `UploadOutcome` |
| `website/app/admin/galleryApi.ts` | `createGallery`, `uploadPhotos` (one file at a time, carrying on past failures), `ALL_GALLERIES_PATH` |
| `website/app/admin/UploadTab.tsx` | Photo and video upload |
| `website/app/admin/RsvpsTab.tsx` | RSVPs |
| `website/app/admin/PublicSquareTab.tsx` | Public Square moderation |
| `website/lib/useAdminAuth.ts` | The JWT in localStorage, shared with The Kitchen (each page passes its own storage key) |

### Auth

`useAdminAuth("adminToken")` keeps the JWT in localStorage under `adminToken` (The
Kitchen uses its own key, so the two logins are separate). An expired stored token is
dropped on load. Every request goes through the `AdminFetch` from `AdminFetchContext`;
a 401 from any endpoint logs the page out and shows the login form. Tokens last 30 days
(`JWT_EXPIRATION_MINUTES` on the backend).

### Adding a tab

Write a component that loads what it needs with `useAdminData` (or `useAdminFetch` +
`adminRequest` for writes), add it to `TABS` in `page.tsx` with a short label, a title and
an icon from `icons.tsx`. The bottom bar is a five-column grid, so a sixth tab needs that
changed too.

## Display Remote

Controls the display kiosk from anywhere, the same as pressing its keyboard. The screens
show exactly what they would if the key had been pressed at the laptop, because it goes
into the same key log (see `website/docs/DISPLAY.md`, "Keyboard Control").

**How a press gets there:** the page posts the keys to the website backend
(`POST /display-control/keys`, admin JWT), which holds them in memory. The surfcam agent
on displaytop long-polls the backend for them and adds them to its key log, and both
display pages replay that log as usual. Displaytop only makes outbound requests, so
nothing on it is exposed. Details: `pi/services/surfcam-agent/README.md` ("Remote control")
and `pi/docs/api/website-backend-api.md` ("Display Control").

**How the page knows what's on screen:** the agent pushes its whole key log to the
backend whenever it changes (local key presses included), and every 25 s as a heartbeat.
The page long-polls `GET /display-control/state` and replays the log through the display
page's own state machine (`replayControl` from `website/app/display/kioskControl.ts`,
with `CONTROL_CONFIG` from `displayConfig.ts`), then `describeDisplay` turns it into "Now
showing: La Jolla Shores, held". The rotation's position comes from the clock, so the
page uses the backend's clock (`now_ms` in each answer) rather than the phone's.

The remote's buttons:

| Button | Keys sent |
|--------|-----------|
| Previous / Next *thing* | `prev` / `next`: step one and hold there. Labelled with what they step right now: screen (slot), photo (while a photo's held), view (bpm mode) or preset (on milkdrop), from `stepTarget` |
| Back action | `backspace`: undo one step. Labelled with what it'd do (`backAction`): "Resume rotation", "Let presets move on", "Cycle views again", "Leave BPM", "Close the on-screen menu"; hidden on the standard rotation, where it does nothing |
| Standard rotation | `escape` |
| Each shortcut in "Show" (from `SHORTCUTS`) | `escape` then its key, so it means the same in every mode (in bpm mode the digits pick bpm views instead) |
| BPM views (only shown in bpm mode) | the view's digit; "cycle views" sends `b` |
| Beat earlier / later | `beat-earlier` / `beat-later`, which the agent forwards to the bpm agent like the `-` and `=` keys |
| A preset in "Milkdrop presets" | `preset-<n>`: jump to that preset and hold it, switching to BPM mode on milkdrop if needed. "Random" picks one at random |

**Milkdrop presets:** the section shows the preset playing (the kiosk page reports it to
its agent, which passes it up with the key log as `preset`) and a searchable list of
every preset (`PresetBrowser.tsx`). The list comes from loading the same preset packs the
kiosk uses, sorted the same way (`website/app/display/milkdropPresets.ts`), so a preset's
place in it is its `n`. The packs are ~450 KB gzipped, so they're only fetched when you tap
"Browse all presets". If the kiosk is running an older deploy with a different preset set,
the numbers can point at the wrong preset until its browsers reload. In BPM mode the
section moves up under the step buttons.

The button for what's on screen now is outlined orange (`isShortcutActive`, the same
check the kiosk's own menu uses).

**Online / offline:** the backend counts the kiosk online if the agent has checked in in
the last 60 s. While it's offline the buttons are disabled: a press is only kept for 30 s,
so one sent then would just be dropped. If it says offline, check displaytop is on and
the agent is running (`pi/docs/services/display-kiosk.md`, "Remote control").

The key log is reset when the overnight sleep starts (00:00), same as for the keyboard.
The agent stays up through the night, so a press sent while the screens are asleep is
still applied, and shows when they wake at 06:00.
