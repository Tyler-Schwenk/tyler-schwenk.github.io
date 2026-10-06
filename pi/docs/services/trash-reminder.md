# Trash Reminder

Reminds the house to take the trash out every Thursday evening, in Matt's voice, through
fart-pi's speakers, and takes over the display kiosk's screens (displaytop) until someone
says it's done. Code: `pi/services/trash-reminder/main.py` (fart-pi) and
`pi/services/surfcam-agent/trash_alert.py` plus `website/app/display/TrashPanel.tsx`
(the kiosk side).

## Schedule and audio

- **Window**: Thursday 17:00 to 23:00 local time (`TRASH_WEEKDAY`, `TRASH_START_HOUR`,
  `TRASH_END_HOUR` in `main.py`)
- At 17:00 it plays the siren then "take out the trash", then a follow-up every 10 minutes
  (`hey_guys` plus `take_out_trash` or `tell_the_bird`, with the siren 30% of the time)
  until someone confirms or the window closes
- **Confirming** (the button, or the kiosk keyboard, below) cuts off any reminder mid-clip
  and plays `thanks` then `i_love_you`. Reminders stop for the rest of that ISO week, saved
  in `trash_state.json` so a restart doesn't start them again
- Outside trash time the button plays `hey_guys` and `i_love_you` alternately

Hardware (GPIO 17 button, I2S amps on ALSA `plughw:2,0`) is in
`pi/docs/internal/hardware.md`. The clips live in `pi/services/trash-reminder/audio/`
on fart-pi, not in git; copy them over with `scp`.

## HTTP API

A stdlib HTTP server on port **8770**, all interfaces, for displaytop. LAN only (the
Cloudflare tunnel only points at port 8000), no auth.

| Request | Response |
|---|---|
| `GET /status` | `{"state": "idle" \| "trash_active" \| "trash_done", "confirmed_at_ms": int \| null}` |
| `POST /confirm` | Same as the button during trash time: 200 with the new status (the thanks plays after the response). 409 with an error and the status any other time |

`confirmed_at_ms` is the epoch ms of the last confirmation, from either the button or
`/confirm`. It's kept in memory only, so it's null after a restart. States: `trash_active`
while reminding, `trash_done` while the thanks plays (it goes back to `idle` after).

```bash
curl -s http://192.168.1.116:8770/status
```

## Display kiosk takeover

The surfcam agent on displaytop polls `/status` every 5 s
(`pi/services/surfcam-agent/README.md`, "Trash night") and the `/display` pages long-poll
the agent (`website/docs/DISPLAY.md`, "Trash Night"):

- **While `trash_active`**: both screens drop whatever they're showing (surf cams stop,
  bpm mode closes). The monitor below shows the trash with "It's trash day!" and a line
  about Matt or the cormorant, a different one each week. The laptop screen on top says to
  press any key on the laptop's keyboard once it's out
- **Any key on the laptop's keyboard** confirms through the agent's `POST /trash/done`,
  which calls `/confirm` here, so fart-pi plays its thanks
- **For 10 s after a confirmation** (the kiosk's or the button's) both screens show the
  happy cormorant, then go back to the normal rotation where it would have been

If fart-pi stops answering, the agent drops the alert after 60 s so the screens don't get
stuck on it.

## Deploying

It's a venv + systemd service (`trash-reminder.service`, running as `tyler`), handled by
`pi/scripts/deploy.sh`:

```bash
ssh tyler@192.168.1.116 "~/tyler-schwenk.github.io/pi/scripts/deploy.sh trash-reminder"
ssh tyler@192.168.1.116 "journalctl -u trash-reminder -n 20 --no-pager"   # "API on port 8770"
```

The kiosk side deploys with the surfcam agent (`pi/docs/services/display-kiosk.md`,
"Updating the kiosk's own code") and the website.

## Testing the takeover

There's no test mode, so the simplest end-to-end check is temporarily moving the window to
now: set `TRASH_WEEKDAY`/`TRASH_START_HOUR` on fart-pi to the current day and hour,
`sudo systemctl restart trash-reminder`, and within about 40 s (the scheduler checks every
30 s, the agent every 5 s) the screens switch and the siren plays. Press a key on
displaytop, then put the constants back and restart again. Confirming during a test saves
the current ISO week as done, which would skip this week's real Thursday, so delete
`pi/services/trash-reminder/trash_state.json` afterwards.
