# Speaker Agent

All the house's sound plays through the big powered speakers, wired to displaytop's built-in 3.5mm
headphone jack. The speaker agent is the small service on displaytop that owns that jack. The
entrance song, trash reminder and house ghost run on fart-pi and ask it to play their clips over
the LAN. Code: `pi/services/speaker-agent/`.

## How it works

- **Clips are stored on displaytop** in `~/speaker-agent/clips/`, named by their sha256. Playback
  reads from there, so the Wi-Fi only matters for starting and stopping a clip.
- **Clips upload themselves.** Services keep their wavs on fart-pi. Playing one the agent doesn't
  have gets a 404, so the service uploads it and tries again. A changed file has a new hash, so
  it's picked up by itself. Old clips stay on disk until someone deletes them, which is safe.
- **One clip at a time.** Anything else is refused with a 409 while one's playing. Each clip has
  an owner (`entrance`, `trash-reminder`, `house-ghost`) and only its owner can stop it.
- **Volume**: on startup the agent sets the laptop's `Master` and `Headphone` to 100%, so the big
  speakers' knob is the only volume control. The knob sets the level for everything, trash siren
  included.
- **Laptop speakers**: stay silent while a cable's in the jack, through the codec's auto-mute. If
  the cable's pulled, clips play on the laptop's own speakers instead.
- **If displaytop is off** there's no sound at all. Nothing falls back to the little I2S speakers
  on fart-pi. The services log the failure and carry on.

The ALSA device is `plughw:CARD=PCH,DEV=0`, by name because the USB mic can shift card numbers.

## HTTP API

Port **8771**, all interfaces, no auth. It's LAN only, since the router forwards nothing to the
laptop. The address fart-pi uses is `SPEAKER_AGENT_URL`, in `speaker_client.py` for the systemd
services and `app/config.py` for the backend.

| Request | Response |
|---|---|
| `GET /status` | `{"playing": bool, "owner": str \| null, "clip": str \| null, "position_ms": int}` |
| `PUT /clips/<sha256>` | Stores the wav in the body. 201, or 400 if it doesn't match the hash, 413 if over 64 MB |
| `POST /play/<owner>/<sha256>` | Starts it and answers with the status. 404 if not stored, 409 if busy, 500 if `aplay` failed. With `?wait=1` it answers when the clip ends |
| `POST /stop/<owner>` | Stops the clip if that owner's playing. 200 with the status either way |

Fart-pi's systemd services call it through `speaker_client.py`, which they import from this folder
in the repo. The backend runs in Docker and can't see that folder, so it makes the same calls with
httpx in `app/entrance.py`.

## Install and update

From the repo root. Stored clips are kept:

```bash
scp -r pi/services/speaker-agent tyler@192.168.1.192:~/setup/
ssh tyler@192.168.1.192 "sudo bash ~/setup/speaker-agent/install.sh"
```

It's a systemd service independent of the kiosk's X session, so it stays up when the screens are
asleep or the browsers restart. `setup-displaytop.sh` runs the same install on a rebuild.

## Troubleshooting

```bash
ssh tyler@192.168.1.192 "systemctl status speaker-agent --no-pager"
ssh tyler@192.168.1.192 "journalctl -u speaker-agent -n 30 --no-pager"
ssh tyler@192.168.1.192 "curl -s localhost:8771/status"
ssh tyler@192.168.1.192 "amixer -c PCH cget iface=CARD,name='Headphone Jack' | grep values"   # on = cable detected
```

- **Silence, but the status says playing**: check the speakers' power, knob and input, and that the
  jack reads `on`.
- **Busy, with nothing else playing**: another program on the laptop has the sound card. Check with
  `fuser -v /dev/snd/*`.
