# tyler-schwenk.github.io

Monorepo for tyler-schwenk.com — personal website frontend and Raspberry Pi home server backend.
reedpeloy pls

redeploy... or else

## Structure

```
tyler-schwenk.github.io/
├── website/   Next.js frontend — deployed to tyler-schwenk.com via GitHub Pages
└── pi/        Raspberry Pi 5 backend — Docker services + FastAPI, run on fart-pi
```

## website/

Static Next.js 16 site deployed to [tyler-schwenk.com](https://tyler-schwenk.com) automatically on every push to `main` via GitHub Actions.

- Framework: Next.js 16 (static export, App Router)
- Hosting: GitHub Pages
- API: Fetches dynamic content from `https://api.tyler-schwenk.com` at runtime
- Docs: `website/docs/`

To run locally:

```bash
cd website
npm install
npm run dev
```

## pi/

Configuration and code for **fart-pi** (Raspberry Pi 5 home server). Contains Docker Compose service definitions and the FastAPI backend that powers the site's photo galleries, video hosting, and Public Square forum.

- Public API: `https://api.tyler-schwenk.com` (via Cloudflare Tunnel)
- Private access: `ssh tyler@100.124.76.27` (NetBird VPN)
- Docs: `pi/docs/`

To deploy or update services, SSH to fart-pi. On first setup, use sparse checkout so only `pi/` is downloaded (not the full frontend):

```bash
ssh tyler@100.124.76.27
# First-time setup (sparse checkout — only clones pi/, skips website/)
git clone --filter=blob:none --no-checkout https://github.com/Tyler-Schwenk/tyler-schwenk.github.io.git ~/tyler-schwenk.github.io
cd ~/tyler-schwenk.github.io
git sparse-checkout init --cone
git sparse-checkout set pi
git checkout main

# Ongoing updates
cd ~/tyler-schwenk.github.io && git pull
cd pi/services/<service-name>
docker compose up -d
```

See [pi/docs/internal/deployment.md](pi/docs/internal/deployment.md) for full deployment guide.
