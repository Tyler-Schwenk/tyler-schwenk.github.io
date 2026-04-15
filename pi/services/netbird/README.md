# NetBird VPN Service

NetBird provides secure remote access to fart-pi and enables peer-to-peer connectivity across the Bird Wide Web network.

## Prerequisites

- NetBird account on John's self-hosted instance
- Setup key generated from NetBird dashboard (https://johnserv.garrepi.dev)
- DNS nameservers configured in NetBird dashboard

## Installation Methods

NetBird can be deployed either as:
- **System Service** (recommended for fart-pi) - Native installation
- **Docker Container** - Containerized deployment

### fart-pi Current Setup

fart-pi uses NetBird as a **system service** installed via the official installer.

## Configuration

### Step 1: Configure DNS Nameservers (Required)

Before connecting peers, configure DNS in the NetBird dashboard to avoid DNS resolution failures:

1. Log in to the NetBird dashboard at **https://johnserv.garrepi.dev**
2. Navigate to **DNS** → **Nameservers**
3. Click **Add Nameserver Group**
4. Configure:
   - **Name**: "Default DNS" or "Public DNS"
   - **Nameservers**: Add upstream DNS servers:
     - `192.168.1.254` (local router - for LAN name resolution)
     - `8.8.8.8` (Google Public DNS)
     - `1.1.1.1` (Cloudflare DNS)
   - **Groups/Peers**: Assign to "All" or specific groups
   - **Domains**: Leave empty for all queries, or specify domains for split DNS
5. Click **Save**

Without this configuration, NetBird will manage DNS but have no upstream servers, causing DNS resolution failures.

### Step 2: Generate Setup Key

1. Log in to the NetBird dashboard at **https://johnserv.garrepi.dev**
2. Navigate to **Setup Keys**
3. Click **Create Setup Key**
4. Configure:
   - **Name**: fart-pi (or descriptive name)
   - **Type**: Reusable (allows service restarts)
   - **Expiration**: Choose appropriate duration
   - **Auto-assign groups**: Optional
5. Copy the generated setup key

### Step 3: Install NetBird (System Service)

On fart-pi, install NetBird as a system service:

```bash
# Install NetBird
curl -fsSL https://pkgs.netbird.io/install.sh | sh

# Connect using setup key
sudo netbird up --setup-key YOUR_SETUP_KEY_HERE

# Enable service to start on boot
sudo systemctl enable netbird

# Check status
sudo netbird status
```

### Alternative: Docker Deployment

For Docker-based deployment, configure the environment:

```bash
cp .env.example .env
nano .env
```

Add your setup key:

```
NB_SETUP_KEY=your-setup-key-here
```

Deploy:

```bash
docker compose up -d
docker compose logs -f
docker exec netbird netbird status
```

## Usage

### SSH Access

Once deployed, you can SSH from anywhere on the NetBird network:

```bash
# Using NetBird hostname
ssh tyler@fart-pi.johnserv.garrepi.dev

# Using NetBird IP
ssh tyler@100.124.76.27
```

### Access Services via NetBird

Services running on the Pi can be accessed via NetBird:

```
http://fart-pi.johnserv.garrepi.dev:8000      # Website Backend API
http://fart-pi.johnserv.garrepi.dev:8090      # Beszel
http://100.124.76.27:8000                     # Website Backend API (by IP)
http://100.124.76.27:8090                     # Beszel (by IP)
```

## Network Configuration

### DNS Management

NetBird manages DNS on connected peers:

- Creates `/etc/resolv.conf.original.netbird` backup of original configuration
- Overwrites `/etc/resolv.conf` with NetBird DNS server (peer's NetBird IP)
- NetBird DNS server binds to the peer's NetBird IP on port 53
- NetBird DNS forwards queries to configured upstream nameservers
- Provides split-horizon DNS for internal network names (*.johnserv.garrepi.dev)

**Important Limitation**: Due to WireGuard's point-to-point interface design, a peer cannot reach its own NetBird IP locally. This means:
- Remote peers can use the NetBird DNS server successfully
- The local peer cannot query its own NetBird DNS server
- **Fallback DNS servers are required** in `/etc/resolv.conf` for local DNS resolution

Required DNS nameserver configuration in dashboard plus fallback DNS in resolv.conf.

### Peer-to-Peer Connectivity

NetBird establishes direct peer-to-peer connections when possible:

- **Relay**: Used when direct connection not possible
- **Direct**: Peer-to-peer encrypted tunnel
- Check connection type: `sudo netbird status` (system service) or `docker exec netbird netbird status` (Docker)

## NetBird Dashboard

Access the dashboard at **https://johnserv.garrepi.dev** to:

- View connected peers
- Manage access control policies
- Configure DNS settings
- Set up network routes
- Monitor peer status and activity

## Troubleshooting

### DNS Resolution Failures

**Symptom**: `ping google.com` fails with "Temporary failure in name resolution" even though `sudo netbird status` shows "Nameservers: X/X Available"

**Root Cause**: NetBird DNS binds to the peer's NetBird IP address on port 53. Due to WireGuard's point-to-point interface design, the local machine cannot reach its own NetBird IP. This means:
- NetBird DNS server works correctly for **remote peers** accessing it over the VPN
- The **local machine** cannot query its own NetBird DNS server
- DNS resolution fails locally even though the server is running and configured

**Diagnosis**:
```bash
# Check NetBird DNS status
sudo netbird status
# Should show "Nameservers: X/X Available" (good - nameservers configured)

# Check resolv.conf
cat /etc/resolv.conf
# Shows only NetBird DNS server (peer's NetBird IP)

# Test connectivity to local NetBird IP
ping -c 2 100.124.76.27
# Will show 100% packet loss (cannot reach own NetBird IP locally)

# Verify NetBird DNS is listening
sudo ss -tulpn | grep :53
# Shows NetBird listening on 100.124.76.27:53
```

**Solution**: Add fallback DNS servers to `/etc/resolv.conf` so the system can resolve DNS when NetBird DNS is unreachable:

```bash
# Edit resolv.conf with fallback DNS servers
sudo bash -c 'cat > /etc/resolv.conf << EOF
# Generated by NetBird
# The original file can be restored from /etc/resolv.conf.original.netbird

search johnserv.garrepi.dev attlocal.net
nameserver 100.124.76.27
nameserver 8.8.8.8
nameserver 1.1.1.1
EOF'

# Test DNS resolution
ping -c 3 google.com
```

**Note**: NetBird regenerates `/etc/resolv.conf` on service restarts and may overwrite this configuration. If DNS breaks after NetBird restarts, reapply the fallback DNS servers.

**Persistent Solution**: fart-pi uses a systemd override to automatically add fallback DNS after NetBird starts.

The fix script at `/usr/local/bin/netbird-dns-fix.sh`:
```bash
#!/bin/bash
# Wait for NetBird to generate resolv.conf
sleep 3

# Add fallback DNS if not already present
if ! grep -q "nameserver 8.8.8.8" /etc/resolv.conf; then
    cat >> /etc/resolv.conf << EOFINNER
nameserver 8.8.8.8
nameserver 1.1.1.1
EOFINNER
fi
```

Systemd override at `/etc/systemd/system/netbird.service.d/override.conf`:
```ini
[Service]
ExecStartPost=/usr/local/bin/netbird-dns-fix.sh
```

This automatically adds fallback DNS servers every time NetBird starts, ensuring DNS always works.

### No Upstream DNS Configured

**Symptom**: `sudo netbird status` shows "Nameservers: 0/0 Available"

**Cause**: No nameservers configured in NetBird dashboard

**Solution**: Configure DNS nameservers in the NetBird dashboard (see Step 1 in Configuration section), then restart NetBird:
```bash
sudo systemctl restart netbird
sudo netbird status  # Should now show "Nameservers: X/X Available"
```

### Check Connection Status (System Service)

```bash
sudo netbird status
sudo systemctl status netbird
sudo journalctl -u netbird -n 50
```

### Check Connection Status (Docker)

```bash
docker compose logs
docker exec netbird netbird status
```

### Restart NetBird (System Service)

```bash
sudo systemctl restart netbird
sudo netbird status
```

### Restart NetBird (Docker)

```bash
docker compose restart
```

### Reset Connection (System Service)

```bash
sudo netbird down
sudo netbird up
```

### Reset Connection (Docker)

```bash
docker compose down
docker compose up -d
```

## Network Information

- **Network**: Bird Wide Web
- **Domain**: johnserv.garrepi.dev
- **fart-pi NetBird IP**: 100.124.76.27
- **fart-pi Installation**: System service (native binary)
- **Management Server**: https://johnserv.garrepi.dev:443 (self-hosted by John)

## fart-pi Details

- **Version**: 0.66.2
- **FQDN**: fart-pi.johnserv.garrepi.dev
- **NetBird IP**: 100.124.76.27/16
- **Interface**: wt0 (WireGuard kernel interface)
- **Interface Type**: Kernel
- **Installation Method**: System service via official installer
- **Service File**: /etc/systemd/system/netbird.service
- **Service Override**: /etc/systemd/system/netbird.service.d/override.conf (DNS fix automation)
- **DNS Fix Script**: /usr/local/bin/netbird-dns-fix.sh
- **DNS Configuration**: NetBird DNS with automatic fallback to public DNS servers
- **Nameservers**: 3 configured (Quad9, Google, Cloudflare) plus local router

### Current resolv.conf Configuration

```
search johnserv.garrepi.dev attlocal.net
nameserver 100.124.76.27    # NetBird DNS (unreachable locally)
nameserver 8.8.8.8           # Google DNS (fallback, auto-added on restart)
nameserver 1.1.1.1           # Cloudflare DNS (fallback, auto-added on restart)
```

## Connected Peers

- **JohnSERV**: 100.124.56.240 (johnserv.johnserv.garrepi.dev)
- **JohnNAS**: Check NetBird dashboard
- **Bebop**: Check NetBird dashboard

## Security Notes

- NetBird uses WireGuard protocol for encryption
- All traffic is end-to-end encrypted
- Setup keys should be kept secure and rotated periodically
- Access control policies can be configured in the dashboard
- Self-hosted management server means full control and privacy
