# Disco December Invite

## Overview

`/events/disco` is the invite for Disco December. Letters go out with a link to it. Opening
it plays the invite video full screen. At the end the video's hand-drawn clouds take over
as a looping animation, part down the middle, and show the flier underneath. The flier has
a button that saves the event info as an image.

The page has its own route (`app/events/disco/`), which takes priority over the generic
`[slug]` event page. The title, date and location still come from the `disco` entry in
`app/events/data.ts`, so they only live in one place.

## Sequence

The stages live in `DiscoInvite.tsx`:

| Stage | What's on screen | Moves on when |
|-------|------------------|---------------|
| `waiting` | Cloud loop. Phones held upright also get "turn your phone sideways" | The device is known and isn't an upright phone. Then it tries to autoplay |
| `tap` | Cloud loop with an "open your invite" button | Tapped. Used when the browser blocks autoplay with sound |
| `playing` | The invite video, with a small skip button | The video ends, or skip goes straight to `parting` |
| `clouds` | Cloud loop, held for `PART_DELAY_MS` | The timer runs out |
| `parting` | The clouds split and slide apart over the flier (`PART_DURATION_MS`) | They're fully off screen |
| `flier` | The flier | "Watch again" replays the video from the top |

- **Device detection**: `useInviteDevice` treats `(pointer: coarse) and (hover: none)` as
  mobile and watches `(orientation: portrait)`. Desktops never get the rotate prompt.
  Rotating an upright phone to landscape starts the video on its own.
- **Autoplay**: video with sound only autoplays if the browser allows it (Chrome allows it
  after some engagement with the site; iOS needs a tap). If `play()` is rejected, the page
  falls back to the tap button. The rotate prompt can't count as the tap, since rotating
  isn't a user gesture.
- **Video choice**: phones get the 720p file and desktops the 1080p one.
- If the invite video fails to load, it skips straight to the flier and logs why.

## The cloud handoff

The video's last shot is a 4:3 hand-drawn cloud "boil" with black bars on either side,
drawn on twos/threes (~10 drawings a second), fading to black at the very end. Frames
57.62 s to 58.59 s (30 frames) loop seamlessly: the drawing at 58.62 s is the same as the
first one in the loop.

- At `CLOUD_HANDOFF_S` (58.61 s) the curtain (`CloudCurtain`) rises over the video,
  showing frame 0 of the loop. The timing is checked every frame with
  `requestVideoFrameCallback`, falling back to `requestAnimationFrame`.
- The curtain starts at exactly the size of the video's pillarboxed 4:3 picture
  (`--start-scale`, worked out from the stage size), so the swap doesn't show. It then
  grows to fill the screen.
- The video keeps playing underneath because its audio runs to the end.
- **Parting** (`cloudSeam.ts`): the loop is drawn into a canvas in two halves. Each half is
  clipped along a scalloped seam with puffs of uneven sizes, inked to match the drawing, and
  slides out to its side while zooming slightly. Under `prefers-reduced-motion` it skips
  straight to the flier.

## The flier

Placeholder content in the video's style. It'll get the real copy and layout once those
are settled.

- **Type**: Ultra (Google Fonts, `--font-disco` in the root layout). It's the closest match
  to the video's fat ball-terminal slab serif.
- **Colors** (`constants.ts`): letters cycle through the video's six-color palette.
  `DiscoText` gives each letter its own color, pops the letters in out of order, then
  chases the colors along the line. Ornament lime, blue and teal are for the box row and
  diamond row. The night sky colors come from the video's space scene. All of these are set
  as CSS variables on the stage, so the stylesheet and the canvas card share one source.
- **Moving parts** (`Ornaments.tsx`): a spinning disco ball (sliding mirror tiles under
  fixed shading), rotating light beams, a light chasing along the box row, twinkling
  diamonds and stars. Star positions are seeded, so the prerendered HTML matches the
  browser. Everything holds still under `prefers-reduced-motion`.

## Saving the info

`saveFlierCard.ts` draws a 1080x1350 PNG on a canvas by hand. It has the same sky, stars,
ornaments, colored title, date, location, highlights and page address as the flier. It's
drawn rather than screenshotted so it looks the same everywhere and needs no library.

- The card is drawn when the flier mounts, not on tap. iOS only opens the share sheet
  straight after a tap, and drawing it then (font load plus PNG encode) can use up that
  window.
- On phones, "Save the info" opens the share sheet (`navigator.share` with the file). From
  there, "Save Image" puts it in photos. On desktops, or anywhere without file sharing,
  it downloads `disco-december.png`.

## Media

All in `website/public/video/disco/`, made from the source edit (`Disco December Invite
V1_1.mp4`, 1920x1080, 29.97 fps, 60 s) with ffmpeg:

| File | What | Made with |
|------|------|-----------|
| `invite-1080.mp4` | Desktop video, ~28 MB | `-c:v libx264 -preset slow -crf 23 -vf scale=1920:1080 -c:a aac -b:a 160k -movflags +faststart` |
| `invite-720.mp4` | Phone video, ~15 MB | Same, with `scale=1280:720` |
| `clouds-loop.mp4` / `.webm` | The 30-frame cloud loop, 1440x1080, no audio | `-ss 57.45 -t 1.6`, then `crop=1440:1080:240:0,select='between(n\,5\,34)'`; x264 crf 20 / vp9 crf 32 |
| `clouds-poster.jpg` | First frame of the loop, the poster before it plays | |

The link preview is `website/public/images/events/disco-og.jpg`, the "Disco Night is Back!"
title card at 18.5 s.

If the video is re-edited, the handoff has to be found again. Step through the final cloud
shot, find a stretch where a drawing comes back around, and compare candidate frames with
ffmpeg's `ssim` filter. A held drawing scores ~0.99 against itself, a repeat of a drawing
~0.88, and neighbouring drawings ~0.5-0.6. Re-cut the loop, then set `CLOUD_HANDOFF_S` to
the time of the repeated frame.

## Files

| File | Purpose |
|------|---------|
| `website/app/events/disco/page.tsx` | The route and its metadata |
| `website/components/disco/DiscoInvite.tsx` | The stage machine, video, prompts |
| `website/components/disco/CloudLoop.tsx` | The looping cloud background video |
| `website/components/disco/CloudCurtain.tsx` | The clouds over the flier: handoff, growth, parting |
| `website/components/disco/cloudSeam.ts` | Canvas drawing for the parting |
| `website/components/disco/DiscoFlier.tsx` | The flier and its save button |
| `website/components/disco/DiscoText.tsx` | Per-letter colored text |
| `website/components/disco/Ornaments.tsx` | Box row, diamond row, stars, disco ball |
| `website/components/disco/saveFlierCard.ts` | Draws and shares or downloads the PNG |
| `website/components/disco/useInviteDevice.ts` | Mobile and orientation detection |
| `website/components/disco/constants.ts` | Media paths, timing, palette, flier lines |
| `website/components/disco/disco.module.css` | All of the invite's styles |
