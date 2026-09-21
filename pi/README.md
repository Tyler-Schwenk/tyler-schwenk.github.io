# pi (fart-pi backend)

Raspberry Pi 5 home server configuration — the `pi/` subdirectory of the [tyler-schwenk.github.io monorepo](https://github.com/Tyler-Schwenk/tyler-schwenk.github.io).

## Current Status

**Repository Status:**
- Monorepo: https://github.com/Tyler-Schwenk/tyler-schwenk.github.io
- Cloned to Pi at: ~/tyler-schwenk.github.io (pi/ subdirectory)
- Docker installed on Pi

**Deployed Services:**
1. **Website Backend** - FastAPI + SQLite backend (forum + gallery)
   - Status: Running and operational
   - Private Access: http://192.168.1.116:8000 (home LAN) or http://localhost:8000 (on Pi)
   - Public Access: https://api.tyler-schwenk.com
   - API Docs: https://api.tyler-schwenk.com/docs
   - Features:
     - Photo galleries: 16 albums, 255 photos migrated (operational)
     - Public Square forum: Posts, comments (routers pending implementation)
     - JWT authentication ready

2. **Beszel** - System monitoring
   - Status: Running and operational
   - Dashboard: http://192.168.1.116:8090 (home LAN)
   - Monitoring: CPU, RAM, disk, temperature, network, containers

3. **Cloudflare Tunnel** - Public API access
   - Status: Running with named tunnel
   - Domain: api.tyler-schwenk.com
   - Tunnel: fart-pi-tunnel
   - Target: website-backend-api:8000

**Phase 2+ - Future:**
- Immich (photo management)
- Samba (local file sharing)
- Off-site backups

See [docs/architecture.md](docs/architecture.md) for complete architecture and planning.

## Hardware

- **Pi**: Raspberry Pi 5 (8GB RAM)
- **Hostname**: fart-pi
- **OS**: Raspberry Pi OS (64-bit)
- **Network**: 
  - Local Ethernet: 192.168.1.116 (primary, use this for SSH)
  - Local Wi-Fi: DHCP-assigned, address drifts (was 192.168.1.167 at last check)
- **Storage**: External SSD via USB (for media files)
- **Docker**: Version 29.2.1, Compose v5.1.0

More details: [docs/hardware.md](docs/hardware.md)

## Repository Structure

```
pi/
+-- services/                # Docker Compose configs for each service
�   +-- website-backend/     # Forum + gallery API
�   +-- netbird/             # VPN access (Bird Wide Web)
�   +-- beszel/              # System monitoring
�   +-- cloudflared/         # Cloudflare tunnel
+-- docs/                    # Documentation
�   +-- README.md            # Documentation index
�   +-- architecture.md      # System architecture and planning
�   +-- website-integration.md  # Frontend integration guide
�   +-- BirdWideWeb.md       # NetBird topology
�   +-- api/                 # API documentation
�   +-- services/            # Service-specific docs
�   +-- FORTYLER/            # Practical quick reference
�   +-- internal/            # Internal reference docs
+-- scripts/                 # Automation scripts (in service directories)
```

## Getting Started

**System is already deployed.** For operational guides:

- **Add photos**: See [docs/FORTYLER/photo-upload-workflow.md](docs/FORTYLER/photo-upload-workflow.md)
- **Access services**: See Quick Reference sections in [docs/README.md](docs/README.md)
- **API documentation**: See [docs/api/website-backend-api.md](docs/api/website-backend-api.md)

For deploying new services or making changes, see [docs/architecture.md](docs/architecture.md).
   - Follow step-by-step: [docs/phase1-deployment.md](docs/phase1-deployment.md)
   - Deploy Website Backend (~10 min)

3. **Test everything:**
   - SSH over the home LAN (`ssh tyler@192.168.1.116`)
   - Access services on their LAN ports (8000 API, 8090 Beszel)

## Planning & Architecture

**Current Focus: Phase 1 Deployment**

Building the initial infrastructure:
1. **Website Backend** - Unified API for Public Square forum and photo galleries

Service structures are created in this repository. Frontend is deployed on GitHub Pages. Backend runs on Pi and is reachable on the home LAN, and publicly through the Cloudflare Tunnel.

**Phase 2+ services:**
- Navidrome for music streaming
- Immich for photo backup
- Beszel for monitoring
- Samba for local file sharing
- Automated encrypted backups to parents' house

**Key planning documents:**
- [Pre-Deployment Checklist](docs/pre-deployment.md) - Accounts and prerequisites
- [Architecture Plan](docs/architecture.md) - Phased deployment plan with technical decisions
- [Phase 1 Deployment](docs/phase1-deployment.md) - Complete deployment guide
- [Hardware & Network](docs/hardware.md) - Physical setup and networking

## Quick Commands

**SSH access:**
```bash
# Via Ethernet (recommended)
ssh tyler@192.168.1.116

# Or via WiFi (DHCP address, check `ip -4 -br addr` on the Pi if it changed)
ssh tyler@192.168.1.167
```

**Check if Docker is installed:**
```bash
ssh tyler@192.168.1.116 docker --version
```

**Copy repo to Pi (if not using Git):**
```bash
scp -r tyler-schwenk.github.io/pi tyler@192.168.1.116:~/
```

**Deploy a new service:**
```bash
cd ~/tyler-schwenk.github.io/pi/services/<service-name>
cp .env.example .env   # Configure secrets
nano .env              # Edit configuration
docker compose up -d   # Start service
```

## Documentation

All documentation is in the [docs/](docs) directory:

- [Pre-Deployment Checklist](docs/pre-deployment.md) - Start here!
- [Architecture Plan](docs/architecture.md) - Overall system design with open questions
- [Phase 1 Deployment](docs/phase1-deployment.md) - Step-by-step deployment guide
- [Website Backend API](docs/api/website-backend-api.md) - API documentation for frontend
- [Hardware & Network](docs/hardware.md) - Physical setup and networking

## Security Considerations

**Current:**
- No ports exposed to internet
- SSH and private service ports are reachable on the home LAN only
- Public API goes through the Cloudflare Tunnel (no router port forwarding needed)

**Planned:**
- JWT authentication for API
- Rate limiting on all endpoints
- Container isolation
- Encrypted backups
- Read-only volume mounts where appropriate

## Contributing

This is a personal infrastructure project, but feel free to use it as reference for your own setups.
