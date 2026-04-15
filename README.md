# tyler-schwenk.github.io

Monorepo for tyler-schwenk.com — personal website frontend and Raspberry Pi home server backend.

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

To deploy or update services, SSH to fart-pi and pull this repo:

```bash
ssh tyler@100.124.76.27
cd ~/tyler-schwenk.github.io
git pull
cd pi/services/<service-name>
docker compose up -d
```

See [pi/docs/internal/deployment.md](pi/docs/internal/deployment.md) for full deployment guide.
