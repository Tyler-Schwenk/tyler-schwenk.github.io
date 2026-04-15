# Cloudflare Tunnel Setup

Cloudflare Tunnel creates a secure connection from your Pi to Cloudflare's edge, allowing public access to your API without exposing ports or configuring port forwarding.

## Current Setup

**Mode:** Named Tunnel (permanent custom domain)
**Status:** Operational
**Domain:** api.tyler-schwenk.com
**Tunnel:** fart-pi-tunnel
**Target:** website-backend-api:8000

See [docs/FORTYLER/custom-domain-setup.md](../FORTYLER/custom-domain-setup.md) for full setup guide.

## Prerequisites

- Docker and Docker Compose
- Website Backend API running on Pi
- Network: Both containers on website-backend_default network

## Benefits

- No port forwarding required
- Free SSL/TLS certificates
- DDoS protection included
- No exposed ports on home router
- Works behind CGNAT
- Can restrict access by country, IP, etc.

## Option 1: Named Tunnel (Current Setup)

Production setup with custom domain (api.tyler-schwenk.com). Permanent URL.

### Setup Steps

1. **Create Cloudflare account** and add your domain

2. **Create tunnel:**
   - Visit https://one.dash.cloudflare.com/
   - Navigate to Networks > Tunnels
   - Create tunnel named `fart-pi-tunnel`
   - Configure published application route:
     - Subdomain: `api`
     - Domain: `tyler-schwenk.com`
     - Service: `HTTP`
     - URL: `website-backend-api:8000`
   - Copy the tunnel token

3. **Update docker-compose.yml:**
```yaml
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared-tunnel
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=${TUNNEL_TOKEN}
    networks:
      - website-backend_default

networks:
  website-backend_default:
    external: true
```

4. **Configure environment:**
```bash
cd ~/tyler-schwenk.github.io/pi/services/cloudflared
echo "TUNNEL_TOKEN=your-token-here" > .env
```

5. **Deploy:**
```bash
docker compose down
docker compose up -d
```

### Result

API accessible at: https://api.tyler-schwenk.com

See [docs/FORTYLER/custom-domain-setup.md](../FORTYLER/custom-domain-setup.md) for complete setup instructions including DNS configuration.

## Option 2: Quick Tunnel (Temporary Alternative)

Fast setup with automatic free .trycloudflare.com subdomain. No Cloudflare account required. URL changes on restart.

**docker-compose.yml:**
```yaml
services:
  cloudflared:
    image: cloudflare/cloudflare:latest
    container_name: cloudflared-tunnel
    restart: unless-stopped
    command: tunnel --url http://website-backend-api:8000
    networks:
      - website-backend_default

networks:
  website-backend_default:
    external: true
```

**Deploy:**
```bash
cd ~/tyler-schwenk.github.io/pi/services/cloudflared
docker compose up -d
docker compose logs -f
```

**Find your URL:**
Look for this in the logs:
```
Your quick Tunnel has been created! Visit it at:
https://random-words-here.trycloudflare.com
```

**Caveat:** URL changes every container restart. Not suitable for production if you need a stable URL.

## Update CORS Configuration

After tunnel is running, update Website Backend API to allow requests from your domain:

```bash
cd ~/tyler-schwenk.github.io/pi/services/website-backend
nano .env
```

Add tunnel domain to CORS_ORIGINS:
```env
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,https://tyler-schwenk.com,https://www.tyler-schwenk.com
```

Restart:
```bash
docker compose restart
```

## Verification

**Check tunnel status:**
```bash
cd ~/tyler-schwenk.github.io/pi/services/cloudflared
docker compose logs
```

Look for: "Registered tunnel connection"

**Test public access:**

From any device:
```bash
curl https://api.tyler-schwenk.com/health
```

Should return:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "..."
}
```

**Test in browser:**
- Health: https://api.tyler-schwenk.com/health
- Galleries: https://api.tyler-schwenk.com/galleries
- API docs: https://api.tyler-schwenk.com/docs

## Security Considerations

**Current Setup (Named Tunnel):**
- Custom domain with SSL/TLS
- No authentication required on public GET endpoints (galleries, health)
- Write operations (POST/PUT/DELETE) require JWT authentication in API
- Can add Cloudflare Zero Trust access policies if needed
- Can add rate limiting via Cloudflare WAF
- Can restrict by country/IP if needed

## Troubleshooting

**Tunnel not starting:**
```bash
docker compose logs cloudflared
```

Common issues:
- Website Backend API container not running
- Network isolation (containers not on same network)
- Port conflict

**Error 1033 or 502:**

Causes:
- Website Backend API not responding
- Wrong service name in tunnel command
- API container crashed

Fix:
```bash
# Check API is running
docker ps | grep website-backend

# Test API locally
curl http://localhost:8000/health

# Restart both services
cd ~/tyler-schwenk.github.io/pi/services/website-backend
docker compose restart
cd ~/tyler-schwenk.github.io/pi/services/cloudflared
docker compose restart
```

**CORS errors:**

If frontend gets blocked:
1. Add domain to CORS_ORIGINS in website-backend/.env (tyler-schwenk.com, www.tyler-schwenk.com)
2. Ensure protocol matches (https)
3. Restart API container

## Monitoring

**Check tunnel health:**
```bash
docker ps | grep cloudflared
docker compose logs cloudflared --tail 50
```

Look for "Registered tunnel connection" messages.

**Beszel monitoring:**
- Tunnel container resource usage tracked automatically
- Alerts if container stops

## Cost

Cloudflare Tunnel is **completely free**:
- Quick tunnel: No account required
- Named tunnel: Free with Cloudflare account
- Unlimited bandwidth and requests
- DDoS protection included
- SSL/TLS certificates included
