## This is for tyler to use himself whikle dvelopmeing

# SSH to Pi
Must be on the home network (192.168.1.0/24).

Ethernet (primary):
ssh tyler@192.168.1.116

WiFi (DHCP, address drifts - check `ip -4 -br addr` on the Pi or the router):
ssh tyler@192.168.1.167
 
## Frontend deploy
 Push to main (deploys frontend automatically):
git add .
git commit -m "add chunked video upload"
git push


## Backend deploy
 Pull and restart on fart-pi:

ssh tyler@192.168.1.116
cd ~/tyler-schwenk.github.io && git pull
cd pi/services/website-backend
docker compose up -d --build


docker compose ps
docker compose logs -f    # Ctrl+C to stop tailing
curl http://localhost:8000/health
