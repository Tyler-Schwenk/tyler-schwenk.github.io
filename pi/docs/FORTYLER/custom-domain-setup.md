# Custom Domain Setup Guide

**Status:** Completed ✓

This guide documents the setup of tyler-schwenk.com with Cloudflare DNS and named tunnel.

**Current Configuration:**
- Frontend: https://tyler-schwenk.com (GitHub Pages)
- API: https://api.tyler-schwenk.com (Pi via Cloudflare Tunnel)

Use this as a reference for future domain setups or troubleshooting.

## Overview

**Domain:** tyler-schwenk.com (purchased from Porkbun)
**DNS Provider:** Cloudflare (free plan)
**Frontend:** tyler-schwenk.com → GitHub Pages
**API:** api.tyler-schwenk.com → Raspberry Pi via named tunnel

## Prerequisites

- Domain purchased and active (tyler-schwenk.com from Porkbun)
- Cloudflare account created
- GitHub repository with Pages enabled (tyler-schwenk.github.io)
- Pi with Website Backend API running

## Phase 1: Cloudflare DNS Setup

### Step 1: Add Domain to Cloudflare

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click "Add a site" (top right)
3. Enter `tyler-schwenk.com` and click "Continue"
4. Select **Free plan** and click "Continue"
5. Cloudflare scans DNS records (ignore Porkbun defaults)
6. Click "Continue"

### Step 2: Update Nameservers at Porkbun

Cloudflare shows you 2 nameservers (like `eva.ns.cloudflare.com` and `rene.ns.cloudflare.com`).

