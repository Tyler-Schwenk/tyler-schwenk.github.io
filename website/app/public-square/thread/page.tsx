"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import VoteButtons from "@/components/VoteButtons";
import NeoBlock from "@/components/neobrutalism/NeoBlock";
import NeoButton from "@/components/neobrutalism/NeoButton";
import NeoBadge from "@/components/neobrutalism/NeoBadge";
import NeoSortToggle, { SortOption } from "@/components/neobrutalism/NeoSortToggle";
import { NeoInput, NeoLabel, NeoTextarea } from "@/components/neobrutalism/NeoFormControls";
import { postAccentColor } from "@/components/neobrutalism/postAccent";

const API_BASE = "https://api.tyler-schwenk.com";

// mirrors MAX_COMMENT_CONTENT_LENGTH / MAX_NICKNAME_LENGTH in the backend's schemas.py
const MAX_COMMENT_LENGTH = 5000;
const MAX_NICKNAME_LENGTH = 50;

type SubmitState = "idle" | "submitting" | "success" | "error";

interface ApiPost {
  id: number;
  title: string;
  content: string;
  nickname: string | null;
  score: number;
  created_at: string;
}

interface ApiComment {
  id: number;
  post_id: number;
  content: string;
  nickname: string | null;
  score: number;
  created_at: string;
}

/**
 * Formats an ISO timestamp as a short relative time string (e.g. "5m ago").
 *
 * @param {string} isoDate - ISO 8601 timestamp.
 * @returns {string} Human-readable relative time.
 */
