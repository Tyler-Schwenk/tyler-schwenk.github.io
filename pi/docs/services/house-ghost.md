# House Ghost

A scary voice greets roommates by name through the big speakers (the
[speaker agent](speaker-agent.md) on displaytop) when their phone joins the home Wi-Fi. Code: `pi/services/house-ghost/`.

## How it works

Every 15 s, `main.py` runs `arp-scan` on `eth0` and compares the replies to the MAC addresses
in `roommates.json`. Every other device on the network is ignored.

A roommate gets a greeting when their device answers after being silent for at least 90
minutes (`AWAY_BEFORE_GREET_S`), unless any of these apply:

| Rule | Value | Constant in `main.py` |
|---|---|---|
| Already greeted recently | 4 hours | `GREET_COOLDOWN_S` |
| Quiet hours, arrival is skipped | 23:00 to 08:00 | `QUIET_START_HOUR`, `QUIET_END_HOUR` |
| Trash reminder is using the speakers | waits, drops after 5 min | `PENDING_MAX_AGE_S` |

- Greetings are a random pick from that roommate's pre-rendered clips, so they play right away.
- Trackers live in memory and nothing about arrivals is written to disk. Arrivals do appear in
  the service's journal. After a restart everyone counts as just seen, so a restart can't
  greet the whole house.
- A scan with no replies means fart-pi's network is down, so it's skipped rather than counted
  as everyone leaving.

## Limits of Wi-Fi detection

- A phone can join the network from the driveway, so a greeting can come before they're
  inside. Wi-Fi off or a dead phone means no greeting.
- Sleeping phones stop answering for stretches, sometimes close to an hour.
  `AWAY_BEFORE_GREET_S` has to stay longer than that or roommates get greeted while they're
  home, so trips shorter than 90 minutes don't get a greeting. Every arrival is logged with
  how long they were gone (`is back after N min`), which is the way to tune it.
- iPhones and Androids use a private MAC per network. It's usually stable, but iOS's "Rotating"
  Private Wi-Fi Address setting changes it. If someone stops getting greetings, recheck their
  MAC with `--scan`, and set that network to "Fixed" on their phone.

## Setup

Roommates' MACs and the rendered clips aren't in git (`pi/.gitignore`), so they're kept on
fart-pi. Run on fart-pi, from `~/tyler-schwenk.github.io/pi/services/house-ghost`:

```bash
sudo apt install arp-scan
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# find each roommate's device, with their phone on the wifi
sudo .venv/bin/python main.py --scan

cp roommates.example.json roommates.json   # then fill it in
.venv/bin/python render_clips.py           # downloads the voice, writes audio/

sudo cp house-ghost.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now house-ghost
journalctl -u house-ghost -n 20 --no-pager     # "watching for ..."
```

`roommates.json` is a list of `{"name", "macs", "say_as"}`, where `say_as` is optional and sets
how the voice pronounces the name. After adding someone, rerun `render_clips.py` and restart
the service.

Code updates go through `pi/scripts/deploy.sh house-ghost`.

## Changing the voice

`GREETING_LINES` and the effect constants are in `render_clips.py`. It skips clips that already
exist, so `rm -r audio` before rerendering.

Test a voice without touching anyone's clips by playing a test render directly:

```bash
.venv/bin/python render_clips.py --name Test
.venv/bin/python -c "from pathlib import Path; import main; main.play_clip(Path('audio/test_0.wav'), 'house-ghost')"
rm audio/test_*.wav
```

## Turning it off

```bash
sudo systemctl disable --now house-ghost
```
