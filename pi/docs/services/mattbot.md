# MattBot

MattBot is an ML-powered LLM + text-to-speech API hosted by Kyle on Bebop (Orin AGX) and accessible exclusively within the Bird Wide Web.

Clients send a text prompt and receive an audio file in response.

---

## Network Setup

MattBot is **not publicly accessible**. It is bound to Bebop's NetBird interface and firewalled to reject all connections from outside the Bird Wide Web (100.64.0.0/10).

### Step 1: Get a NetBird Setup Key

John manages the NetBird overlay network from JohnSERV. Kyle must ask John for a **one-time setup key** via the NetBird dashboard at:

```
https://johnserv.garrepi.dev
```

### Step 2: Install NetBird on Bebop

```bash
curl -fsSL https://pkgs.netbird.io/install.sh | sh
```

### Step 3: Join the Bird Wide Web

```bash
sudo netbird up \
  --setup-key <SETUP_KEY_FROM_JOHN> \
  --management-url https://johnserv.garrepi.dev:443 \
  --hostname bebop
```

Verify the connection:

```bash
sudo netbird status
```

Bebop's assigned NetBird IP will appear in the output (100.x.x.x). Record it — this is the address other Bird Wide Web members use to reach MattBot.

Confirm the peer is visible in the NetBird dashboard before proceeding.

---

## Restricting API Access to Bird Wide Web Only

MattBot must not be reachable from the public internet. Use UFW to allow only traffic from the NetBird subnet.

### UFW Rules

```bash
# Allow Bird Wide Web nodes to reach MattBot
sudo ufw allow from 100.64.0.0/10 to any port 8000 comment "Bird Wide Web - MattBot"

# Block all other inbound traffic on this port
sudo ufw deny 8000

sudo ufw reload
```

> **Why 100.64.0.0/10?** This is the CGNAT range NetBird uses for all overlay IPs. All Bird Wide Web peers fall within this block.

---

## Docker Compose

Save as `~/mattbot/docker-compose.yml` on Bebop.

```yaml
services:
  mattbot:
    image: mattbot:latest  # or use build: . if building from source
    container_name: mattbot
    network_mode: host       # required: gives container access to the NetBird interface
    restart: unless-stopped
    environment:
      - HOST=0.0.0.0
      - PORT=8000
    volumes:
      - ./data:/app/data     # adjust to match MattBot's data/model paths
```

> `network_mode: host` is required. Docker bridge networking does not have access to the NetBird virtual interface, and Docker's iptables rules would bypass UFW for port-mapped containers. Host networking avoids both problems.

Start the service:

```bash
cd ~/mattbot
docker compose up -d
```

---

## Accessing MattBot from Other Bird Wide Web Nodes

Once Bebop is connected and MattBot is running, any other Bird Wide Web node can call the API using Bebop's NetBird IP:

```
http://<bebop-netbird-ip>:8000
```

Example request (text in, audio out):

```bash
curl -X POST http://<bebop-netbird-ip>:8000/speak \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from the Bird Wide Web"}' \
  --output response.wav
```

Adjust the endpoint path and request body to match MattBot's actual API. Refer to Kyle for API details.

---

## Verifying Network Isolation

From any Bird Wide Web node, confirm MattBot is reachable:

```bash
curl http://<bebop-netbird-ip>:8000/health
```

From a machine outside the Bird Wide Web (e.g., a phone on a separate network), confirm it is **not** reachable:

```bash
curl http://<bebop-public-ip>:8000/health
# Expected: connection refused or timeout
```
