# Claude Code Instructions

## Project Overview

Personal website and home server monorepo for tyler-schwenk.com.

### Repository Structure

```
tyler-schwenk.github.io/      (monorepo root)
├── website/                   Next.js frontend, deployed to GitHub Pages
└── pi/                        Raspberry Pi 5 backend (Docker services + FastAPI)
```

- **website/** — Next.js static site (`output: 'export'`). Deployed automatically to tyler-schwenk.com via GitHub Actions on push to main.
- **pi/** — FastAPI backend + Docker Compose configs for fart-pi home server. Pulled and run on the Pi separately.

### Documentation

Each subproject has its own `docs/` folder co-located with its code:

- `website/docs/` — Frontend documentation (gallery, SEO, routing, etc.)
- `pi/docs/` — Backend documentation (API reference, architecture, deployment, services)

These docs are authoritative and must be referenced before making changes. Keep them up to date as changes are made — add new docs as needed, remove docs that are no longer accurate or redundant.

In-code docstrings must always be accurate and up to date.

---

## Global Coding Rules

1. Use clear, well-structured code that prioritizes readability, reuse, and correctness.
2. Avoid deep nesting — max 3 indentation levels. Prefer early returns and helper functions over nesting.
3. No magic numbers — all constants must be named and centralized.
4. No emojis anywhere in code, logs, comments, or documentation.
5. Reuse existing code whenever possible. Reduce duplication.
6. Optimize for long-term maintainability and readability.
7. Do not document change history or current changes. Only document how the system works today — focus on data formats, schemas, APIs, and behavior.
8. When modifying a file, read the entire file first and ensure no compile, runtime, or logical errors are introduced.
9. All functions and classes must have docstrings (Python: PEP 257, Google or NumPy style; JS/TS: JSDoc). Docstrings must describe purpose, inputs, outputs, and side effects if any.
10. Comments explain WHY, not WHAT. Only comment when it adds real value.
11. Comments and docstrings use casual, conversational style — lowercase preferred except for proper nouns and acronyms. Brief and direct, no fluff. Use contractions. Talk like explaining to a teammate.
12. Constants with units get unit suffixes: `_s`, `_ms`, `_m`, `_px`, etc.
13. All imports at the top of the file unless there is a very specific reason otherwise.
14. Error messages must explain what failed, why, and what to do next. Vague errors are useless.
15. Code must be deterministic and reproducible — no implicit global state, user shell config, or interactive input unless explicitly stated.
16. Code must be idempotent when applicable (scripts, provisioning, migrations).
17. If added code doesn't work, remove it before trying other solutions. No dead code.
18. Avoid clever or non-obvious constructs when a simpler explicit solution exists.
19. Simple when possible, but no simpler. Function if a function works, class only if needed.
20. When creating a reusable function, consider a shared utility instead of duplicating logic.
21. Code changes should be small and logically complete.
22. **Never commit or push to git unless the user explicitly asks.** Make code changes and stop — all git operations are the user's call.

## JSDoc Standards (website/)

**Required for:**
- Service functions and utility exports
- Custom hooks
- Component exports (especially reusable ones)

**Format:**
```javascript
/**
 * Brief description of what the function does.
 * @param {Type} paramName - Parameter description.
 * @returns {Promise<Type>} Description of return value.
 */
export const functionName = async (paramName) => {
```

**Update JSDoc when:**
- Adding new parameters to existing functions
- Changing return types
- Adding new exported functions
- Modifying function behavior significantly

## After Making Code Changes — Mandatory Verification

After any file modifications:

1. Run type checks / linters on changed files (`tsc --noEmit` for TypeScript, `ruff` or `mypy` for Python).
2. Re-read the modified file to verify:
   - No bracket/brace mismatches
   - No orphaned code fragments from incomplete edits
   - No syntax errors
   - All try blocks have catch/finally
   - All loops properly closed
   - No duplicate function definitions or code blocks
3. Never mark a task complete until verification passes.

## Coding Standards

### Website (Next.js / TypeScript)

- Static export target — no server-side features (`output: 'export'` in next.config.ts)
- All pages in `website/app/` using App Router conventions
- Client components must be explicitly marked with `'use client'`
- Images in `website/public/images/`, fetched at runtime from `https://api.tyler-schwenk.com` for galleries

### Pi Backend (FastAPI / Python)

- Docker Compose services in `pi/services/`
- FastAPI app in `pi/services/website-backend/app/`
- SQLite database — do not switch to another DB without updating `pi/docs/architecture.md`
- Modular architecture — separate routers, services, and models
- Always catch and log errors with context
- Use modern async/await patterns throughout

## Infrastructure

- **GitHub Actions**: Build runs from `website/` subdirectory (see `.github/workflows/deploy.yml`)
- **Pi deployment**: SSH to fart-pi, pull from this repo, run services from `pi/services/`
- **Public API**: `https://api.tyler-schwenk.com` via Cloudflare Tunnel pointing to Pi port 8000
- **Pi access via NetBird VPN**: `ssh tyler@100.124.76.27`
- **PowerShell**: Quote comma-separated lists when needed

## When Making Changes

1. **Read docs first**: Check `website/docs/` or `pi/docs/` for relevant documentation before making changes.
2. **Update docs**: Keep docs in sync with code changes.
3. **For Pi changes**: Test locally with Docker before deploying to fart-pi.

## Code Review Checklist

- [ ] Follows modular architecture
- [ ] Handles errors gracefully with context
- [ ] JSDoc/docstrings on all exported functions and classes
- [ ] Documentation updated if API or schema changed
- [ ] No hardcoded secrets or credentials
