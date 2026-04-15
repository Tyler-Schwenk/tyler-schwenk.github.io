# Immich

Self-hosted photo and video management solution with automatic backup from mobile devices.

## Features

- Automatic mobile backup (iOS and Android apps)
- Face detection and recognition
- Object recognition
- Duplicate detection
- Photo search
- Albums and sharing
- Timeline view
- Raw photo support
- Video support with transcoding

## Current Status

**Status:** Not deployed yet

## Deployment

### Prerequisites

1. External SSD mounted at `/media/tyler/FE645A9A645A558D/`
2. Docker and Docker Compose installed

### Initial Setup

On Pi:

```bash
cd ~/tyler-schwenk.github.io/pi/services/immich

# Create .env from example
cp .env.example .env

# Edit .env and set secure database password
nano .env
# Change DB_PASSWORD to a strong random password
```

### Start Services

```bash
docker compose up -d
```

Wait 1-2 minutes for all containers to start and initialize the database.

### Verify Deployment

Check all containers are running:

```bash
docker compose ps
```

Should show 5 containers:
- immich-server (port 2283)
- immich-microservices
- immich-machine-learning
- immich-redis
- immich-postgres

View logs:

```bash
docker compose logs -f
```

### Access Immich

**Via NetBird:**
- URL: http://100.124.76.27:2283

**Via Local Network:**
- URL: http://192.168.1.116:2283

On first visit, create an admin account.

### Mobile App Setup

1. Download Immich app from App Store or Google Play
2. Open app and connect to server
3. Server URL: `http://100.124.76.27:2283` (via NetBird)
4. Login with admin credentials
5. Enable automatic backup in settings

**Note:** For backup to work outside home network, ensure NetBird is running on your phone.

## Storage

**Photos stored at:** `/media/tyler/FE645A9A645A558D/photos/`

This directory structure is created by Immich:
```
photos/
├── library/          # Uploaded photos organized by user
├── thumbs/           # Generated thumbnails
├── encoded-video/    # Transcoded videos
└── upload/           # Temporary upload location
```

**Database:** `./postgres/` (PostgreSQL data)
**ML Cache:** `./cache/` (Machine learning models)

## Performance Notes

### Raspberry Pi 5 Considerations

**Machine Learning:**
- Face detection and object recognition work but are CPU-intensive
- Initial ML processing happens on upload and may take time
- Background jobs run continuously for new uploads
- Monitor with `htop` or Beszel if performance issues occur

**Recommended Settings:**
- Keep ML enabled unless Pi performance suffers
- Limit concurrent uploads from mobile app
- Schedule bulk uploads during off-peak hours

**If Performance Issues:**
Edit `.env` and set:
```bash
MACHINE_LEARNING_ENABLED=false
```

Then restart:
```bash
docker compose restart
```

## Backup

Immich database and photos should be backed up regularly.

### Backup Photos

Photos are stored on external SSD. Backup entire directory:

```bash
rsync -avh /media/tyler/FE645A9A645A558D/photos/ /backup/location/
```

### Backup Database

```bash
# Stop Immich
docker compose down

# Backup postgres directory
tar -czf immich-db-backup-$(date +%Y%m%d).tar.gz ./postgres/

# Restart Immich
docker compose up -d
```

**Recommended:** Set up automated backups via cron or Restic to off-site location.

## Updating Immich

```bash
cd ~/tyler-schwenk.github.io/pi/services/immich

# Pull latest images
docker compose pull

# Restart with new images
docker compose down
docker compose up -d

# Check logs
docker compose logs -f
```

Immich updates frequently. Check release notes at https://github.com/immich-app/immich/releases

## Troubleshooting

### Containers won't start

Check logs:
```bash
docker compose logs
```

Common issues:
- Database password incorrect in .env
- Upload directory permissions

### ML features not working

Check immich-machine-learning logs:
```bash
docker compose logs immich-machine-learning
```

ML models download on first start (~1-2GB). May take time on first run.

### Mobile app can't connect

- Verify NetBird is running on phone
- Verify server URL is correct: `http://100.124.76.27:2283`
- Check firewall isn't blocking port 2283
- Test from Pi: `curl http://localhost:2283`

### Out of storage space

Check disk usage:
```bash
df -h /media/tyler/FE645A9A645A558D/
du -sh /media/tyler/FE645A9A645A558D/photos/*
```

External SSD has 193GB. Monitor usage and upgrade if needed.

## Resources

- Official documentation: https://immich.app/docs
- GitHub: https://github.com/immich-app/immich
- Mobile apps: Search "Immich" in App Store or Google Play
- Community: https://discord.gg/immich

## Network Access

**Private (NetBird):**
- From Bebop: http://100.124.76.27:2283
- From JohnSERV: http://100.124.76.27:2283

**Local Network:**
- From home devices: http://192.168.1.116:2283

**Not publicly accessible** - Immich contains personal photos and should remain private.

## Security

- Keep admin password secure
- Don't expose port 2283 to public internet
- Use NetBird for remote access
- Consider setting up additional user accounts for family members
- Enable 2FA if available in future Immich versions

## Advanced Configuration

### Custom ML Settings

Edit `docker-compose.yml` immich-machine-learning environment:

```yaml
environment:
  - MACHINE_LEARNING_WORKERS=1  # Reduce for lower CPU usage
  - MACHINE_LEARNING_WORKER_TIMEOUT=120
```

### External Typesense Search

For advanced search features, enable Typesense (optional):

1. Uncomment Typesense service in docker-compose.yml
2. Set TYPESENSE_ENABLED=true in .env
3. Generate random TYPESENSE_API_KEY
4. Restart services

Adds ~500MB RAM usage.

## Migration from Google Photos

Use Immich's import tool to migrate from Google Photos:

1. Download Google Takeout archive
2. Use immich-CLI to bulk upload: https://immich.app/docs/features/command-line-interface
3. Or manually upload via web UI

Preserve metadata with proper import process.
