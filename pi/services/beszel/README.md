# Beszel Monitoring

Lightweight monitoring dashboard for fart-pi system metrics.

## Overview

Beszel provides real-time monitoring of:
- CPU usage and load
- RAM usage
- Disk space
- Docker containers
- Network traffic
- System uptime

## Setup

### 1. Deploy Beszel Hub

```bash
cd ~/tyler-schwenk.github.io/pi/services/beszel
docker compose up -d beszel
```

### 2. Access Dashboard and Get Agent Key

Via NetBird (from anywhere):
```
http://100.72.84.128:8090
```

1. Create admin account
2. Click "Add System"
3. Copy the agent key that appears
4. Save it for the next step

### 3. Configure and Start Agent

On the Pi:
```bash
cd ~/tyler-schwenk.github.io/pi/services/beszel

# Create .env file with your agent key
nano .env
```

Paste this, replacing with your actual key from step 2:
```
AGENT_KEY=your-key-here
```

Save (Ctrl+O, Enter) and exit (Ctrl+X).

Start the agent:
```bash
docker compose up -d agent
```

### 4. Add System in Dashboard

Back in the web UI:
1. System name: fart-pi
2. Host: 172.17.0.1 (Docker bridge IP to reach host from container)
3. Port: 45876 (default agent port)
4. Click "Add"

The Pi should now appear in the dashboard with live metrics.

**Note:** Use `172.17.0.1` not `127.0.0.1` because the hub container needs to reach the agent on the host machine through Docker's bridge network.

## Management

**View logs:**
```bash
docker compose logs -f
```

**Restart:**
```bash
docker compose restart
```

**Update:**
```bash
docker compose pull
docker compose up -d
```

## Data

All monitoring data and configuration stored in `./data/` (excluded from Git).

## Ports

- **8090**: Web dashboard

## Resources

- Minimal CPU usage (< 1%)
- ~50MB RAM
- Disk: ~100MB for Docker image + historical data
