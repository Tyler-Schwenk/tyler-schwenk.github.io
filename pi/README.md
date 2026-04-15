# pi (fart-pi backend)

Raspberry Pi 5 home server configuration — the `pi/` subdirectory of the [tyler-schwenk.github.io monorepo](https://github.com/Tyler-Schwenk/tyler-schwenk.github.io).

## Current Status

**Repository Status:**
- Monorepo: https://github.com/Tyler-Schwenk/tyler-schwenk.github.io
- Cloned to Pi at: ~/tyler-schwenk.github.io (pi/ subdirectory)
- Docker installed on Pi

**Deployed Services:**
1. **NetBird** - VPN for secure remote access (Bird Wide Web)
   - Status: Running and operational
   - Network: Bird Wide Web (johnserv.garrepi.dev)
   - NetBird IP: 100.124.76.27
   - NetBird hostname: fart-pi.johnserv.garrepi.dev
   - Management: Self-hosted by John at https://johnserv.garrepi.dev
   - Connected Peers: JohnSERV, JohnNAS, Bebop

2. **Website Backend** - FastAPI + SQLite backend (forum + gallery)
   - Status: Running and operational
   - Private Access: http://100.124.76.27:8000 (via NetBird) or http://localhost:8000 (on Pi)
   - Public Access: https://api.tyler-schwenk.com
   - API Docs: https://api.tyler-schwenk.com/docs
   - Features:
     - Photo galleries: 16 albums, 255 photos migrated (operational)
     - Public Square forum: Posts, comments (routers pending implementation)
     - JWT authentication ready

3. **Beszel** - System monitoring
   - Status: Running and operational
   - Dashboard: http://100.124.76.27:8090 (via NetBird)
   - Monitoring: CPU, RAM, disk, temperature, network, containers

4. **Cloudflare Tunnel** - Public API access
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
  - Local Wi-Fi: 192.168.1.115
  - Local Ethernet: 192.168.1.116
  - NetBird: 100.124.76.27 (Bird Wide Web access)
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
   - Deploy NetBird first (~5 min)
   - Then deploy Website Backend (~10 min)

3. **Test everything:**
   - SSH via NetBird
   - Access services via NetBird network
   - Verify connectivity with other Bird Wide Web peers

## Planning & Architecture

**Current Focus: Phase 1 Deployment**

Building the initial infrastructure:
1. **NetBird** - Secure VPN access as part of the Bird Wide Web
2. **Website Backend** - Unified API for Public Square forum and photo galleries

Service structures are created in this repository. Frontend is deployed on GitHub Pages. Backend runs on Pi and is accessible via the NetBird network.

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

# Or via WiFi
ssh tyler@192.168.1.115
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
- Local network access only

**Planned:**
- All remote access via encrypted VPN (NetBird/WireGuard)
- Bird Wide Web peer-to-peer connectivity
- No router port forwarding needed
- JWT authentication for API
- Rate limiting on all endpoints
- Container isolation
- Encrypted backups
- Read-only volume mounts where appropriate

## Contributing

This is a personal infrastructure project, but feel free to use it as reference for your own setups.
