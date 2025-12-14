# Tyler Schwenk - Portfolio

Modern portfolio website built with Next.js, TypeScript, and Tailwind CSS, showcasing sustainable software development projects.

## 🌐 Live Site
Visit: [tyler-schwenk.github.io](https://tyler-schwenk.github.io)

## 📋 Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Contributing](#contributing)

## 🎯 Overview

Professional portfolio website highlighting sustainable, full-stack software development work through my California General Partnership, [Trade Routes](https://traderoutestcg.com/about).

### Key Projects
- **Ribbit Radar**: Bioacoustic ML algorithm for endangered frog species conservation
- **Trade Routes**: Peer-to-peer marketplace for collectible card trading
- **Pac-Tyler**: Gamified personal challenge mapping every street in San Diego
- **Others**: RoboSub autonomous submarine, Hamming code implementation, and more

## ✨ Features

- **Modern React Framework**: Built with Next.js 16 App Router
- **Static Site Generation**: Optimized for GitHub Pages deployment
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Type Safety**: Full TypeScript implementation
- **Fast Performance**: Static export with optimized builds
- **Automatic Deployment**: GitHub Actions CI/CD pipeline
- **SEO Optimized**: Proper meta tags and semantic HTML

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Deployment**: GitHub Pages
- **CI/CD**: GitHub Actions

## 🚀 Getting Started

### Prerequisites
- Node.js 20.x or higher
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/Tyler-Schwenk/tyler-schwenk.github.io.git
cd tyler-schwenk.github.io

# Run development server
npm run dev

# Build for production
npm run build

# Test production build locally
npm run start
```

Visit [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
tyler-schwenk.github.io/
├── app/                      # Next.js App Router
│   ├── page.tsx             # Home page
│   ├── layout.tsx           # Root layout
│   ├── projects/            # Project detail pages
│   │   ├── ribbit-radar/    # Ribbit Radar project
│   │   ├── trade-routes/    # Trade Routes project
│   │   └── others/          # Other projects
│   └── pac-tyler/           # Pac-Tyler (retro styled)
├── components/              # Reusable React components
│   ├── Navigation.tsx       # Site navigation
│   ├── Footer.tsx           # Footer with contact
│   └── ProjectCard.tsx      # Project showcase card
├── public/                  # Static assets
│   ├── images/              # Project images
│   ├── video/               # Demo videos
│   └── audio/               # Audio files (Pac-Tyler)
├── .github/
│   └── workflows/
│       └── deploy.yml       # GitHub Actions deployment
├── _legacy-reference/       # Old site (not deployed)
├── next.config.ts           # Next.js config (static export)
├── tailwind.config.ts       # Tailwind CSS config
└── tsconfig.json            # TypeScript config
```

## 🚀 Deployment

### Automatic Deployment
- Pushes to `main` trigger GitHub Actions workflow
- Builds static site and deploys to GitHub Pages
- Live at [https://tyler-schwenk.github.io](https://tyler-schwenk.github.io)

### Manual Deployment
```bash
# Build the site
npm run build

# Output goes to ./out directory
# GitHub Actions handles deployment automatically
```

### First-Time Setup
1. Go to repository Settings → Pages
2. Set Source to **GitHub Actions**
3. Push to main branch to trigger deployment

## 🧪 Testing

```bash
# Run linter
npm run lint

# Type check
npm run type-check

# Build (catches build-time errors)
npm run build
```

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## 📝 License

Custom code by Tyler Schwenk - All rights reserved

## 👤 Author

**Tyler Schwenk**
- Website: [tyler-schwenk.github.io](https://tyler-schwenk.github.io)
- LinkedIn: [tyler-schwenk](https://www.linkedin.com/in/tyler-schwenk-939570224/)
- GitHub: [@Tyler-Schwenk](https://github.com/Tyler-Schwenk)
- Email: tylerschwenk1@yahoo.com

---

Built with ❤️ using Next.js, TypeScript, and Tailwind CSS

**Tyler Schwenk**  
Full-Stack Software Developer  
Email: tylerschwenk1@yahoo.com  
[LinkedIn](https://www.linkedin.com/in/tyler-schwenk-939570224/) | [GitHub](https://github.com/Tyler-Schwenk)

---

*Last Updated: December 2025*
