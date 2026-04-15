# Documentation Index

Documentation for fart-pi Raspberry Pi 5 home server.

## Current Documentation

### Planning & Architecture
- [**Architecture Plan**](architecture.md) - System design, planned services, and deployment status
- [**Website Integration**](website-integration.md) - How to integrate GitHub Pages frontend with Pi backend
- [**Bird Wide Web**](BirdWideWeb.md) - NetBird network topology

### External Documentation
- [**Website Backend API**](api/website-backend-api.md) - API documentation for frontend developers
- [**Website Integration**](website-integration.md) - How to integrate GitHub Pages frontend with Pi backend

### Services
- [**Website Backend**](api/website-backend-api.md) - Forum and photo gallery API
- [**Beszel**](services/beszel.md) - System monitoring and health tracking
- [**Cloudflare Tunnel**](services/cloudflare-tunnel.md) - Public API access

### For Tyler
- [**Tyler's Quick Reference**](FORTYLER/README.md) - Practical guides and workflows

## System Overview

**What's deployed:**
- Raspberry Pi 5 running Pi OS (hostname: fart-pi)
- Website Backend API (forum + photo galleries)
- NetBird VPN (Bird Wide Web network)
- Beszel system monitoring
- Cloudflare Tunnel (public API access)
- External SSD for media storage

**What's planned:**
- Immich photo management
- Samba file sharing
- Off-site backups

See [Architecture Plan](architecture.md) for full details.

## Quick Reference

### Access

**SSH (Remote via NetBird)**: 
```bash
ssh tyler@fart-pi.johnserv.garrepi.dev
ssh tyler@100.124.76.27
```

**SSH (Local Network)**:
```bash
ssh tyler@192.168.1.115      # Via Wi-Fi
ssh tyler@192.168.1.116      # Via Ethernet
```

**Web Services**:
- Website Backend API: http://100.124.76.27:8000 (via NetBird) or http://localhost:8000 (on Pi)
- Public API: https://api.tyler-schwenk.com
- Beszel: http://100.124.76.27:8090 (via NetBird)

### Common Commands

**Check running services**:
```bash
docker ps
```

**Manage a service**:
```bash
cd ~/tyler-schwenk.github.io/pi/services/<service-name>
docker compose logs       # View logs
docker compose restart    # Restart
docker compose down       # Stop
docker compose up -d      # Start
```

**Update repository**:
```bash
cd ~/tyler-schwenk.github.io/pi
git pull
```

## Documentation Principles

All documentation follows these rules:

1. **Current state only** - No historical changes
2. **No emojis** - Clean, professional docs
3. **Focus on behavior** - Data formats, APIs, how things work
4. **Keep updated** - Docs reflect reality, not speculation

## Structure

```
docs/
├── README.md                      # This file
├── architecture.md                # System design and deployment status
├── website-integration.md         # Frontend integration guide
├── BirdWideWeb.md                 # NetBird network topology
├── api/
│   └── website-backend-api.md     # API documentation
├── services/
│   ├── beszel.md                  # Monitoring setup
│   └── cloudflare-tunnel.md       # Public access setup
├── FORTYLER/
│   ├── README.md                  # Quick reference index
│   ├── photo-upload-workflow.md   # Adding new photos
│   └── public-api-setup.md        # Tunnel setup guide
└── internal/
    ├── README.md                  # Internal reference
    ├── hardware.md                # Hardware specs
    └── deployment.md              # Deployment procedures
```

## Resources

- [Docker Compose Docs](https://docs.docker.com/compose/)
- [Raspberry Pi Documentation](https://www.raspberrypi.com/documentation/)
- [NetBird Documentation](https://docs.netbird.io/)
