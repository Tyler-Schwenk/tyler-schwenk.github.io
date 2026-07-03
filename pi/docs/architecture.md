# Architecture Plan

**Status**: Phase 1 deployed and operational - Website Backend (gallery + forum + pac-tyler), NetBird, Beszel, Cloudflare Tunnel all running; Pac-Tyler updater pending first-time setup

## Overview

System architecture for fart-pi multi-service home server.

## Current State

**What exists now:**
- Raspberry Pi 5 (fart-pi) running Raspberry Pi OS
- Docker and Docker Compose installed on Pi
- Repository pushed to GitHub: https://github.com/Tyler-Schwenk/tyler-schwenk.github.io
- Repository cloned to Pi: ~/tyler-schwenk.github.io/pi
- External SSD connected to Pi via USB

**Deployed Services:**
1. **NetBird** - VPN for secure remote access (Bird Wide Web)
   - Status: Running on fart-pi
   - NetBird IP: 100.124.76.27
   - Network Domain: johnserv.garrepi.dev
   - Management: Self-hosted by John at https://johnserv.garrepi.dev
   - Connected Peers: JohnSERV (100.124.56.240), JohnNAS, Bebop

2. **Website Backend** - FastAPI backend for tyler-schwenk.com
   - Status: Running and operational
   - Access: http://fart-pi.johnserv.garrepi.dev:8000 or http://100.124.76.27:8000
   - Public Access: https://api.tyler-schwenk.com
   - API Documentation: http://100.124.76.27:8000/docs or https://api.tyler-schwenk.com/docs
   - Health Check: http://100.124.76.27:8000/health or https://api.tyler-schwenk.com/health
   - Database: SQLite at /app/data/website_backend.db
   - Features:
     - **Photo Galleries**: 13 albums (250+ photos), display_order sorting, admin panel management
     - **Video Hosting**: Upload, streaming, thumbnail generation with ffmpeg
     - **Public Square**: Anonymous forum — posts, comments, upvote/downvote, no login required (see `pi/docs/api/website-backend-api.md`)
     - **Admin Panel**: `https://tyler-schwenk.com/admin/` — gallery/photo/video management UI, plus Public Square moderation (hard delete posts/comments)
     - JWT authentication (bcrypt password hashing, 30-day token expiry) — single admin account, not used by Public Square
   - Photo Storage: /media/tyler/FE645A9A645A558D/public-gallery
   - Video Storage: /media/tyler/FE645A9A645A558D/videos

3. **Beszel** - System monitoring and health tracking
   - Status: Running and operational
   - Dashboard: http://100.124.76.27:8090 (via NetBird)
   - Hub + Agent architecture
   - Monitoring: CPU, RAM, disk, temperature, network, Docker containers
   - Resource usage: <1% CPU, ~50MB RAM

4. **Cloudflare Tunnel** - Public API access
   - Status: Running with named tunnel
   - Domain: api.tyler-schwenk.com
   - Tunnel Name: fart-pi-tunnel
   - Target: website-backend-api:8000

5. **Pac-Tyler Updater** - Daily Strava data sync
   - Status: Code ready, pending first-time setup on Pi (see pi/services/pac-tyler-updater/README.md)
   - Service: `pi/services/pac-tyler-updater/`
   - Auth: Strava refresh token (headless, no browser required after first-time setup)
   - Output: `/home/tyler/pac-tyler-data/cleaned_output.geojson` and `pac-tyler-activities.json`
   - Data served by website-backend at `/pac-tyler/geojson` and `/pac-tyler/activities`
   - Logs: `journalctl -u pac-tyler-updater.service`

**Ready to deploy (Phase 2):**
6. **Immich** - Photo and video management
   - Status: Configured, ready to deploy
   - Port: 2283
   - Access: http://100.124.76.27:2283 (via NetBird)
   - Features: Mobile backup, face recognition, object detection, albums
   - Storage: /media/tyler/FE645A9A645A558D/photos
   - Components: Server, microservices, ML, Redis, PostgreSQL
   - Setup guide: docs/FORTYLER/immich-setup.md

**Later additions (Phase 3+):**
- Samba (local file sharing)
- Off-site backups

## Hardware Setup

- **Pi**: Raspberry Pi 5 (8GB RAM)
- **Storage**: External SSD via USB (for large media files)
- **Network**: Dual connectivity (Ethernet + WiFi)

## Services

### Phase 1: Core Infrastructure (DEPLOYED)

