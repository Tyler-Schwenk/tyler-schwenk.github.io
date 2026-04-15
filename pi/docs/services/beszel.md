# Beszel Monitoring Service

System monitoring dashboard for fart-pi.

## Status

**Deployed and operational**
- Dashboard accessible at http://100.124.76.27:8090
- Monitoring system: fart-pi
- Current metrics: CPU, RAM, disk, temperature, Docker containers

## Purpose

Provides real-time visibility into Pi system health and resource usage. Essential for:
- Detecting performance issues
- Capacity planning
- Docker container monitoring
- Troubleshooting

## Features

- **CPU Monitoring**: Usage percentage, load averages
- **Memory Monitoring**: RAM and swap usage
- **Disk Monitoring**: Space usage across all mounted drives
- **Container Stats**: Per-container CPU/RAM usage
- **Network Stats**: Bandwidth usage
- **Historical Graphs**: Time-series data for trends

## Architecture

Two-container deployment:

**Hub (Web Dashboard):**
- **Image**: henrygd/beszel:latest
- **Port**: 8090 (HTTP web interface)
- **Storage**: SQLite database in ./data/
- **Purpose**: Web UI, receives metrics from agents

**Agent (Metrics Collector):**
- **Image**: henrygd/beszel-agent:latest
- **Port**: 45876 (internal communication with hub)
- **Host Access**: Reads system metrics via /proc, /sys, and Docker socket
- **Purpose**: Collects CPU, RAM, disk, container stats and sends to hub

## Access

**Via NetBird IP (private):**
```
http://100.124.76.27:8090
```

**Via local network:**
```
http://192.168.1.115:8090
```

## Configuration

### System Connection

When adding the Pi as a monitored system in the dashboard:
- **Name**: fart-pi
- **Host**: 172.17.0.1 (Docker bridge IP - allows hub container to reach agent on host)
- **Port**: 45876
- **Key**: SSH public key from \"Add System\" dialog (ssh-ed25519...)

**Important:** Use `172.17.0.1` not `127.0.0.1`. The hub runs in a container and needs the Docker bridge IP to reach the agent running on the host machine.

### Alert Thresholds

Default settings are sufficient for basic monitoring. Optional configurations:

Configure in web UI:
- CPU usage > 80%
- RAM usage > 85%
- Disk usage > 90%

### Data Retention

Default: 30 days of historical data. Configurable in web UI settings.

## Security

**Private access (recommended):**
- Only accessible via NetBird network or local network
- Protected by Beszel's built-in authentication

**Public access (optional):**
- Set up Cloudflare Tunnel or reverse proxy if needed
- Use strong admin password
- Consider firewall rules and access control

## Maintenance

**Automatic:**
- Data cleanup based on retention settings
- Restarts on failure (unless-stopped policy)

**Manual:**
- Update container: `docker compose pull && docker compose up -d`
- Backup data: Copy `./data/` directory

## Resource Usage

- **CPU**: < 1% average
- **RAM**: ~50MB
- **Disk**: ~100MB for image, ~1-2GB for 30 days of data
- **Network**: Minimal (local metrics collection only)

## Troubleshooting

**Dashboard not loading:**
```bash
# Check container status
cd ~/tyler-schwenk.github.io/pi/services/beszel
docker compose ps
docker compose logs
```

**Metrics not updating:**
- Verify Docker socket is accessible
- Check container has proper permissions

**High disk usage:**
- Reduce data retention period in settings
- Consider moving data directory to external SSD
