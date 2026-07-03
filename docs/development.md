## This is for tyler to use himself whikle dvelopmeing

# SSH to Pi
Netbird: CURRENTLY BROKEN!
ssh tyler@100.124.76.27

Ethernet:
ssh tyler@192.168.1.116

WiFi:
ssh tyler@192.168.1.115
 
## Frontend deploy
 Push to main (deploys frontend automatically):
git add .
git commit -m "add chunked video upload"
git push


## Backend deploy
 Pull and restart on fart-pi:

first connect to netbird on laptop

ssh tyler@192.168.1.116
cd ~/tyler-schwenk.github.io && git pull
cd pi/services/website-backend
docker compose up -d --build


docker compose ps
docker compose logs -f    # Ctrl+C to stop tailing
curl http://localhost:8000/health
