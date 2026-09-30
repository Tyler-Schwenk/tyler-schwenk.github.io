# Display Page Documentation

## Overview

`/display` is a full-screen kiosk page, not a normal site page — it has no navigation
or footer and isn't linked from anywhere on the public site. It's meant to be opened in
a kiosk browser on a dedicated monitor (see `pi/docs/services/display-kiosk.md` for the
Raspberry Pi that runs it) and rotates through a fixed list of "panels," each a
self-contained view.

Only the currently-active panel is mounted. Switching panels unmounts the previous one,
so its polling/timers stop automatically — an inactive panel costs nothing.

---

## Architecture

### Files

| File | Purpose |
|------|---------|
| `website/app/display/page.tsx` | Rotation controller — cycles through `PANELS` every `PANEL_ROTATE_INTERVAL_MS` |
| `website/app/display/PhotoPanel.tsx` | Full-bleed rotating slideshow of every public gallery's photos |
| `website/app/display/MallardPanel.tsx` | Current mallard count with a canvas-animated duck background |
| `website/app/display/PlaceholderPanel.tsx` | Generic "Coming Soon: {name}" stand-in, reused as new panels get built |

### Adding a Panel

1. Build the panel as its own component in `website/app/display/`, following
   `MallardPanel.tsx` as a template: fetch its own data, manage its own polling, render
   `fixed inset-0` full-bleed.
2. Add it to the `PANELS` array in `page.tsx`.

Panels not yet built are listed in a comment at the top of `page.tsx` rather than kept
in the active rotation with `PlaceholderPanel` — add a panel to `PANELS` (optionally
with `PlaceholderPanel` first as a stub) once it's actually being worked on.

### Planned Panels (not yet built)

- MTS trolley info
- Surf cam
- Pac-Tyler bike map
- BPM audio visualizer — a separate Raspberry Pi listens via mic, detects the BPM of
  whatever's playing, and this panel shows a visual synced to it
- Server status (Beszel) — blocked on Beszel having no public/read-only API access
  (confirmed: the anonymous `systems` records endpoint returns zero items even though
  it responds 200). Needs either a persistent authenticated Chromium session (simple,
  but the login session will eventually expire) or a server-side proxy endpoint on
  website-backend holding a Beszel service token (more durable, matches how the rest
  of the backend handles secrets — preferred if there's time to build it properly)

## Mallard Count

`MallardPanel.tsx` fetches from `${API_BASE}/mallard-count`, which is a
website-backend endpoint (`pi/services/website-backend/app/routers/mallard.py`) that
proxies `api.traderoutes.cards` server-side. That external API doesn't send CORS
headers, so a direct browser fetch from `tyler-schwenk.com` is silently blocked —
routing it through our own backend sidesteps the problem since server-to-server
requests aren't subject to browser CORS rules.

## Hardware Constraints

This page runs on a Raspberry Pi 3 B+ with 1 GB of RAM (see
`pi/docs/services/display-kiosk.md`), which is not a lot for a full browser plus
animation. Any panel that animates many elements should follow the pattern established
in `MallardPanel.tsx`: draw on a single `<canvas>` with one `requestAnimationFrame`
loop rather than many independently CSS-animated DOM nodes, pre-render repeated images
once to an offscreen canvas instead of redrawing them every frame, and cap how many
elements actually render/animate regardless of the "real" underlying number.
