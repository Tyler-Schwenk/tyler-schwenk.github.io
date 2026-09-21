# Immich Photo Management Setup

Quick guide for deploying Immich on fart-pi.

## What is Immich?

Self-hosted alternative to Google Photos with:
- Automatic phone backup (iOS and Android)
- Face recognition
- Object recognition
- Timeline view
- Album management
- Sharing

## Quick Deploy

### 1. SSH to Pi

From the home network:
```bash
ssh tyler@192.168.1.116
```

### 2. Navigate to Immich

```bash
cd ~/tyler-schwenk.github.io/pi/services/immich
```

### 3. Create Environment File

```bash
cp .env.example .env
nano .env
```

**Change this line:**
```
DB_PASSWORD=CHANGE_THIS_TO_SECURE_PASSWORD
```

To a strong random password (save it somewhere safe).

**Optional:** Set `MACHINE_LEARNING_ENABLED=false` if you want better performance (disables face detection).

Save with `Ctrl+X`, then `Y`, then `Enter`.

### 4. Deploy

```bash
docker compose up -d
```

Wait 1-2 minutes for all containers to start.

### 5. Check Status

```bash
docker compose ps
```

Should show 5 containers running:
- immich-server
- immich-microservices  
- immich-machine-learning
- immich-redis
- immich-postgres

View logs:
```bash
docker compose logs -f
```

Press `Ctrl+C` to exit logs.

### 6. Access Immich

Open browser (on the home network) and go to:
- http://192.168.1.116:2283

Create admin account on first visit.

## Mobile App Setup

### iPhone/iPad

1. Download "Immich" from App Store
2. Open app
3. Tap "Connect to server"
4. Enter server URL: `http://192.168.1.116:2283`
5. Login with admin credentials
6. Enable automatic backup in settings

### Android

1. Download "Immich" from Google Play
2. Same steps as iPhone

**Note:** Backup only runs while the phone is on the home network. Immich isn't reachable from outside the LAN.

## Storage Location

Photos stored at: `/media/tyler/FE645A9A645A558D/photos/`

Check disk usage:
```bash
df -h /media/tyler/FE645A9A645A558D/
```

External SSD has 193GB total. Monitor as your photo library grows.

## Common Commands

**Start Immich:**
```bash
cd ~/tyler-schwenk.github.io/pi/services/immich
docker compose up -d
```

**Stop Immich:**
```bash
docker compose down
```

**View logs:**
```bash
docker compose logs -f
```

**Restart (after changing settings):**
```bash
docker compose restart
```

**Update to latest version:**
```bash
docker compose pull
docker compose down
docker compose up -d
```

## Troubleshooting

### Can't connect from mobile app

1. Check the phone is on the home Wi-Fi (Immich is LAN-only)
2. Verify Pi is accessible: ping `192.168.1.116`
3. Check Immich is running: `docker compose ps`
4. Try the URL directly in a browser: `http://192.168.1.116:2283`

### ML features using too much CPU

Edit `.env` and set:
```
MACHINE_LEARNING_ENABLED=false
```

Then restart:
```bash
docker compose restart
```

Face detection and object recognition will be disabled, but basic functionality remains.

### Running out of disk space

Check what's using space:
```bash
du -sh /media/tyler/FE645A9A645A558D/photos/*
```

Options:
- Delete unwanted photos via Immich web UI
- Archive old photos to external backup
- Upgrade to larger SSD

## Backup

Photos are stored on external SSD. Set up regular backups to prevent data loss.

Simple backup to USB drive:
```bash
rsync -avh /media/tyler/FE645A9A645A558D/photos/ /path/to/backup/
```

## Resources

- Full documentation: [services/immich/README.md](README.md)
- Official docs: https://immich.app/docs
- Mobile apps: Search "Immich" in app store

## Next Steps After Setup

1. **Configure backup settings** in mobile app
2. **Create albums** for organization
3. **Set up sharing** with family/friends
4. **Configure backup schedule** for Pi photos folder
5. **Monitor disk usage** periodically

That's it! Your personal photo cloud is ready.
