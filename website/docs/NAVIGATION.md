# Frog Home Button

`components/Navigation.tsx` is the pixel frog fixed over the top left corner of most pages
(`PageWrapper` adds it, and a few pages render it directly). It sits at `z-[9999]`, one above
the opium den player bar, so it and its overlay stay on top of everything.

## Behavior

- **Tap**: goes home (`/`).
- **Hold** (500 ms, `LONG_PRESS_MS` in `lib/useLongPress.ts`): opens `ShareQrOverlay`, a full
  screen QR code for the current page's full URL (`window.location.href`, query string
  included), with the link written out under it. Tap anywhere or press Escape to close.
  Meant for showing a friend a page in person: they scan it off your phone.

Holding doesn't also follow the link: once the hold fires, the click on release is swallowed.
The phone's own long-press menu and the iOS link preview are blocked (`onContextMenu`,
`-webkit-touch-callout: none`). Moving the finger more than 10 px cancels the hold, so a
scroll that starts on the frog doesn't trigger it. Works with a mouse too.

## QR generation

Done in the browser with the `qrcode` npm package, so there's no backend involved and it
works on the static export. The package is imported dynamically when the overlay opens,
so it isn't in every page's bundle. If generating fails, the overlay still shows the link.

## Reuse

`useLongPress(callback)` returns handlers to spread onto any element; it's not tied to the
frog.
