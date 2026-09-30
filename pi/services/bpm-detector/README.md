# BPM Detector

Raspberry Pi service that listens to a USB mic on fart-pi and estimates the
tempo (BPM) of ambient music, for the planned BPM audio visualizer display
panel (see `website/docs/DISPLAY.md`).

## How it works

Streams raw audio from the mic via `arecord`, compares each ~23ms chunk's
energy against a rolling local average, and treats a chunk that spikes above
the average as a beat (subject to a debounce window so one hit doesn't
double-trigger). BPM is the median of the last few inter-beat intervals.

This is a simple energy-based detector, not a full onset/tempo-tracking
library -- `aubio` was tried first but its last release (2018) doesn't build
against any numpy/gcc combination available on Python 3.13, so this was
written from scratch instead. Works best on music with a clear, percussive
beat (most dance/pop/rock); quiet or beat-less music will report no signal.

**Known limitation, not yet resolved:** tested against a synthetic 120 BPM
click track played through fart-pi's own speakers and picked up by the mic
(acoustic loopback, not a direct feed). Room echo/reverb off a single click
can itself cross the beat threshold a fraction of a second later, producing
occasional doubled or fractional BPM readings (e.g. 160 or 240 instead of
120) rather than a clean, stable estimate. `MIN_BEAT_INTERVAL_S` and
`BEAT_THRESHOLD_MULTIPLIER` will likely need further tuning against real
music (continuous ambient loudness, not near-silence between clicks) before
this is reliable enough to run as an always-on systemd service. Not yet
installed as a service for that reason -- run it manually per "Running"
below until the detection is solid.

## Configuration

Tunable constants in `main.py`:

| Constant | Default | Description |
|---|---|---|
| `ALSA_DEVICE` | `plughw:3,0` | USB mic device -- verify with `arecord -l` if it ever changes |
| `BEAT_THRESHOLD_MULTIPLIER` | `1.4` | How far above the local average energy counts as a beat |
| `MIN_BEAT_INTERVAL_S` | `0.25` | Debounce window (caps detection at 240 BPM) |
| `STALE_THRESHOLD_S` | `3.0` | How long without a beat before reporting "no signal" |

## Output

Writes `state/bpm_state.json` on every detected beat (and once more when the
signal goes stale):

```json
{"bpm": 122.4, "updated_at": 1735689600.123}
```

`bpm` is `null` when there's no recent beat (silence, or music without a
clear beat). `updated_at` is a Unix timestamp -- a consumer can use it to
tell a genuinely stale state apart from "just hasn't updated yet."

This directory is bind-mounted read-only into the website-backend container
so its `/bpm` endpoint can serve the same state to the display panel (see
`pi/docs/api/website-backend-api.md`).

## Running

```bash
cd ~/tyler-schwenk.github.io/pi/services/bpm-detector
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
python main.py
```

## Running as a systemd service

```bash
sudo cp bpm-detector.service /etc/systemd/system/
sudo systemctl enable bpm-detector
sudo systemctl start bpm-detector
sudo journalctl -u bpm-detector -f
```
