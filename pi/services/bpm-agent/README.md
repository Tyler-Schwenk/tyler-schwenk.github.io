# BPM Agent

Runs on displaytop (the display kiosk laptop, see `pi/docs/services/display-kiosk.md`).
It listens to the USB mic, finds the beat of whatever's playing in the room, and streams
it to the `/display` page's BPM visualizer (see `website/docs/DISPLAY.md`).

It runs on the kiosk itself rather than a server so the page reads the beat over
localhost on the same clock: a beat time from the agent is directly comparable to the
page's `Date.now()`, with no network delay or jitter in between.

The mic only records while the BPM view is on screen. The agent's HTTP server is always
up (started by `kiosk-run.sh`), but it only starts `arecord` when a page opens
`/stream`, and stops it `CAPTURE_IDLE_GRACE_S` (5 s) after the last page closes it.

## Files

| File | Purpose |
|---|---|
| `bpm_agent.py` | HTTP server, mic capture (`arecord`), start/stop with the pages, calibration offset |
| `beat_tracker.py` | The DSP: spectrum bands, bass onset curve, tempo and beat phase. Pure numpy, no I/O |
| `calibration.json` | Created on the kiosk the first time the offset is nudged: `{"offset_ms": -40}` |

Dependencies are just `python3-numpy` and `alsa-utils` from apt (installed by
`setup-displaytop.sh`). No venv or pip needed.

## How the beat is found

Audio is analysed in hops of 512 samples at 44.1 kHz (~86 frames a second), each with a
2048-sample FFT:

1. **Onsets**: the log-compressed spectral flux of the 40-200 Hz band (kick drum and
   bass), meaning how much louder that band just got. The kick carries the beat far more
   reliably than broadband energy, which picks up hi-hats and vocals at the wrong rate.
2. **Tempo**: every 0.25 s, the last 8 s of onsets are autocorrelated and every tempo
   from 60 to 200 BPM is scored by how well the onsets repeat one beat and two beats
   later. A broad prior around 120 BPM settles a tempo vs its double/half when both fit.
   A new tempo has to persist for a second before the reported tempo jumps to it. Small
   changes are eased in.
3. **Phase**: a comb of beat-spaced teeth is slid back over the recent onsets, and the
   alignment that lands on the most onset energy gives the latest beat.
4. **Beat clock**: a small phase-locked loop runs at the tempo and nudges its phase 30%
   of the way toward each measurement. Measurements more than a quarter beat off are
   ignored unless four in a row agree, so one sloppy onset or an off-beat doesn't make
   the visuals jump.

No tempo is reported when the room is quieter than `SILENCE_DB` (-55 dBFS averaged over
1.5 s) or no tempo stands out (`MIN_CONFIDENCE`).

**Known limit:** half/double tempo is a guess when the music fits both, the classic hard
case for any beat tracker. 174 BPM drum and bass reads as 87, for example. The pulses
still land on beats, just every other one. The calibration view's tempo scores show both
peaks when this happens.

Frame times come from counting samples, anchored to the wall clock and eased toward it
slowly, so pipe jitter averages out and the sound card's clock can't drift away from the
system clock.

## Calibration

The **offset** covers the fixed delay between a beat in the room and its pulse on screen
(audio buffering, the FFT window, the onset peak's lag, screen latency). It's added to
every beat time the agent sends. Set it once for a given mic and speaker placement:

1. Press `b` for the BPM view, then `b` again for calibration.
2. Play a click track (any metronome at, say, 120 BPM) through the speakers.
3. Press `-` / `=` to move the beat flash earlier/later in 10 ms steps until it lands on
   the click. Each press is saved to `calibration.json` straight away.

The keys only work while the BPM view is up (the agent answers 409 otherwise), so a
stray press during the normal rotation changes nothing.

The calibration view also shows what to tune if the beat isn't found at all:

- **Level meter**: if the green bar sits below the red silence line while music plays,
  the mic is too far away or too quiet. Move it closer, raise the gain
  (`amixer -c <card> sset Mic 100%`), or lower `SILENCE_DB` in `beat_tracker.py`
- **Spectrogram**: the dashed lines mark the beat band. A kick drum shows as regular
  bright blips between them
- **Onsets**: the white curve should spike on every kick, and the yellow ticks (detected
  beats, before the offset) should sit on the spikes

## API

Listens on `127.0.0.1:8766` only. CORS allows `https://tyler-schwenk.com` (the display
page), including Chrome's private network access preflight.

| Route | Does |
|---|---|
| `GET /stream` | Server-sent events (below). Opening it starts the mic |
| `POST /offset/earlier` | Offset -10 ms (the `-` key). 409 unless listening |
| `POST /offset/later` | Offset +10 ms (the `=` key). 409 unless listening |
| `GET /status` | `{"listening": bool, "pages": int, "offset_ms": int}` |

### Stream events

`config`, once per connection:

```json
{"band_edges_hz": [40.0, 43.6, "...65 edges..."], "onset_min_hz": 40.0, "onset_max_hz": 200.0,
 "frame_rate_hz": 86.13, "silence_db": -55.0, "curve_min_bpm": 60, "curve_step_bpm": 1}
```

`frame`, every hop (~86/s):

```json
{"t_ms": 1790983472509.9, "bands": [0, 12, "...64 levels 0-255, low to high..."], "onset": 1.234, "level_db": -23.4}
```

`tempo`, every 0.25 s (the latest one is also sent straight away to a new page):

```json
{"bpm": 128.2, "confidence": 0.75, "beat_ms": 1790983472509.9, "period_ms": 468.01,
 "offset_ms": -40, "level_db": -22.3, "curve": [0.0, 0.04, "...one score per bpm, max 1..."]}
```

`beat_ms` is a beat as the screen should show it (offset applied). Beats fall every
`period_ms` before and after it. `bpm`, `beat_ms` and `period_ms` are null with no beat.

`error`, when the mic can't be used: `{"message": "no usb mic found ..."}`. The agent
then closes the stream, and the page's `EventSource` reconnects every 3 s, which retries.

## Mic

The USB mic (TI PCM2902 codec, "USB PnP Sound Device") is plugged into the USB-C
adapter's hub next to the HDMI output. The agent finds it by looking for a capture card
with `USB` in its name in `arecord -l`, so the card number doesn't matter. To check it
by hand (stop the agent first, since only one recorder can hold the mic):

```bash
arecord -l
arecord -D plughw:1,0 -f S16_LE -r 44100 -c 1 -d 5 /tmp/test.wav   # card number from arecord -l
```

## Running and troubleshooting

`kiosk-run.sh` starts the agent and restarts it if it dies, logging to
`/tmp/bpm-agent.log`. After changing the code, copy it over and restart it:

```bash
scp pi/services/bpm-agent/*.py tyler@192.168.1.192:~/bpm-agent/
ssh tyler@192.168.1.192 'pkill -f "[b]pm_agent.py"'   # kiosk-run.sh brings it back
```

On the kiosk:

```bash
curl -s 127.0.0.1:8766/status                 # listening / pages / offset
timeout 3 curl -sN 127.0.0.1:8766/stream | grep -A1 "event: tempo"   # live tempo, starts the mic
tail -f /tmp/bpm-agent.log
```

To test the tracker away from the kiosk, feed `BeatTracker.process` hops of a synthetic
click track (int16 numpy arrays of `HOP_SAMPLES`) with increasing timestamps, and call
`estimate()` every ~22 hops.
