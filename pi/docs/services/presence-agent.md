# Presence Agent

Works out who's home from whose phone is on the home Wi-Fi, for the Home tab on the admin
page (`tyler-schwenk.com/admin#home`). Code: `pi/services/presence-agent/presence_agent.py`.

```
phones on wifi -> arp-scan on fart-pi (presence-agent.service) -> PUT /presence/agent -> backend (memory) -> GET /presence -> admin page
```

## How it works

- Every 15 s the agent runs `arp-scan` on `eth0` and matches the replies against the MACs in
  `people.json`. Every other device is ignored.
- After each scan it pushes everyone's name and when one of their devices last answered to the
  backend on the same Pi (`http://127.0.0.1:8000`, `X-Presence-Token`). MACs never leave the
  agent.
- The backend keeps everyone's last-seen time in memory (`app/presence.py`). Someone counts as
  home if their phone answered in the last 90 min (`AWAY_AFTER_S`). If the agent hasn't pushed
  for 2 min, the page says it's out of date.
- **Arrivals**: a phone answering after 90 min of silence is an arrival, stamped with the time
  it was first seen, so it's accurate to about the 15 s scan interval. The page shows "returned
  4 min ago (3:42:10 PM)" for the last 30 min, then just the time, and "no return seen yet"
  before the first one. It only counts while the agent
  has been pushing all along: after the agent or backend was down, a long gap could just be time
  nobody was looking. Trips under 90 min don't show as arrivals. A backend restart forgets past
  arrivals.
- Nothing is written to disk. When the backend restarts, everyone shows as "not seen yet"
  until their phone answers, which can take a few minutes for a sleeping phone.
  An agent restart keeps what the backend already knew.
- An empty scan means fart-pi's network is down, so nobody's last-seen time moves.

API: `pi/docs/api/website-backend-api.md` ("Presence").

## Limits of Wi-Fi detection

- **Sleeping phones** stop answering for stretches, sometimes close to an hour. That's why
  "away" only shows 90 min after someone's phone goes quiet, so a departure shows up late.
- **Driveway**: a phone can join the network from outside, so someone can show as home a bit
  early. Wi-Fi off or a dead phone means they show as away.
- **Private addresses**: iPhones and Androids use a private MAC per network. It's usually
  stable, but iOS's "Rotate Wi-Fi Address" setting changes it about every two weeks. If someone
  is always away, recheck their MAC with `--scan` and turn rotating off for the home network on
  their phone.

## people.json

A list of people and their devices' MACs. It's gitignored (the repo is public) and lives only
on fart-pi, next to the agent. Format, see `people.example.json`:

```json
[
  {"name": "Sam", "macs": ["aa:bb:cc:dd:ee:01"]},
  {"name": "Alex", "macs": ["aa:bb:cc:dd:ee:02", "aa:bb:cc:dd:ee:03"]}
]
```

The Home tab lists people in this order. To find someone's MAC, run a scan while their phone
is on the Wi-Fi and see what's new, or have them read Settings > Wi-Fi > (i) > Private Wi-Fi
Address on an iPhone:

```bash
cd ~/tyler-schwenk.github.io/pi/services/presence-agent
sudo .venv/bin/python presence_agent.py --scan
```

After editing it, `sudo systemctl restart presence-agent`.

## Setup

On fart-pi:

```bash
sudo apt install arp-scan

# shared secret: the backend reads it from its .env, the agent from /etc/presence-agent/token
cd ~/tyler-schwenk.github.io/pi/services/website-backend
grep -q '^PRESENCE_TOKEN=.' .env || echo "PRESENCE_TOKEN=$(openssl rand -hex 32)" >> .env
docker compose up -d
sudo mkdir -p /etc/presence-agent
grep '^PRESENCE_TOKEN=' .env | cut -d= -f2 | sudo tee /etc/presence-agent/token >/dev/null
sudo chown tyler:tyler /etc/presence-agent/token
sudo chmod 600 /etc/presence-agent/token

cd ../presence-agent
python3 -m venv .venv
cp people.example.json people.json   # then fill it in
sudo cp presence-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now presence-agent
journalctl -u presence-agent -n 20 --no-pager   # "watching for ..."
```

Code updates go through `pi/scripts/deploy.sh presence-agent`.

## Troubleshooting

- **`backend refused the snapshot: HTTP 401`**: `/etc/presence-agent/token` doesn't match
  `PRESENCE_TOKEN` in the backend's `.env`. Copy it over again.
- **`HTTP 503`**: `PRESENCE_TOKEN` isn't set on the backend. Set it and run `docker compose up -d`.
- **`can't reach the backend`**: website-backend isn't running, check `docker ps`.
- **`arp-scan exited 1`** or permission errors: the unit needs `AmbientCapabilities=CAP_NET_RAW`.
  `--scan` by hand needs `sudo`.