**Website Backend API**
- Unified backend for tyler-schwenk.com
- FastAPI (Python) with single SQLite database
- User auth: JWT, bcrypt password hashing, 30-day token expiry
- **Features:**
  - **Photo Galleries**: 13 albums, 250+ photos, display_order sorting, automatic thumbnails (operational)
  - **Video Hosting**: Upload, streaming, automatic thumbnail generation (operational)
  - **Public Square**: Anonymous forum — posts, comments, upvote/downvote (operational)
  - **The Kitchen (Recipes)**: Public, rate-limited recipe submission (name/description/tags/photos, all optional) with search/tag-filter/random browsing; admin-only edit/delete (see `pi/docs/api/website-backend-api.md`)
  - **Admin Panel**: `https://tyler-schwenk.com/admin/` — gallery/photo/video management UI, plus Public Square moderation
- Frontend: GitHub Pages (hosted separately at tyler-schwenk.com)
- Access:
  - Private: http://100.124.76.27:8000 (via NetBird) or http://localhost:8000 (on Pi)
  - Public: https://api.tyler-schwenk.com
- Port: 8000
- Database: website_backend.db with tables for users, galleries, gallery_photos, videos, posts, comments, post_votes, comment_votes, event_rsvps, recipes, tags, recipe_tags, recipe_photos
- Storage:
  - Photos: /media/tyler/FE645A9A645A558D/public-gallery
  - Videos: /media/tyler/FE645A9A645A558D/videos
  - Recipe photos: /media/tyler/FE645A9A645A558D/recipe-photos
- Dependencies: ffmpeg for video processing

**NetBird VPN**
- WireGuard-based mesh network (Bird Wide Web)
- Self-hosted by John at https://johnserv.garrepi.dev
- NetBird IP: 100.124.76.27
- NetBird hostname: fart-pi.johnserv.garrepi.dev
- Connected peers: JohnSERV, JohnNAS, Bebop
- Status: Running and operational

**Beszel Monitoring**
- System health tracking
- Dashboard: http://100.124.76.27:8090 (via NetBird)
- Monitoring: CPU, RAM, disk, temperature, Docker containers
- Resource usage: <1% CPU, ~50MB RAM
- Status: Running and operational

**Cloudflare Tunnel**
- Public API access without port forwarding
- Mode: Named tunnel with custom domain
- Domain: api.tyler-schwenk.com
- Tunnel: fart-pi-tunnel
- Target: website-backend-api:8000
- Status: Running and operational

### Phase 2: Media Services (READY TO DEPLOY)

**Immich**
- Photo and video management with mobile backup
- Self-hosted Google Photos alternative
- Features:
  - Automatic mobile backup (iOS/Android apps)
  - Face detection and recognition
  - Object recognition and search
  - Timeline view
  - Albums and sharing
  - Duplicate detection
  - Raw photo and video support
- Components:
  - immich-server (main web interface)
  - immich-microservices (background jobs)
  - immich-machine-learning (AI features)
  - Redis (caching)
  - PostgreSQL (database)
- Storage: /media/tyler/FE645A9A645A558D/photos
- Port: 2283
- Access: http://100.124.76.27:2283 (via NetBird) or http://192.168.1.116:2283 (local)
- Status: Configured, ready to deploy
- Setup: See docs/FORTYLER/immich-setup.md

### Phase 3: File Sharing & Backups (PLANNED)

**Samba**
- Local network file sharing
- SMB/CIFS for Windows/Mac/Linux
- Access Pi files from any local device
- Port: 445
- Local network only

**Backups**
- **Off-site backup** - To parents' house
  - Automated encrypted backups
  - Tool: Probably Restic
  - Target: Another Raspberry Pi
  - Connected via NetBird

## Storage Architecture

### External SSD (`/media/tyler/FE645A9A645A558D/`)
**Purpose**: Store large media files

**Device**: `/dev/sda1` - 193GB NTFS partition (1% used, 193GB available)

Directories:
```
/media/tyler/FE645A9A645A558D/
├── photos/             # Personal photo library (Immich - future)
├── public-gallery/     # Curated photos for website galleries (Website Backend API)
│   ├── jordan/
│   │   ├── *.jpg       # Original images
│   │   └── thumbnails/ # Auto-generated thumbnails (400x400px)
│   ├── durango/
│   ├── friends/
│   └── ... # 16 galleries total, 255 photos
└── files/              # General file storage
```

## Website Architecture (tyler-schwenk.github.io)

### Hybrid Frontend + Backend Model

**Frontend:** GitHub Pages (static site)
- Repository: separate from this repo
- Hosting: github.io CDN (fast, global)
- Framework: Next.js with static export

**Backend:** Website Backend API (this repo, on Pi)
- Repository: services/website-backend/
- Hosting: fart-pi (home server)
- Framework: FastAPI + SQLite

### Content Distribution Strategy

