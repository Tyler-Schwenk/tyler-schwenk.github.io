"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import VoteButtons from "@/components/VoteButtons";

const API_BASE = "https://api.tyler-schwenk.com";

// mirrors MAX_POST_TITLE_LENGTH / MAX_POST_CONTENT_LENGTH / MAX_NICKNAME_LENGTH in the backend's schemas.py
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 10000;
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

interface ApiPostList {
  posts: ApiPost[];
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
 * Fetches Public Square posts from the Pi API in the given sort order.
 *
 * @param {SortOption} sort - "top" or "new".
 * @returns {Promise<ApiPost[]>} List of posts, or an empty array if the API is unreachable.
 */
async function fetchPosts(sort: SortOption): Promise<ApiPost[]> {
  try {
    const res = await fetch(`${API_BASE}/public-square/posts?sort=${sort}`);
    if (!res.ok) return [];
    const data: ApiPostList = await res.json();
    return data.posts;
  } catch {
    console.warn("could not fetch Public Square posts from API");
    return [];
  }
}

/**
 * Renders the Public Square post list, sort toggle, and new-post form.
 *
 * @returns {JSX.Element} The Public Square landing page.
 */
export default function PublicSquarePage() {
  const [sort, setSort] = useState<SortOption>("top");
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [votes, setVotes] = useState<Record<number, 1 | -1 | 0>>({});

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [nickname, setNickname] = useState("");
  const [formState, setFormState] = useState<SubmitState>("idle");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPosts(sort).then((fetched) => {
      if (!cancelled) {
        setPosts(fetched);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sort]);

  /**
   * Validates and submits the new-post form to the backend.
   *
   * @param {React.FormEvent} e - The form submit event.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!title.trim() || !content.trim()) {
      setFormError("title and content can't be empty");
      setFormState("error");
      return;
    }

    setFormState("submitting");
    try {
      const res = await fetch(`${API_BASE}/public-square/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          nickname: nickname.trim() || null,
        }),
      });

      if (res.status === 429) {
        setFormError("too many posts from your network — give it a bit and try again");
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

      const created: ApiPost = await res.json();
      setTitle("");
      setContent("");
      setNickname("");
      setFormState("success");
      setPosts((prev) => (sort === "new" ? [created, ...prev] : [...prev, created]));
    } catch {
      setFormError("couldn't reach the server — check your connection and try again");
      setFormState("error");
    }
  }

  /**
   * Casts a vote on a post and updates its score/vote state from the response.
   *
   * @param {number} postId - Post being voted on.
   * @param {1 | -1} direction - Vote direction.
   */
  async function handleVote(postId: number, direction: 1 | -1) {
    try {
      const res = await fetch(`${API_BASE}/public-square/posts/${postId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: direction }),
      });
      if (!res.ok) return;
      const result: { score: number; your_vote: 1 | -1 | 0 } = await res.json();
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, score: result.score } : p)));
      setVotes((prev) => ({ ...prev, [postId]: result.your_vote }));
    } catch {
      // vote just doesn't land this time — no need to surface an error for a click
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#e2a9f1] transition";

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-black px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold text-white mb-2">Round Table</h1>
          <p className="text-sm text-gray-400 mb-8">
            Its pretty much just reddit. But its here on my website. I have things I want to write about but and get feedback on, so hopefully this can be a place for that. Hoping that the forum style of this helps make it feel more approachable and will just get some ideas flowing. I'd love for yall to join! You can leave posts anonymously or with your name if youd like.
          </p>

          <div className="border-t border-slate-700 pt-8 mb-8">
            <h2 className="text-lg font-semibold text-gray-300 mb-5">New Post</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                maxLength={MAX_TITLE_LENGTH}
                className={inputClass}
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's on your mind?"
                maxLength={MAX_CONTENT_LENGTH}
                rows={4}
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
                {formState === "submitting" ? "Posting..." : "Post"}
              </button>
            </form>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-300">Posts</h2>
            <SortToggle value={sort} onChange={setSort} />
          </div>

          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : posts.length === 0 ? (
            <p className="text-gray-500">No posts yet — be the first.</p>
          ) : (
            <ul className="space-y-3">
              {posts.map((post) => (
                <li
                  key={post.id}
                  className="flex items-start gap-4 rounded-lg border border-slate-700 bg-slate-800/40 p-4"
                >
                  <VoteButtons
                    score={post.score}
                    yourVote={votes[post.id] ?? 0}
                    onVote={(direction) => handleVote(post.id, direction)}
                  />
                  <div className="min-w-0 flex-1">
                    <Link href={`/public-square/thread?id=${post.id}`} className="text-white font-semibold hover:underline">
                      {post.title}
                    </Link>
                    <p className="text-xs text-gray-500 mt-1">
                      {post.nickname || "Anonymous"} &middot; {relativeTime(post.created_at)}
                    </p>
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
 * Segmented toggle for choosing "top" vs "new" post sort order.
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
