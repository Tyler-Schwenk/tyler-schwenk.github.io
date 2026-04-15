# GitHub Copilot Instructions

## Project Overview

Personal website and home server monorepo for tyler-schwenk.com.

### Repository Structure

```
tyler-schwenk.github.io/      (monorepo root)
├── website/                   Next.js frontend, deployed to GitHub Pages
└── pi/                        Raspberry Pi 5 backend (Docker services + FastAPI)
```

- **website/** — Next.js 16 static site. Deployed automatically to tyler-schwenk.com via GitHub Actions on push to main.
- **pi/** — FastAPI backend + Docker Compose configs for fart-pi home server. Pulled and run on the Pi separately.

### Documentation

Each subproject has its own `docs/` folder co-located with its code:

- `website/docs/` — Frontend documentation (gallery, SEO, routing, etc.)
- `pi/docs/` — Backend documentation (API reference, architecture, deployment, services)

These docs are authoritative and must be referenced before making changes. They must also be kept up to date as changes are made — add new docs as needed, remove docs that are no longer accurate or redundant.

In-code docstrings must always be accurate and up to date. They are treated as first-class documentation for future AI code companions.

---

## Global Coding Rules (MANDATORY)

All code must comply with the following rules without exception:

1. Use clear, well-structured code that prioritizes readability, reuse, and correctness.
2. Avoid deep nesting:
   - Maximum of 3 indentation levels in most cases
   - Prefer early returns, helper functions, or refactoring over nesting
3. No magic numbers.
   - All constants must be named and centralized
4. No emojis anywhere in code, logs, comments, or documentation.
6. Reuse existing code whenever possible.
   - Reduce duplication
   - Fewer lines are acceptable only if clarity and maintainability are preserved
7. Optimize for long-term maintainability and readability.
8. Do not document change history or current changes and issues.
   - Only document how the system works today
   - Focus on data formats, schemas, APIs, and behavior
9. When modifying a file:
   - You must read the entire file
   - Ensure no compile, runtime, or logical errors are introduced
10. All functions and classes must have docstrings.
    - Follow PEP 257 conventions
    - Google or NumPy style is acceptable
    - Docstrings must describe:
      - Purpose
      - Inputs
      - Outputs
      - Side effects (if any)

## JSDoc Standards

**REQUIRED for all:**
- Service functions and utility exports in `website/`
- Custom hooks
- Component exports (especially reusable ones)

**JSDoc Format:**
```javascript
/**
 * Brief description of what the function does.
 * @param {Type} paramName - Parameter description.
 * @returns {Promise<Type>} Description of return value.
 */
export const functionName = async (paramName) => {
```

**When to update JSDoc:**
- Adding new parameters to existing functions
- Changing return types
- Adding new exported functions
- Modifying function behavior significantly

## After Making Code Changes - MANDATORY VERIFICATION

**You MUST perform these checks after ANY file modifications:**

1. **Run get_errors** on ALL changed files
2. **Read the entire modified file** to verify:
   - No bracket/brace mismatches (count opening vs closing `{`, `}`, `(`, `)`, `[`, `]`)
   - No orphaned code fragments from incomplete replacements
   - No merge artifacts (two functions accidentally merged)
   - No syntax errors (typos like `or` instead of `for`)
   - All try blocks have catch/finally
   - All loops properly closed
   - No corrupted lines from partial replacements (e.g., `getTimeSince(timestamp)nds`)
   - No duplicate function definitions or code blocks

3. **If using replace_string_in_file multiple times:**
   - Read the full file after ALL replacements complete
   - Check for leftover code that should've been removed
   - Verify function boundaries are intact
   - Ensure imports/exports are not duplicated

**Common errors from incomplete replacements:**
- Extra closing brackets where old code wasn't fully removed
- Function definitions merged together
- Partial lines mixing old and new code
- Orphaned code blocks between functions

**Never mark a task complete until verification passes.**

## Coding Standards

### Website (Next.js / TypeScript)
- Static export target — no server-side features (`output: 'export'` in next.config.ts)
- All pages in `website/app/` using App Router conventions
- Client components must be explicitly marked with `'use client'`
- Images in `website/public/images/`, fetched at runtime from `https://api.tyler-schwenk.com` for galleries

### Pi Backend (FastAPI / Python)
- Docker Compose services in `pi/services/`
- FastAPI app in `pi/services/website-backend/app/`
- SQLite database; do not switch to another DB without updating `pi/docs/architecture.md`
- Use **modular architecture** — separate routers, services, and models
- **Error handling**: Always catch and log errors with context
- **Async/await**: Use modern async patterns throughout

## Critical Notes
- **PowerShell**: Always quote comma-separated lists when needed
- **GitHub Actions**: Build runs from `website/` subdirectory (see `.github/workflows/deploy.yml`)
- **Pi deployment**: SSH to fart-pi, pull from this repo, run services from `pi/services/`
- **Public API**: `https://api.tyler-schwenk.com` via Cloudflare Tunnel pointing to Pi port 8000
- **Pi access via NetBird VPN**: `ssh tyler@100.124.76.27`

## When Making Changes
1. **Read docs first**: Check `website/docs/` or `pi/docs/` for relevant documentation
2. **Update docs**: Keep docs in sync with code changes
3. **For Pi changes**: Test locally with Docker before deploying to fart-pi

## Code Review Checklist
- [ ] Follows modular architecture
- [ ] Handles errors gracefully with context
- [ ] JSDoc/docstrings on all exported functions and classes
- [ ] Documentation updated if API or schema changed
- [ ] No hardcoded secrets or credentials