**Static Content on GitHub Pages (Fast):**
- Homepage images (hero, backgrounds, icons)
- About page photos
- Navigation assets
- Any images that rarely change
- Location: `/public/images/` in website repo
- **Why**: CDN-backed, globally distributed, sub-100ms load times

**Dynamic Content from Pi API (Slower):**
- Photo galleries (frequent additions/removals)
- Forum posts and comments (Public Square)
- User-uploaded content
- Any content managed via API
- Location: `/media/tyler/FE645A9A645A558D/public-gallery/` on Pi
- **Why**: Easy to update, no Git commits needed, dynamic management

### Gallery Management

All gallery photos and videos are managed via the admin panel at `https://tyler-schwenk.com/admin/`. No SSH or scripts needed for day-to-day updates.

**Admin panel features:**
- Reorder galleries by `display_order` (higher = shown first, auto-increments by 10 on create)
- Edit gallery name, slug, description, public/private toggle
- Delete individual photos or entire galleries
- Upload new photos to existing or new galleries
- Upload videos
- View event RSVPs (grouped by event, with headcount and per-response delete)

### Internal Storage (SD Card)
**Purpose**: System and service configurations

```
/home/tyler/tyler-schwenk.github.io/pi/    # This repo
├── services/                         # Service configs
│   ├── website-backend/             # Deployed
│   ├── netbird/                     # Deployed
│   ├── beszel/                      # Deployed
│   ├── cloudflared/                 # Deployed
│   └── ...                          # Future services
├── docs/                            # Documentation
└── scripts/                         # Automation scripts
```

Each service directory contains:
- `docker-compose.yml` - Container configuration
- `.env` - Secrets and config (not in Git)
- `data/` - Service databases and caches (if needed)
- `README.md` - Service-specific docs

## Docker Architecture

**How it works:**
- All services run as Docker containers
- Containers are siblings (not nested)
- Each managed by Docker Engine
- Containers access SSD via volume mounts

```
Raspberry Pi OS (Host)
├── Docker Engine
│   ├── website-backend-api (deployed)
│   ├── netbird (deployed)
│   ├── beszel-hub (deployed)
│   ├── beszel-agent (deployed)
│   ├── cloudflared-tunnel (deployed)
│   └── Future containers (Immich, Samba, etc.)
└── tyler-schwenk.github.io/pi/ (This repo - config files)
```

**Volume mounting example:**
```yaml
services:
  website-backend:
    volumes:
      - /media/tyler/FE645A9A645A558D/public-gallery:/app/photos:ro
      - ./data:/app/data
```

## Network Architecture

### Local Network Access
```
Your Browser → 192.168.1.115:8000 → Website Backend API
```
- Direct access when on home network
- Fast (local speeds)

### Private Remote Access (via NetBird)
```
Your Device (anywhere) → NetBird VPN → fart-pi:8000 → Website Backend API
```
- Peer-to-peer encrypted connection
- No port forwarding needed
- Access via: `http://fart-pi.johnserv.garrepi.dev:8000` or `http://100.124.76.27:8000`

### Public Access (via Cloudflare Tunnel)
```
Visitor's Browser → Cloudflare Edge → Tunnel → Pi → Website Backend API
```
- For public website visitors (tyler-schwenk.com integration)
- No VPN required
- Domain: https://api.tyler-schwenk.com

**NetBird Benefits:**
- No open ports on home router
- End-to-end encrypted (WireGuard)
- Works from anywhere
- Automatic local network optimization
- Part of Bird Wide Web collaborative network

**Cloudflare Tunnel Benefits:**
- Public access without VPN
- Free SSL/TLS certificates
- DDoS protection
- No router configuration

### Service Port Plan

| Service | Port | Local Access | Private Remote | Public Remote |
|---------|------|--------------|----------------|---------------|
| Website Backend | 8000 | Yes | Via NetBird | Via Tunnel |
| Beszel | 8090 | Yes | Via NetBird | No |
| Immich | 2283 | Planned | Planned | No |
| Samba | 445 | Planned | No | No |

## Security Approach

**Remote Access:**
- Private access via NetBird VPN (authenticated peers only)
- Public access via Cloudflare Tunnel — gallery/video reads are public; Public Square reads AND writes (post/comment/vote) are public and rate-limited per IP; admin-only writes (gallery/video management, Public Square moderation) require a JWT
- No ports exposed directly to internet
- No router port forwarding

**Container Isolation:**
- Each service in own container
- Dedicated Docker networks where needed
- Read-only mounts for shared storage

**Secrets Management:**
- Passwords in `.env` files
- `.env` files not committed to Git
- JWT auth for API write operations

**Regular Updates:**
- Docker images kept updated
- Pi OS security updates
- Monitor security advisories

## Backup Strategy (Planned)

