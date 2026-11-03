# Entrance Song

A button on the admin page (`/admin#entrance`) plays an intro song through the big speakers and
shows a countdown to the drop, so you can start it, wait outside, and open the door on the drop.
Code: `pi/services/website-backend/app/entrance.py` and `website/app/admin/EntranceTab.tsx`.

## The song's timeline

| Time | What happens | Constant in `app/entrance.py` |
|---|---|---|
| 0:00 to 0:15 | Fades up from half amplitude (about 6 dB down) to full | `ENTRANCE_FADE_IN_S`, `ENTRANCE_FADE_IN_START_GAIN` |
| 0:58 | The drop | `ENTRANCE_DROP_S` |
| 1:16 to 1:24 | Fades to silence, then stops | `ENTRANCE_FADE_OUT_S`, `ENTRANCE_END_S` |

The track already peaks at 0 dBFS, and the speaker agent keeps the laptop's volume at maximum, so
how loud it gets is up to the big speakers' own knob.

## How it works

`scripts/render_entrance.py` uses ffmpeg to trim the mp3 and bake in the fades, writing a wav, then
uploads it to the [speaker agent](speaker-agent.md) on displaytop. Pressing the button calls
`POST /entrance/start`, the backend tells the agent to play it, and the agent runs `aplay` from its
own copy, so a Wi-Fi hiccup can't stutter the song. The API is in
`pi/docs/api/website-backend-api.md` ("Entrance Song").

- **Countdown**: the backend reports the agent's position in the song and the page counts from
  there, correcting every 3 s, so the phone's clock doesn't matter. The page asks the phone to keep
  its screen on while the song plays, where the browser supports it.
- **Pressing twice**: start does nothing while it's already playing, so it can't restart the song
  and throw off the timer.
- **Sharing the speakers**: only one clip plays at a time. If the trash reminder or house ghost is
  mid-clip, start answers 409 and the page says to try again. If they try to play during the song
  they're refused too: house ghost retries for up to 5 minutes, and the trash reminder logs an
  error and skips that clip.
- **No quiet hours**: unlike house ghost, it plays whenever it's pressed.

## Setup

The song isn't in git, it's copyrighted and the repo is public. Run from the repo root on your own
machine, once the backend's deployed and the speaker agent's running:

```bash
ssh tyler@192.168.1.116 "sudo mkdir -p /mnt/ssd/entrance && sudo chown tyler:tyler /mnt/ssd/entrance"
scp "input/TheFatRat - Xenogenesis (Outro Song).mp3" tyler@192.168.1.116:/mnt/ssd/entrance/source.mp3
ssh tyler@192.168.1.116 "docker exec website-backend-api python scripts/render_entrance.py"
```

## Changing the song or timing

Copy over a new `source.mp3` and/or change the constants, deploy, then rerun `render_entrance.py`.
It overwrites the old wav and uploads the new one. The page gets the drop and end times from the
backend, so it needs no change.

## Troubleshooting

```bash
ssh tyler@192.168.1.116 "docker logs website-backend-api 2>&1 | grep 'entrance song'"
ssh tyler@192.168.1.192 "curl -s localhost:8771/status"
```

The page shows why a start failed. A 503 means the wav is missing or the speaker agent can't be
reached or can't play; see [its troubleshooting](speaker-agent.md#troubleshooting).