function relativeTime(isoDate: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Fetches a single Public Square post by id.
 *
 * @param {string} postId - Post ID from the query string.
 * @returns {Promise<ApiPost | null>} The post, or null if missing/unreachable.
 */
async function fetchPost(postId: string): Promise<ApiPost | null> {
  try {
    const res = await fetch(`${API_BASE}/public-square/posts/${postId}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    console.warn(`could not fetch Public Square post ${postId} from API`);
    return null;
  }
}

/**
 * Fetches a post's comments in the given sort order.
 *
 * @param {string} postId - Post ID from the query string.
 * @param {SortOption} sort - "top" or "new".
 * @returns {Promise<ApiComment[]>} The comments, or an empty array if unreachable.
 */
async function fetchComments(postId: string, sort: SortOption): Promise<ApiComment[]> {
  try {
    const res = await fetch(`${API_BASE}/public-square/posts/${postId}/comments?sort=${sort}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    console.warn(`could not fetch comments for Public Square post ${postId}`);
    return [];
  }
}

/**
 * Public Square thread route. This is a plain static page (not a dynamic
 * `[id]` segment) because the site is a Next.js static export with no
 * server to render on demand — post ids don't exist until users create
 * them at runtime, so they can't be enumerated via generateStaticParams
 * at build time. The post id instead comes from a `?id=` query param,
 * read client-side, the same way gallery details are rendered from a
 * single static page rather than per-item routes.
 *
 * @returns {JSX.Element} The thread page, wrapped in Suspense for useSearchParams.
 */
export default function PublicSquareThreadPage() {
  return (
    <Suspense fallback={null}>
      <ThreadContent />
    </Suspense>
  );
}

/**
 * Renders a single Round Table thread: the post, its comments, and a
 * comment form. Styled per the neobrutalism theme (see
 * website/docs/themes/neobrutalism.md).
 *
 * @returns {JSX.Element} The thread detail content.
 */
function ThreadContent() {
  const searchParams = useSearchParams();
  const postId = searchParams.get("id") ?? "";

  const [post, setPost] = useState<ApiPost | null>(null);
  const [postVote, setPostVote] = useState<1 | -1 | 0>(0);
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [commentVotes, setCommentVotes] = useState<Record<number, 1 | -1 | 0>>({});
  const [sort, setSort] = useState<SortOption>("top");
  const [loading, setLoading] = useState(true);

  const [content, setContent] = useState("");
  const [nickname, setNickname] = useState("");
  const [formState, setFormState] = useState<SubmitState>("idle");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    fetchPost(postId).then((fetched) => {
      if (!cancelled) setPost(fetched);
    });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    setLoading(true);
    fetchComments(postId, sort).then((fetched) => {
      if (!cancelled) {
        setComments(fetched);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [postId, sort]);

  /**
   * Casts a vote on the post itself.
   *
   * @param {1 | -1} direction - Vote direction.
   */
  async function handlePostVote(direction: 1 | -1) {
    try {
      const res = await fetch(`${API_BASE}/public-square/posts/${postId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: direction }),
      });
      if (!res.ok) return;
      const result: { score: number; your_vote: 1 | -1 | 0 } = await res.json();
      setPost((prev) => (prev ? { ...prev, score: result.score } : prev));
      setPostVote(result.your_vote);
    } catch {
      // vote just doesn't land this time — no need to surface an error for a click
    }
  }

  /**
   * Casts a vote on a comment and updates its score/vote state.
   *
   * @param {number} commentId - Comment being voted on.
   * @param {1 | -1} direction - Vote direction.
   */
  async function handleCommentVote(commentId: number, direction: 1 | -1) {
    try {
      const res = await fetch(`${API_BASE}/public-square/comments/${commentId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: direction }),
      });
      if (!res.ok) return;
      const result: { score: number; your_vote: 1 | -1 | 0 } = await res.json();
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, score: result.score } : c)));
      setCommentVotes((prev) => ({ ...prev, [commentId]: result.your_vote }));
    } catch {
      // vote just doesn't land this time — no need to surface an error for a click
    }
  }

  /**
   * Validates and submits the comment form to the backend.
   *
   * @param {React.FormEvent} e - The form submit event.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!content.trim()) {
      setFormError("comment can't be empty");
      setFormState("error");
      return;
    }

    setFormState("submitting");
    try {
      const res = await fetch(`${API_BASE}/public-square/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          nickname: nickname.trim() || null,
        }),
      });

      if (res.status === 429) {
        setFormError("too many comments from your network — give it a bit and try again");
        setFormState("error");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const detail =
          typeof data.detail === "string" ? data.detail : "something went wrong — try again in a moment";
        setFormError(detail);
        setFormState("error");
        return;
      }

      const created: ApiComment = await res.json();
      setContent("");
      setNickname("");
      setFormState("success");
      setComments((prev) => (sort === "new" ? [created, ...prev] : [...prev, created]));
    } catch {
      setFormError("couldn't reach the server — check your connection and try again");
      setFormState("error");
    }
  }

  if (!postId) {
    return (
      <>
        <Navigation />
        <main className="neobrutalism-theme min-h-screen bg-[var(--n-canvas)] px-4 py-16 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <p className="text-[var(--n-body-subtle)] font-[family-name:var(--n-font-sans)]">No post specified.</p>
            <Link
              href="/public-square"
              className="inline-block mt-2 text-sm font-bold text-[var(--n-heading)] font-[family-name:var(--n-font-sans)] underline decoration-2 underline-offset-2 hover:bg-[var(--n-brand)] transition-colors duration-100"
            >
              &larr; Round Table
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <main className="neobrutalism-theme min-h-screen bg-[var(--n-neutral-primary-soft)] px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <Link
            href="/public-square"
            className="inline-block text-sm font-bold text-[var(--n-heading)] font-[family-name:var(--n-font-sans)] underline decoration-2 underline-offset-2 hover:bg-[var(--n-brand)] transition-colors duration-100"
          >
            &larr; Round Table
          </Link>

          {!post ? (
            <p className="text-[var(--n-body-subtle)] font-[family-name:var(--n-font-sans)]">Loading...</p>
          ) : (
            <NeoBlock
              className="flex items-start gap-4 border-l-[10px]"
              style={{ borderLeftColor: postAccentColor(post.id) }}
            >
              <VoteButtons score={post.score} yourVote={postVote} onVote={handlePostVote} />
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl font-[family-name:var(--n-font-display)] uppercase text-[var(--n-heading)]">
                  {post.title}
                </h1>
                <div className="mt-2 mb-4">
                  <NeoBadge>{post.nickname || "Anonymous"} &middot; {relativeTime(post.created_at)}</NeoBadge>
                </div>
                <p className="text-[var(--n-body)] font-[family-name:var(--n-font-sans)] whitespace-pre-wrap leading-relaxed">
                  {post.content}
                </p>
              </div>
            </NeoBlock>
          )}

          <NeoBlock floating={false}>
            <h2 className="text-xl font-[family-name:var(--n-font-display)] uppercase text-[var(--n-heading)] mb-5">
              Add a Comment
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <NeoLabel htmlFor="comment-content">Say something...</NeoLabel>
                <NeoTextarea
                  id="comment-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Say something..."
                  maxLength={MAX_COMMENT_LENGTH}
                  rows={3}
                />
              </div>
              <div>
                <NeoLabel htmlFor="comment-nickname">Nickname</NeoLabel>
                <NeoInput
                  id="comment-nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Optional — leave blank to stay Anonymous"
                  maxLength={MAX_NICKNAME_LENGTH}
                />
              </div>
              {formError && (
                <p className="text-sm font-bold text-[var(--n-danger)] bg-[var(--n-danger-soft)] border-[3px] border-[var(--n-border-default)] px-4 py-2.5 font-[family-name:var(--n-font-sans)]">
                  {formError}
                </p>
              )}
              <NeoButton type="submit" variant="primary" disabled={formState === "submitting"}>
                {formState === "submitting" ? "Posting..." : "Comment"}
              </NeoButton>
            </form>
          </NeoBlock>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-[family-name:var(--n-font-display)] uppercase text-[var(--n-heading)]">
                Comments
              </h2>
              <NeoSortToggle value={sort} onChange={setSort} />
            </div>

            {loading ? (
              <p className="text-[var(--n-body-subtle)] font-[family-name:var(--n-font-sans)]">Loading...</p>
            ) : comments.length === 0 ? (
              <p className="text-[var(--n-body-subtle)] font-[family-name:var(--n-font-sans)]">No comments yet.</p>
            ) : (
              <ul className="space-y-4">
                {comments.map((comment) => (
                  <li key={comment.id}>
                    <NeoBlock
                      floating={false}
                      className="flex items-start gap-4 border-l-[10px]"
                      style={{ borderLeftColor: postAccentColor(comment.id) }}
                    >
                      <VoteButtons
                        score={comment.score}
                        yourVote={commentVotes[comment.id] ?? 0}
                        onVote={(direction) => handleCommentVote(comment.id, direction)}
                      />
                      <div className="min-w-0 flex-1">
                        <NeoBadge>{comment.nickname || "Anonymous"} &middot; {relativeTime(comment.created_at)}</NeoBadge>
                        <p className="text-[var(--n-body)] font-[family-name:var(--n-font-sans)] whitespace-pre-wrap leading-relaxed mt-2">
                          {comment.content}
                        </p>
                      </div>
                    </NeoBlock>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