### What to Backup
**Critical (daily):**
- Photo library (public-gallery)
- Service databases (website_backend.db)
- User data

**Important (weekly):**
- Service configurations

**Low priority:**
- Cached data
- Thumbnails (can be regenerated)

### Backup Target
- Another Raspberry Pi at parents' house
- Connected via NetBird
- Automated via cron

### Backup Tool
Probably Restic:
- Encrypted backups
- Incremental (deduplication)
- Reliable restore
- Low overhead

## Implementation Status

### Phase 1: Core Infrastructure (COMPLETED)

**Deployed:**
- NetBird VPN (Bird Wide Web connection)
- Website Backend API (FastAPI + SQLite)
  - Photo galleries: 16 albums, 255 photos migrated
  - Public Square routers: Implemented — anonymous posts/comments/votes, admin moderation (see `pi/docs/api/website-backend-api.md`)
- Beszel monitoring
- Cloudflare Tunnel (quick tunnel mode)

**Verified:**
- Gallery API endpoints functional
- Public access via Cloudflare tunnel working
- Automatic thumbnail generation
- NetBird connectivity to John's network
- Beszel monitoring active

### Phase 2: Expand Services (PLANNED)

**Next:**
- Immich photo management
- Samba file sharing
- Off-site backup system
- Consider permanent domain for tunnel

## Open Questions

### Website Backend
- [x] Public Square is anonymous by design — no auth routers, see `pi/docs/api/website-backend-api.md`
- [x] Rate limiting on Public Square post/comment/vote creation, per IP
- [x] Moderation: admin-only hard delete for posts/comments (via the `/admin` panel)
- [ ] Custom domain for permanent tunnel URL
- [ ] Deploy note: `Post`/`Comment` models existed in code (unused) before Public Square shipped. There's no Alembic — `init_db()` only creates missing tables, it won't alter existing ones. Before first deploying the new schema, drop the old (empty) tables on the Pi so they get recreated correctly: `sqlite3 website_backend.db "DROP TABLE IF EXISTS posts; DROP TABLE IF EXISTS comments;"`. Also set `IP_HASH_SALT` in the Pi's `.env` (e.g. `openssl rand -hex 32`) before starting the service.
- [ ] Deploy note: The Kitchen (recipes) adds new tables only (`recipes`, `tags`, `recipe_tags`, `recipe_photos`, including the `recipes.link` column) so `init_db()` creates them automatically on first startup after deploy -- no manual SQL needed **as long as this is the first deploy of the feature**. If `recipes` was already created on the Pi from an earlier deploy (before `link` was added), `init_db()` won't retroactively add the column -- add it manually first: `sqlite3 website_backend.db "ALTER TABLE recipes ADD COLUMN link VARCHAR(500)"`. It does need a new bind mount, `/media/tyler/FE645A9A645A558D/recipe-photos:/app/recipe_photos` (see `docker-compose.yml`); Docker creates that host directory automatically if it doesn't exist yet, but confirm the external SSD is mounted first.

### Future Services
- [ ] Immich: Disable ML on Pi 5 for performance?
- [ ] Storage sizing for Immich
- [ ] Samba security configuration
- [ ] Off-site backup frequency and retention

### Phase 2+: Backups
- [ ] Backup frequency?
- [ ] Retention periods?
- [ ] Test restore how often?

## Key Learning Points

### From Network Discussion
- **NetBird routing**: WireGuard-based peer-to-peer connections
- **Local optimization**: When on same network, stays local
- **Relay servers**: Used as fallback when direct connection fails
- **Signal servers**: Only for initial handshake, not data transfer

### From Docker Discussion
- **Containers are siblings**: Not nested, all at same level
- **This repo is config**: Not a running container itself
- **Volume mounts**: How containers access host filesystem
- **Port mapping**: How host ports reach containers

### From Architecture Discussion
- **Orchestration**: Docker Compose reads configs and manages containers
- **No special container**: NetBird is a container like any other
- **Network paths**: Local traffic stays local, remote goes through NetBird

## Design Principles

1. **Deploy gradually**: One service at a time, test thoroughly
2. **Document reality**: Update docs after implementation, not speculation
3. **Keep it simple**: Avoid premature complexity
4. **Test backups**: Verify restores actually work
5. **Security first**: Default to secure, relax if needed
6. **Monitor everything**: Know when things break

## Resources

- [Docker Compose Docs](https://docs.docker.com/compose/)
- [NetBird Documentation](https://docs.netbird.io/)
- [Raspberry Pi Docs](https://www.raspberrypi.com/documentation/)

---

**Note**: This document will evolve. Current state reflects planning and understanding, not implemented reality. Update after each deployment and based on real-world experience.
