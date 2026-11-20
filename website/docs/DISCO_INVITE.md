# Disco December Invite

## Overview

`/events/disco` is the invite for Disco December. Letters go out with a link to it. Opening
it plays the invite video full screen. At the end the video's hand-drawn clouds take over
as a looping animation, part down the middle, and show the flier underneath. The flier has
a button that saves the event info as an image.

The page has its own route (`app/events/disco/`), which takes priority over the generic
`[slug]` event page. The title comes from the `disco` entry in `app/events/data.ts`. The
flier's own details (date, time, address, lineup, attire) are in `DISCO_DETAILS` in
`constants.ts`. The events list's `dateText` and `locationText` repeat the date and
address, so change both places together.

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
- The video keeps playing underneath (muted once the music takes over) until it ends.
- **Parting** (`cloudSeam.ts`): the loop is drawn into a canvas in two halves. Each half is
  clipped along a scalloped seam with puffs of uneven sizes, inked to match the drawing, and
  slides out to its side while zooming slightly. Under `prefers-reduced-motion` it skips
  straight to the flier.

## The music

The video's soundtrack is Get Down Tonight, and the song plays on under the flier
(`useDiscoMusic.ts`, settings in `MUSIC` in `constants.ts`).

- `music.mp3` is the song trimmed to start where the video's audio does (17.683 s into
  the track), so a time on the video is the same time in the file.
- At `MUSIC_HANDOFF_S` (58.2 s), just before the video fades its own sound out (from about
  58.4 s), the music starts at the video's current time and the video is muted in the same
  tick. It's the same audio in sync, so the swap doesn't show. Skip does the same from
  wherever the video was. "Watch again" stops the music.
- It plays on through the rest of the song, then loops an 8 bar stretch of the outro vamp
  (`loopStartS` to `loopEndS`), easing down to `loopGain` over the `loopFadeS` before the
  first loop. It's Web Audio (`AudioBufferSourceNode` with `loopStart`/`loopEnd`), since only
  that loops without a gap. The file ends at the loop's end, and its last 60 ms are blended
  into the 60 ms before the loop's start, so the jump back is seamless.
- The audio context is created and resumed from the same call that starts the video (the tap,
  or the autoplay attempt), and the song is decoded while the video plays. If either isn't
  ready by the handoff, the video keeps its own sound and fades out as before.
- iOS mutes Web Audio with the ringer switch, so it sets `navigator.audioSession.type` to
  `"playback"` where Safari has it (17+).
- It pauses while the tab's hidden. A "sound off" button sits in the corner over the flier.

The loop was found by beat tracking the song (about 112 bpm) and comparing beat-by-beat
spectra for spots 8 bars apart, then checking the onset timing of the beats around both
ends. A raw waveform match doesn't work, since it's a live band and no two bars are sample
identical. If the song file's ever re-cut, the loop points move with it.

## The flier

The flier has two parts:

1. **The poster** fills exactly the first screen, so one screenshot gets all the main
   info. A "more info" hint sits under it and scrolls down when tapped.
2. **More info** below it: the longer details from `DISCO_MORE_INFO` in `constants.ts`
   (an array of headings, each with an optional line of text, so add entries there), then the save and watch again buttons.

**Fitting the screen**: `.flier` is the scroller and fills the visible viewport, so
`.posterScreen` at `height: 100%` is one visible screen even with phone browser bars.
Everything inside the poster is sized in one design unit, `--u`. That's 1% of the
poster's width, unless the screen is too short for the whole design (about 180 units
tall), in which case it shrinks to fit the height. Rows are spread with
`align-content: space-evenly`, so taller phones get more breathing room, not bigger type.
On wide screens the poster is capped at letter-paper proportions (0.78 wide per unit of
height) so it stays flier-shaped. If you add something to the poster, size it in `--u`
and check a short phone (375x553) still fits.

It's laid out like an old disco flier rather than a centered stack: a framed poster
(double rule border) with blocks pushed to either side. Behind them is the stage from the
Snoopy clips in the video: a light-up dance floor, sweeping spotlights and white sparkle
bursts. The grid in `.poster` places, top to bottom:

