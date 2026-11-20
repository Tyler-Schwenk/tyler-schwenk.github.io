# Tailscale

We run our own tailnet (`tyler-schwenk.github`, MagicDNS suffix `taila4ff35.ts.net`), owned by our GitHub login. Friends with their own home servers run their own tailnets, and we swap access by **sharing individual machines** with each other. Nobody joins anyone else's tailnet, so each person stays admin of their own devices and ACLs.

Tailscale runs natively on fart-pi as a systemd service (`tailscaled`), not in Docker. It was installed with the official script (`curl -fsSL https://tailscale.com/install.sh | sh`), which adds the Tailscale apt repo, so it updates with the rest of the system on `apt upgrade`.

## Our nodes

| Machine | Tailnet IP | MagicDNS name |
|---------|-----------|---------------|
| fart-pi | `100.91.171.58` | `fart-pi.taila4ff35.ts.net` |
| Windows laptop | `100.111.20.33` | `tylerschwelapto.taila4ff35.ts.net` |

Since the laptop's on the tailnet, `ssh tyler@fart-pi.taila4ff35.ts.net` works from anywhere, not just the home LAN.

## Machines shared with us

| Machine | Owner | Tailnet IP | MagicDNS name |
|---------|-------|-----------|---------------|
| mattbot | Kyle | `100.67.239.119` | `mattbot.tailaaa0c4.ts.net` |

Shared machines keep their owner's MagicDNS suffix, so bare names like `mattbot` don't resolve from our tailnet. Use the full name, or an alias in `~/.ssh/config`:

```
Host mattbot
    HostName mattbot.tailaaa0c4.ts.net
    User tyler
```

Ground rules on mattbot: it hosts Kyle's public-facing sites, so no port forwarding or networking changes of any kind, and his data isn't backed up, so be careful with anything that writes or deletes.

## How it fits with everything else

| Path | Who uses it | Reaches |
|------|-------------|---------|
| Home LAN (`192.168.1.116`) | us, at home | everything |
| Cloudflare Tunnel (`api.tyler-schwenk.com`) | the public | website backend only |
| Tailscale | our own devices, plus friends we've shared fart-pi with | whatever our ACLs allow |

Every service that binds `0.0.0.0` on the host (website backend on 8000, Beszel on 8090, SSH on 22) is reachable on the `tailscale0` interface too, so the ACLs are what actually decide who gets in.

## How machine sharing works

- Sharing is per machine. Sharing fart-pi with a friend doesn't expose displaytop, castpi, or anything else on our tailnet.
- It's one-directional. A shared machine shows up in the friend's tailnet and their devices can connect *to* it, but it can't start connections back into their tailnet. For two-way access, both sides share.
- A shared machine keeps its `100.x` IP, so friends reach fart-pi at `100.91.171.58` (or its full MagicDNS name) from any device on their tailnet.
- Subnet routes and exit nodes don't carry over through a share, only the machine itself.
- To reach a friend's shared machine, the device we're on has to be on our tailnet (fart-pi already is; a laptop or phone needs Tailscale installed and logged in to our tailnet).

### Sharing one of our machines

1. Admin console (login.tailscale.com, signed in with GitHub) -> Machines.
2. On the machine's row, `...` -> Share -> create an invite link (or invite by email) and send it to the friend.
3. The friend opens the link and accepts it into *their* tailnet.
4. Revoke anytime from the same Share dialog.

### Accepting a friend's machine

The friend shares from their console and sends us the invite link. Open it signed in with our GitHub login and accept it into `tyler-schwenk.github`. Their machine then shows up in our Machines list and `tailscale status`.

## ACLs

The default policy allows everything to everything, and that includes people we've shared with, so a friend could hit every port on fart-pi including SSH. Lock it down in the admin console under Access controls. People coming in through a share are `autogroup:shared`:

```json
{
  "hosts": {
    "fart-pi": "100.91.171.58"
  },
  "acls": [
    {"action": "accept", "src": ["autogroup:member"], "dst": ["*:*"]},
    {"action": "accept", "src": ["autogroup:shared"], "dst": ["fart-pi:8000,8090"]}
  ]
}
```

The first rule keeps our own devices fully connected to each other; the second gives friends only the listed ports. Add ports there as we decide to share more services.

## Common commands

```bash
tailscale status          # peers (incl. machines shared with us) and their IPs
tailscale ip -4           # this machine's tailnet IPv4
tailscale ping <peer>     # check a direct connection to a peer
sudo tailscale down       # disconnect from the tailnet (stays logged in)
sudo tailscale up         # reconnect
```

## Rejoining from scratch

If fart-pi ever gets logged out (`tailscale status` says `Logged out.`), run `sudo tailscale up --hostname=fart-pi`, open the printed URL, sign in with GitHub, and pick the `tyler-schwenk.github` tailnet, not a friend's. Then disable key expiry for fart-pi in the Machines page so it doesn't drop off every 180 days.

## Troubleshooting

- A friend can't reach a port: check that the service binds `0.0.0.0` (not `127.0.0.1`) with `ss -tlnp`, then check our ACLs. Both have to allow it.
- We can't reach a friend's machine: confirm the share was accepted (it shows in `tailscale status`) and that their ACLs allow `autogroup:shared` to that port.
- Logs: `journalctl -u tailscaled -n 100`.
