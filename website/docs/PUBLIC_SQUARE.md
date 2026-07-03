# Public Square

## Overview
Public Square (`/public-square`) is an anonymous, reddit-like forum. Anyone can post, comment, and upvote/downvote — no login. On the public site it's branded "Round Table" — the home page MAIN MENU links to it under the label "ROUND TABLE" with `/images/8bit/round_table.png` as its icon, and the page's own heading and back-links say "Round Table" too. "Public Square" remains the internal/code name (routes, API, docstrings) and still appears in the admin panel's moderation tab. Content lives entirely on the Pi backend (`https://api.tyler-schwenk.com/public-square/...`); see `pi/docs/api/website-backend-api.md` for the API reference.

## Routes
- `/public-square` — post list, sort toggle (Top/New), and a "New Post" form
- `/public-square/thread?id={postId}` — a single post's thread: full content, its comments, and a "New Comment" form

The thread page uses a `?id=` query param rather than a `[id]` dynamic segment. This site is a Next.js static export (`output: 'export'` in `next.config.ts`), which requires `generateStaticParams` to enumerate every dynamic route at build time — but post ids don't exist until users create them at runtime, so they can't be pre-generated. Reading `id` from `useSearchParams()` on a plain static route sidesteps that, the same way gallery detail views render from a single static page instead of per-item routes. Since `useSearchParams()` requires a Suspense boundary during static rendering, the thread page wraps its content in `<Suspense>`.

## Components
- `components/VoteButtons.tsx` — up/down arrows plus a score display. Dumb and reusable: it doesn't own vote state, it just renders `score`/`yourVote` props and calls `onVote(direction)`. The parent page owns the fetch and updates local state from the response.

## Data flow
- Post/comment lists and votes are fetched directly with inline `fetch()` calls (no shared API client layer exists in this codebase — this matches the pattern in `gallery/page.tsx` and `EventRsvpForm.tsx`).
- Voting: clicking an arrow calls `POST /public-square/posts/{id}/vote` (or `/comments/{id}/vote`) with `{ value: 1 | -1 }`. The backend dedupes/toggles votes by hashed visitor IP and returns `{ score, your_vote }`, which the page uses to update that post/comment's score and vote-highlight state.
- Creating a post/comment: same pattern as `EventRsvpForm` — a submit state machine (`idle | submitting | success | error`), with a specific friendly message on `429` (rate limited).

## Known limitation
Vote-highlight state (`yourVote`) is only tracked in React state on the current page load — a refresh resets it to neutral, even though the backend still correctly blocks a duplicate vote from the same IP. Persisting "have I voted on this" client-side (cookie/localStorage) would fix the UI but isn't implemented yet.

## Moderation
There's no in-app moderation UI on the public pages. Deleting a post or comment is done from the admin panel (`website/public/admin/index.html`, "Public Square" tab) using the existing admin JWT login — it's a hard delete (post, its comments, and all votes), not a soft-delete/hide.
