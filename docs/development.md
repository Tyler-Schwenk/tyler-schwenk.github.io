## This is for tyler to use himself whikle dvelopmeing
 
## Frontend deploy
 Push to main (deploys frontend automatically):
git add .
git commit -m "add chunked video upload"
git push


## Backend deploy
 Pull and restart on fart-pi:

first connect to netbird on laptop

 ssh tyler@100.124.76.27
cd ~/tyler-schwenk.github.io && git pull
cd pi/services/website-backend
docker compose up -d --build

