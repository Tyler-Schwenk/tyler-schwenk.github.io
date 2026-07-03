"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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

// mirrors MAX_POST_TITLE_LENGTH / MAX_POST_CONTENT_LENGTH / MAX_NICKNAME_LENGTH in the backend's schemas.py
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 10000;
const MAX_NICKNAME_LENGTH = 50;

// past this many characters a post body is long enough to be worth a "read more"
// nudge into the thread. the preview itself is also visually clamped (line-clamp
// below), so short posts show in full and only longer ones get cut off.
const PREVIEW_CHAR_THRESHOLD = 280;

type SubmitState = "idle" | "submitting" | "success" | "error";

interface ApiPost {
  id: number;
  title: string;
  content: string;
  nickname: string | null;
  score: number;
  comment_count: number;
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
 * Renders the Round Table post list, sort toggle, and new-post form. Styled
 * per the neobrutalism theme (see website/docs/themes/neobrutalism.md).
 *
 * @returns {JSX.Element} The Round Table landing page.
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

  return (
    <>
      <Navigation />
      <main className="neobrutalism-theme min-h-screen bg-[var(--n-canvas)] px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <NeoBlock background="bg-[var(--n-purple)]">
            <div className="flex items-center gap-3 mb-3">
              <Image src="/images/8bit/round_table.png" alt="" width={48} height={48} />
              <h1 className="text-4xl sm:text-5xl font-[family-name:var(--n-font-display)] uppercase text-white">
                Round Table
              </h1>
            </div>
            <p className="text-base text-white/95 font-[family-name:var(--n-font-sans)] max-w-2xl">
              Its pretty much just reddit. But its here on my website. I have things I want to write about and get feedback on, so hopefully this can be a place for that. Hoping that the forum style of this helps make it feel more approachable and will just get some ideas flowing. I&apos;d love for yall to join! You can leave posts anonymously or with your name if youd like.
            </p>
          </NeoBlock>

          <NeoBlock background="bg-[var(--n-cyan-soft)]">
            <h2 className="text-xl font-[family-name:var(--n-font-display)] uppercase text-[var(--n-heading)] mb-5">
              New Post
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <NeoLabel htmlFor="post-title">Title</NeoLabel>
                <NeoInput
                  id="post-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                  maxLength={MAX_TITLE_LENGTH}
                />
              </div>
              <div>
                <NeoLabel htmlFor="post-content">What&apos;s on your mind?</NeoLabel>
                <NeoTextarea
                  id="post-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Thinking about frogs.."
                  maxLength={MAX_CONTENT_LENGTH}
                  rows={4}
                />
              </div>
              <div>
                <NeoLabel htmlFor="post-nickname">Nickname</NeoLabel>
                <NeoInput
                  id="post-nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Anonymous"
                  maxLength={MAX_NICKNAME_LENGTH}
                />
              </div>
              {formError && (
                <p className="text-sm font-bold text-[var(--n-danger)] bg-[var(--n-danger-soft)] border-[3px] border-[var(--n-border-default)] px-4 py-2.5 font-[family-name:var(--n-font-sans)]">
                  {formError}
                </p>
              )}
              <NeoButton type="submit" variant="primary" disabled={formState === "submitting"}>
                {formState === "submitting" ? "Posting..." : "Post"}
              </NeoButton>
            </form>
          </NeoBlock>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-[family-name:var(--n-font-display)] uppercase text-[var(--n-heading)]">
                Posts
              </h2>
              <NeoSortToggle value={sort} onChange={setSort} />
            </div>

            {loading ? (
              <p className="text-[var(--n-body-subtle)] font-[family-name:var(--n-font-sans)]">Loading...</p>
            ) : posts.length === 0 ? (
              <p className="text-[var(--n-body-subtle)] font-[family-name:var(--n-font-sans)]">
                No posts yet — be the first.
              </p>
            ) : (
              <ul className="space-y-4">
                {posts.map((post) => {
                  const threadHref = `/public-square/thread?id=${post.id}`;
                  const isLong = post.content.length > PREVIEW_CHAR_THRESHOLD;
                  return (
                    <li key={post.id}>
                      <NeoBlock
                        floating={false}
                        className="flex items-start gap-4 border-l-[10px]"
                        style={{ borderLeftColor: postAccentColor(post.id) }}
                      >
                        <VoteButtons
                          score={post.score}
                          yourVote={votes[post.id] ?? 0}
                          onVote={(direction) => handleVote(post.id, direction)}
                        />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={threadHref}
                            className="text-[var(--n-heading)] font-bold text-lg font-[family-name:var(--n-font-sans)] underline decoration-2 underline-offset-2 hover:bg-[var(--n-brand)] hover:text-black transition-colors duration-100"
                          >
                            {post.title}
                          </Link>
                          <p className="mt-2 text-[var(--n-body)] font-[family-name:var(--n-font-sans)] whitespace-pre-wrap leading-relaxed line-clamp-6">
                            {post.content}
                          </p>
                          {isLong && (
                            <Link
                              href={threadHref}
                              className="inline-block mt-1 text-sm font-bold text-[var(--n-fg-brand)] font-[family-name:var(--n-font-sans)] underline decoration-2 underline-offset-2 hover:bg-[var(--n-brand)] hover:text-black transition-colors duration-100"
                            >
                              Read more &rarr;
                            </Link>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <NeoBadge>{post.nickname || "Anonymous"} &middot; {relativeTime(post.created_at)}</NeoBadge>
                            <Link href={threadHref}>
                              <NeoBadge color="bg-[var(--n-cyan)]" textColor="text-black">
                                {post.comment_count} {post.comment_count === 1 ? "reply" : "replies"}
                              </NeoBadge>
                            </Link>
                          </div>
                        </div>
                      </NeoBlock>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