| Area | What |
|------|------|
| `title` | Tilted title, one word per line, the first big and the rest indented, over racing stripes |
| `boxes` | The box row on the left, with the disco ball at its right end. The ball's string runs up past the title to the frame's top edge (the poster clips it) |
| `feat` / `attire` | Lineup on the left, straight on the background with a dark halo round the words; on the right, the round dance floor clip with the dress code over a light shade on its lower half |
| `facts` | Date, time and place, script labels with slab values, all left aligned |
| `phones` | The no-phones stamp, tilted |

- **Type**: Ultra (`--font-disco`) is the closest match to the video's fat ball-terminal
  slab serif, used for the title and values. Shrikhand (`--font-disco-script`) is the
  brush script for labels ("Featuring:", "Date:"), like the mixed type on the inspiration
  fliers. Both are in the root layout.
- **Lineup**: the two acts are styled as opposites. "Dancefloor DJs" is loud: hot pink
  Ultra with the title's lime drop shadow, bouncing on a beat. "Ambient Den" is calm: the
  kiln page's light Instrument Serif (`--font-kiln-display`) in italic, pale lavender and
  spaced out, with a slow breathing glow.
- **Colors** (`constants.ts`): letters cycle through the video's six-color palette.
  `DiscoText` gives each letter its own color, pops the letters in out of order, then
  chases the colors along the line. The title gets a hard lime drop shadow. Ornament lime, blue and teal are for
  the box row. The dance floor's pink, grout and tile light colors are their
  own constants (`FLOOR_*`), taken from the Snoopy floor. The night sky colors come from
  the video's space scene. All of these are set as CSS variables on the stage, so the
  stylesheet and the canvas card share one source.
- **Moving parts** (`Ornaments.tsx`): blocks rise in one after another (`--rise-delay`),
  the stripes streak in then drift, the disco ball spins and throws beams, the box row
  chases, the spotlights sweep, the sparkle bursts flash, the dance floor's tiles blink,
  and the attire clip loops and bobs. Everything holds still under `prefers-reduced-motion`.
- **The dance floor** (`DanceFloor`): covers the bottom half of the poster. It's a grid
  of tiles (40 wide, 26 deep), much wider than the poster because the far end shrinks
  toward the horizon. It's tipped back with a 3D `rotateX` under `perspective`, so it runs
  off to a hazy horizon. Plain tiles and grout are just the plane's background; only the
  lit tiles (about 22%) are elements. Each lit tile blinks its color on a 1.2, 1.8 or 2.4 s
  beat with its own offset, so the floor never blinks in step. Which tiles light, and the
  background star dots, are seeded, so the prerendered HTML matches the browser. It's dimmed
  to 60%, and the facts and stamp over it get a dark halo so they stay readable.
- **Dancers** (`Dancers` in `Ornaments.tsx`, placed by `DANCERS` in `constants.ts`): the
  kids from the Snoopy dance scene (Schroeder, Snoopy, Sally, Linus, Shermy and the girl
  with her head thrown back), each cut out of the video and looping its own dance. They
  stand on the floor over the tiles and under the words, smaller further back. Each is an
  animated webp with a transparent background; under reduced motion a `<picture>` source
  swaps it for a still png.
- **Attire clip** (`AttireClip.tsx`): archival 70s dance floor footage in a lime-ringed
  circle, three clips crossfaded into one silent loop. It's wider than its column, spilling
  left under the lineup; the lineup sits in front in case a long act name reaches it. Under reduced motion it's paused on its
  first frame.
- **Address**: links to the person's own maps app (`useMapsUrl.ts`). Apple devices get an
  Apple Maps link, Android a `geo:` link that opens the default maps app, and everything
  else Google Maps. It goes by user agent, since there's no feature check for "default maps
  app". The prerendered HTML has the Google Maps link until it hydrates.

## Saving the info