1. Copy both nameserver addresses
2. Go to [Porkbun](https://porkbun.com/) and log in
3. Click on your domain `tyler-schwenk.com`
4. Find "Nameservers" section
5. Change from Porkbun nameservers to Cloudflare nameservers:
   - Remove all existing nameservers
   - Add the 2 Cloudflare nameservers
6. Click "Save"

### Step 3: Wait for Activation

- Takes 5-30 minutes typically
- Cloudflare will email you when active
- Check status in Cloudflare dashboard (will change from "Pending" to "Active")
- You can continue to next steps while waiting

## Phase 2: GitHub Pages Custom Domain

### Step 1: Configure DNS Records in Cloudflare

Once domain is active in Cloudflare:

1. Go to Cloudflare dashboard for tyler-schwenk.com
2. Navigate to **DNS > Records**
3. Add the following records:

**Root domain (tyler-schwenk.com):**
```
Type:  A
Name:  @
Content: 185.199.108.153
TTL: Auto
Proxy: DNS only (gray cloud)
```

Add 3 more A records with same settings but different IPs:
- 185.199.109.153
- 185.199.110.153  
- 185.199.111.153

**WWW subdomain:**
```
Type: CNAME
Name: www
Content: tyler-schwenk.github.io
TTL: Auto
Proxy: DNS only (gray cloud)
```

**Important:** Use "DNS only" (gray cloud icon), NOT "Proxied" (orange cloud).

### Step 2: Configure GitHub Pages

1. Go to your GitHub repository [tyler-schwenk/tyler-schwenk.github.io](https://github.com/tyler-schwenk/tyler-schwenk.github.io)
2. Navigate to **Settings > Pages**
3. Under "Custom domain":
   - Enter `tyler-schwenk.com`
   - Click "Save"
4. Wait for DNS check (takes 1-5 minutes)
5. Once verified, check "Enforce HTTPS"

**Verification:** Visit https://tyler-schwenk.com - should show your website

## Phase 3: Named Tunnel for API

### Step 1: Create Named Tunnel in Cloudflare

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Networks > Tunnels**
3. Click "Create a tunnel"
4. Select **Cloudflared** connector type
5. Name it `fart-pi-api-tunnel`
6. Click "Save tunnel"
7. **Copy the tunnel token** (long string starting with `eyJ...`)
   - Save this somewhere safe, you'll need it for docker-compose.yml

### Step 2: Configure Tunnel Hostname

Still in the tunnel creation wizard:

1. Under "Public Hostname", click "Add a public hostname"
2. Configure:
   - **Subdomain:** `api`
   - **Domain:** `tyler-schwenk.com` (select from dropdown)
   - **Path:** leave empty
   - **Service Type:** `HTTP`
   - **URL:** `website-backend-api:8000`
3. Click "Save hostname"

Cloudflare automatically creates the DNS record `api.tyler-schwenk.com` (you'll see it in DNS > Records).

### Step 3: Update Docker Compose on Pi

SSH to your Pi and update the docker-compose.yml:

```bash
cd ~/tyler-schwenk.github.io/pi/services/cloudflared
nano docker-compose.yml
```

Replace contents with:

```yaml
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared-tunnel
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=YOUR_TUNNEL_TOKEN_HERE
    networks:
      - website-backend_default

networks:
  website-backend_default:
    external: true
```

Replace `YOUR_TUNNEL_TOKEN_HERE` with the token you copied earlier.

Better: Use environment file:

```bash
# Create .env file
echo "TUNNEL_TOKEN=your_token_here" > .env

# Update docker-compose.yml to reference it
nano docker-compose.yml
```

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

### Step 4: Restart Tunnel

```bash
docker compose down
docker compose up -d
docker compose logs -f
```

Look for:
```
Registered tunnel connection
```

### Step 5: Test API Access

```bash
curl https://api.tyler-schwenk.com/health
```

Should return:
```json
{"status":"healthy","version":"1.0.0","timestamp":"..."}
```

## Phase 4: Update CORS Configuration

Update CORS to allow requests from your custom domain:

```bash
cd ~/tyler-schwenk.github.io/pi/services/website-backend
nano .env
```

Update CORS_ORIGINS:
```
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,https://tyler-schwenk.com,https://www.tyler-schwenk.com,https://tyler-schwenk.github.io
```

Restart API:
```bash
docker compose restart
```

## Phase 5: OAuth Setup (After Domain is Live)

With a stable domain, you can now set up OAuth authentication.

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project or select existing
3. Enable Google+ API
4. Go to **Credentials > Create Credentials > OAuth 2.0 Client ID**
5. Configure:
   - Application type: Web application
   - Name: "Tyler Schwenk Portfolio"
   - Authorized redirect URIs:
     - `https://api.tyler-schwenk.com/auth/google/callback`
   - Authorized JavaScript origins:
     - `https://tyler-schwenk.com`
     - `https://www.tyler-schwenk.com`
6. Copy Client ID and Client Secret
7. Add to Pi `.env` file:
   ```
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   ```

### GitHub OAuth

1. Go to [GitHub Settings](https://github.com/settings/developers)
2. Click **OAuth Apps > New OAuth App**
3. Configure:
   - Application name: "Tyler Schwenk Portfolio"
   - Homepage URL: `https://tyler-schwenk.com`
   - Authorization callback URL: `https://api.tyler-schwenk.com/auth/github/callback`
4. Click "Register application"
5. Copy Client ID
6. Generate and copy Client Secret
7. Add to Pi `.env` file:
   ```
   GITHUB_CLIENT_ID=your_client_id_here
   GITHUB_CLIENT_SECRET=your_client_secret_here
   ```

### Implement OAuth Routers

Use the fastapi-users library to implement OAuth authentication endpoints. See the fastapi-users documentation for Google and GitHub OAuth provider setup.

## Verification Checklist

- [ ] Domain active in Cloudflare (no longer shows "Pending")
- [ ] https://tyler-schwenk.com shows your website (from GitHub Pages)
- [ ] https://www.tyler-schwenk.com redirects to https://tyler-schwenk.com
- [ ] https://api.tyler-schwenk.com/health returns JSON
- [ ] https://api.tyler-schwenk.com/galleries returns array of galleries
- [ ] https://api.tyler-schwenk.com/docs shows API documentation
- [ ] Named tunnel shows "Healthy" in Cloudflare dashboard
- [ ] CORS allows requests from tyler-schwenk.com
- [ ] OAuth apps created (if implementing authentication)

## Troubleshooting

### Domain not active yet
- Wait 30 minutes after changing nameservers
- Verify nameservers with: `dig tyler-schwenk.com NS`
- Should show Cloudflare nameservers

### GitHub Pages not loading
- Verify A records are correct (4 GitHub IPs)
- Verify "DNS only" mode (gray cloud), not "Proxied"
- Check GitHub Pages settings show "DNS check successful"

### API not accessible
- Check tunnel status: `docker compose logs` in cloudflared directory
- Verify tunnel shows "Healthy" in Cloudflare dashboard
- Check api.tyler-schwenk.com DNS record exists (auto-created by tunnel)
- Test from Pi: `curl http://localhost:8000/health` should work

### CORS errors
- Verify CORS_ORIGINS includes tyler-schwenk.com
- Restart website-backend after changing .env
- Check browser console for specific CORS error

## Cost Summary

- Domain: $9-10/year (Porkbun)
- Cloudflare DNS: Free
- Cloudflare Tunnel: Free
- GitHub Pages: Free
- **Total: ~$10/year**

## Next Steps

After domain is fully set up:
1. Update frontend (tyler-schwenk.github.io) to use api.tyler-schwenk.com
2. Remove static gallery photos from frontend repo
3. Implement OAuth authentication routers
4. Add rate limiting and spam prevention
5. Update all documentation with new URLs
