"use client";

import { useState } from "react";
import { adminRequest, errorMessage, useAdminData, useAdminFetch } from "./adminApi";
import { formatDate, plural } from "./format";
import { ChevronIcon } from "./icons";
import type { SquareComment, SquarePost } from "./types";
import { Button, Card, FlashMessage, Muted, Toolbar, useFlash } from "./ui";

/**
 * The Public Square tab: moderation only (posting and voting happen on the
 * public site, as "Round Table"). Newest posts first; expand one to read it and
 * its comments. Deleting is a hard delete: a post takes its comments and votes
 * with it.
 */

// the newest this many posts are listed; moderation is about what's recent
const POSTS_PAGE_SIZE = 100;

/**
 * Who posted and when, under a post or comment.
 * @param props.score - Vote score.
 * @param props.nickname - Poster's nickname, if they gave one.
 * @param props.createdAt - When it was posted.
 */
function Byline({ score, nickname, createdAt }: { score: number; nickname: string | null; createdAt: string }) {
  return (
    <div className="mt-1 text-xs text-slate-400">
      score {score} - {nickname || "Anonymous"} - {formatDate(createdAt)}
    </div>
  );
}

/**
 * An expanded post's body and comments.
 * @param props.post - The post.
 */
function PostDetail({ post }: { post: SquarePost }) {
  const adminFetch = useAdminFetch();
  const comments = useAdminData<SquareComment[]>(`/public-square/posts/${post.id}/comments?sort=new`, "couldn't load comments");
  const [flash, showFlash] = useFlash();

  const deleteComment = async (id: number) => {
    if (!window.confirm("Delete this comment? This can't be undone.")) return;
    try {
      await adminRequest(adminFetch, `/public-square/comments/${id}`, "couldn't delete the comment", { method: "DELETE" });
      comments.setData((current) => current?.filter((comment) => comment.id !== id) ?? null);
    } catch (err) {
      showFlash("error", errorMessage(err));
    }
  };

  return (
    <div className="border-t border-slate-800 p-4">
      <p className="mb-4 whitespace-pre-wrap break-words text-sm text-slate-200">{post.content}</p>
      {!comments.data && <Muted>{comments.error ?? "Loading comments..."}</Muted>}
      {comments.data?.length === 0 && <Muted>No comments.</Muted>}
      <div className="flex flex-col gap-2">
        {comments.data?.map((comment) => (
          <div key={comment.id} className="flex gap-3 rounded-lg bg-slate-950 p-3">
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-wrap break-words text-sm text-slate-200">{comment.content}</p>
              <Byline score={comment.score} nickname={comment.nickname} createdAt={comment.created_at} />
            </div>
            <Button size="sm" variant="danger" onClick={() => deleteComment(comment.id)}>
              Delete
            </Button>
          </div>
        ))}
      </div>
      <FlashMessage flash={flash} />
    </div>
  );
}

/**
 * One post, collapsed to its title until tapped.
 * @param props.post - The post.
 * @param props.onDelete - Called to delete it (after confirming).
 */
function PostCard({ post, onDelete }: { post: SquarePost; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <button type="button" className="min-w-0 flex-1 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
          <div className="flex items-center gap-2 font-semibold text-white">
            <span className="min-w-0 break-words">{post.title}</span>
            <ChevronIcon className={`h-4 w-4 shrink-0 text-slate-500 transition ${open ? "" : "rotate-180"}`} />
          </div>
          <Byline score={post.score} nickname={post.nickname} createdAt={post.created_at} />
          <div className="text-xs text-slate-500">{plural(post.comment_count, "comment")}</div>
        </button>
        <Button size="sm" variant="danger" onClick={onDelete}>
          Delete
        </Button>
      </div>
      {open && <PostDetail post={post} />}
    </Card>
  );
}

/**
 * The Public Square tab.
 */
export default function PublicSquareTab() {
  const adminFetch = useAdminFetch();
  const posts = useAdminData<{ posts: SquarePost[] }>(
    `/public-square/posts?sort=new&page_size=${POSTS_PAGE_SIZE}`,
    "couldn't load posts"
  );
  const [flash, showFlash] = useFlash();

  const deletePost = async (id: number) => {
    if (!window.confirm("Delete this post and all its comments? This can't be undone.")) return;
    try {
      await adminRequest(adminFetch, `/public-square/posts/${id}`, "couldn't delete the post", { method: "DELETE" });
      posts.setData((current) => (current ? { posts: current.posts.filter((post) => post.id !== id) } : null));
    } catch (err) {
      showFlash("error", errorMessage(err));
    }
  };

  if (!posts.data) return <Muted>{posts.error ?? "Loading posts..."}</Muted>;

  const list = posts.data.posts;
  return (
    <div>
      <Toolbar summary={plural(list.length, "post")}>
        <Button size="sm" onClick={posts.reload}>
          Refresh
        </Button>
      </Toolbar>
      <FlashMessage flash={flash} />
      {list.length === 0 && <Muted>No posts yet.</Muted>}
      <div className="flex flex-col gap-3">
        {list.map((post) => (
          <PostCard key={post.id} post={post} onDelete={() => deletePost(post.id)} />
        ))}
      </div>
    </div>
  );
}
