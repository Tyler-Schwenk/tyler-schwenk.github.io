# Contributing to Tyler Schwenk Portfolio

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Tyler-Schwenk/tyler-schwenk.github.io.git
   cd tyler-schwenk.github.io
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

4. **Open browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
├── app/                  # Next.js App Router pages
│   ├── page.tsx         # Home page
│   ├── layout.tsx       # Root layout
│   ├── projects/        # Project pages
│   └── pac-tyler/       # Pac-Tyler page (retro styling)
├── components/          # Reusable React components
├── public/              # Static assets (images, videos, audio)
├── .github/workflows/   # GitHub Actions deployment
└── _legacy-reference/   # Old site for reference (not deployed)
```

## Coding Standards

- **TypeScript**: Use TypeScript for type safety
- **Components**: Keep components small and focused
- **Styling**: Use Tailwind CSS utility classes
- **Formatting**: Code is auto-formatted with Prettier
- **Linting**: ESLint runs automatically

## Making Changes

1. Create a feature branch
2. Make your changes
3. Test locally with `npm run build`
4. Commit with descriptive messages
5. Push and create a PR

## Deployment

- Pushes to `main` automatically deploy via GitHub Actions
- View deployment status in Actions tab
- Site deploys to https://tyler-schwenk.github.io