`saveFlierCard.ts` draws a 1080x1350 PNG on a canvas by hand. It leaves out the more info
section. It has the same sky, stars,
box and diamond rows, colored title, details and page address as the flier, but in the
older centered layout. It'll be redrawn to match the poster once the design is final.
It's drawn rather than screenshotted so it looks the same everywhere and needs no library.

- **Font loading**: it waits for the disco font before drawing, but only loads the first
  family in `--font-disco`. next/font's "Ultra Fallback" face points at a local Times New
  Roman, and on a device without that font, `document.fonts.load` rejects the whole load
  (NetworkError). If the disco font itself won't load, it logs a warning and still draws the
  card in a fallback font.
- The card is drawn when the flier mounts, not on tap. iOS only opens the share sheet
  straight after a tap, and drawing it then (font load plus PNG encode) can use up that
  window.
- On phones, "Save the info" opens the share sheet (`navigator.share` with the file). From
  there, "Save Image" puts it in photos. On desktops, or anywhere without file sharing,
  it downloads `disco-december.png`.

## Media

All in `website/public/video/disco/`, made from the source edit (`Disco December Invite
V2.mp4`, gitignored in the repo root, 1920x1080, 29.97 fps, 60 s) with ffmpeg:

| File | What | Made with |
|------|------|-----------|
| `invite-1080.mp4` | Desktop video, ~28 MB | `-c:v libx264 -preset slow -crf 23 -vf scale=1920:1080 -c:a aac -b:a 160k -movflags +faststart` |
| `invite-720.mp4` | Phone video, ~15 MB | Same, with `scale=1280:720` |
| `clouds-loop.mp4` / `.webm` | The 30-frame cloud loop, 1440x1080, no audio | `-ss 57.45 -t 1.6`, then `crop=1440:1080:240:0,select='between(n\,5\,34)'`; x264 crf 20 / vp9 crf 32 |
| `clouds-poster.jpg` | First frame of the loop, the poster before it plays | |
| `attire.mp4` / `.webm` / `.jpg` | The attire clip, 360x360, 15.75 s, ~700 KB, no audio, plus its still | From `attire1..3.mp4` (gitignored sources in the repo root). Each is cropped to a square clear of the station logo in the top right (`crop=ih:ih:120:0`; `crop=1400:1400:150:50` for clip 2, to drop a black bar at the top), then `scale=360:360,fps=24`. They're joined with 0.4 s `xfade` fades; x264 crf 27 / vp9 crf 38 |

The dancers are in `website/public/video/disco/dancers/` (`<name>.webp` loop, `<name>.png`
still, 180px tall). They're cut from a 720x480 copy of the Charlie Brown Christmas dance
scene. For each kid, the loop is found by matching frames one dance cycle apart inside a
clean stretch of one shot. Each frame is matted by keying out the pink backdrop reachable
from the crop's edge, since the black outlines close off the faces. On the wood floor
shots, the floorboard lines are peeled off as long thin strokes at the floor's angle.
Small loose specks are then dropped. Some floorboard stubs remain near feet.

The link preview is `website/public/images/events/disco-og.jpg`, the "Disco Night is Back!"
title card at 18.5 s, scaled to 1200 wide and center cropped to 1200x630 (`scale=1200:-2,crop=1200:630`).

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
| `website/components/disco/Ornaments.tsx` | Box row, star dots, disco ball, dance floor, spotlights, sparkle bursts, no-phone icon |
| `website/components/disco/AttireClip.tsx` | The round dance floor clip by the attire line |
| `website/components/disco/saveFlierCard.ts` | Draws and shares or downloads the PNG |
| `website/components/disco/useInviteDevice.ts` | Mobile and orientation detection |
| `website/components/disco/useDiscoMusic.ts` | Plays the song on past the video and loops its outro |
| `website/components/disco/useMapsUrl.ts` | The address link for this device's maps app |
| `website/components/disco/constants.ts` | Media paths, timing, palette, flier details |
| `website/components/disco/disco.module.css` | All of the invite's styles |
