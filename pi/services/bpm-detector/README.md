# BPM Detector

Raspberry Pi service that listens to a USB mic on fart-pi and estimates the
tempo (BPM) of ambient music, for the planned BPM audio visualizer display
panel (see `website/docs/DISPLAY.md`).

## How it works

Streams raw audio from the mic via `arecord` into a rolling buffer (last
`BUFFER_DURATION_S` seconds), then every `ANALYSIS_INTERVAL_S` runs it
through `librosa`: a bass-focused onset strength envelope (restricted to
`ONSET_FMIN_HZ`-`ONSET_FMAX_HZ`, since the kick/bass carries the beat far
more reliably than broadband energy, which picks up hi-hats/vocals/cymbals
at the wrong rate) feeds librosa's autocorrelation-based tempo estimator.

Each estimate's tempo prior is centered on the previous accepted BPM
(`start_bpm`), which gives continuity between windows and damps octave
errors -- locking onto 2x or 0.5x the real tempo, a known hard problem in
all beat trackers. It doesn't eliminate octave errors outright (nothing
does), just makes a stable wrong-octave lock less likely than analyzing
each window from scratch.

Two earlier approaches didn't work out: `aubio` (a purpose-built C library)
doesn't build against any numpy/gcc combination available on Python 3.13.
A from-scratch energy-threshold detector (broadband, edge-triggered on a
rolling average) ran fine but was too easily confused by room echo and
non-bass transients -- see git history for both attempts.

## Configuration

Tunable constants in `main.py`:

| Constant | Default | Description |
|---|---|---|
| `ALSA_DEVICE` | `plughw:3,0` | USB mic device -- verify with `arecord -l` if it ever changes |
| `BUFFER_DURATION_S` | `8.0` | How much recent audio each estimate is based on |
| `ANALYSIS_INTERVAL_S` | `2.0` | How often to re-analyze the buffer |
| `SILENCE_RMS_THRESHOLD` | `800` | Below this RMS, report no signal instead of a meaningless guess -- needs tuning against the real room/speaker volume |
| `ONSET_FMIN_HZ` / `ONSET_FMAX_HZ` | `20` / `150` | Frequency band used for onset detection (bass/kick range) |
| `TEMPO_PRIOR_STD_BPM` | `2.0` | How tightly each estimate is pulled toward the previous one -- lower damps jitter/octave-flips harder but responds slower to a real tempo change |
| `MAX_TEMPO_BPM` | `200.0` | Upper bound on estimated tempo |

## Output

Writes `state/bpm_state.json` roughly every `ANALYSIS_INTERVAL_S` seconds:

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
