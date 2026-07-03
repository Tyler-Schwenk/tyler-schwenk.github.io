"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import VoteButtons from "@/components/VoteButtons";

const API_BASE = "https://api.tyler-schwenk.com";

// mirrors MAX_COMMENT_CONTENT_LENGTH / MAX_NICKNAME_LENGTH in the backend's schemas.py
const MAX_COMMENT_LENGTH = 5000;
const MAX_NICKNAME_LENGTH = 50;

type SortOption = "top" | "new";
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
 * Renders a single Public Square thread: the post, its comments, and a
 * comment form.
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

  const inputClass =
    "w-full rounded-lg border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#e2a9f1] transition";

  if (!postId) {
    return (
      <>
        <Navigation />
        <main className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-black px-4 py-16 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <p className="text-gray-400">No post specified.</p>
            <Link href="/public-square" className="text-sm text-gray-400 hover:text-white transition">
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
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-black px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <Link href="/public-square" className="text-sm text-gray-400 hover:text-white transition">
            &larr; Round Table
          </Link>

          {!post ? (
            <p className="text-gray-500 mt-8">Loading...</p>
          ) : (
            <div className="flex items-start gap-4 mt-6 mb-10 rounded-lg border border-slate-700 bg-slate-800/40 p-5">
              <VoteButtons score={post.score} yourVote={postVote} onVote={handlePostVote} />
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold text-white">{post.title}</h1>
                <p className="text-xs text-gray-500 mt-1 mb-4">
                  {post.nickname || "Anonymous"} &middot; {relativeTime(post.created_at)}
                </p>
                <p className="text-gray-200 whitespace-pre-wrap">{post.content}</p>
              </div>
            </div>
          )}

          <div className="border-t border-slate-700 pt-8 mb-8">
            <h2 className="text-lg font-semibold text-gray-300 mb-5">Add a Comment</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Say something..."
                maxLength={MAX_COMMENT_LENGTH}
                rows={3}
                className={inputClass}
              />
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Nickname (optional — leave blank to stay Anonymous)"
                maxLength={MAX_NICKNAME_LENGTH}
                className={inputClass}
              />
              {formError && (
                <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5">
                  {formError}
                </p>
              )}
              <button
                type="submit"
                disabled={formState === "submitting"}
                className="inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold text-black disabled:opacity-50 disabled:cursor-not-allowed transition"
                style={{ backgroundColor: "#e2a9f1" }}
              >
                {formState === "submitting" ? "Posting..." : "Comment"}
              </button>
            </form>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-300">Comments</h2>
            <SortToggle value={sort} onChange={setSort} />
          </div>

          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : comments.length === 0 ? (
            <p className="text-gray-500">No comments yet.</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((comment) => (
                <li
                  key={comment.id}
                  className="flex items-start gap-4 rounded-lg border border-slate-700 bg-slate-800/40 p-4"
                >
                  <VoteButtons
                    score={comment.score}
                    yourVote={commentVotes[comment.id] ?? 0}
                    onVote={(direction) => handleCommentVote(comment.id, direction)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 mb-1">
                      {comment.nickname || "Anonymous"} &middot; {relativeTime(comment.created_at)}
                    </p>
                    <p className="text-gray-200 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}

/**
 * Segmented toggle for choosing "top" vs "new" comment sort order.
 *
 * @param {object} props - Component props.
 * @param {SortOption} props.value - Currently selected sort.
 * @param {(s: SortOption) => void} props.onChange - Selection handler.
 * @returns {JSX.Element} The toggle control.
 */
function SortToggle({ value, onChange }: { value: SortOption; onChange: (s: SortOption) => void }) {
  const options: { key: SortOption; label: string }[] = [
    { key: "top", label: "Top" },
    { key: "new", label: "New" },
  ];
  return (
    <div className="inline-flex rounded-full border border-slate-600 bg-slate-800/60 p-1">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            value === opt.key ? "text-black" : "text-gray-300 hover:text-white"
          }`}
          style={value === opt.key ? { backgroundColor: "#e2a9f1" } : undefined}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
