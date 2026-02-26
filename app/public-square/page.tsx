"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import Navigation from "@/components/Navigation";

type Reply = {
  id: string;
  content: string;
  authorName: string;
};

type Thread = {
  id: string;
  title: string;
  authorName: string;
  replies: Reply[];
};

type ReplyDraft = {
  content: string;
  displayName: string;
  postAnonymously: boolean;
};

const DEFAULT_ANONYMOUS_NAME = "Anonymous";
const DEFAULT_NAMED_FALLBACK = "Guest";
const MAX_TITLE_LENGTH = 160;
const MAX_REPLY_LENGTH = 1000;

const INITIAL_THREADS: Thread[] = [
  {
    id: "thread-streaming-alternatives",
    title: "How do we move forward away from predatory streaming services without moving backward?",
    authorName: "",
    replies: [],
  },
  {
    id: "thread-small-internet",
    title: "Building a Decentralized/\"small\" internet",
    authorName: "",
    replies: [],
  },
];

/**
 * Builds a display name from anonymity choice and optional text input.
 *
 * @param {string} rawName - User-provided display name.
 * @param {boolean} postAnonymously - Whether the user chose anonymous posting.
 * @returns {string} Name shown on a topic or reply.
 */
function buildAuthorName(rawName: string, postAnonymously: boolean): string {
  if (postAnonymously) {
    return DEFAULT_ANONYMOUS_NAME;
  }

  const trimmedName = rawName.trim();
  if (trimmedName.length === 0) {
    return DEFAULT_NAMED_FALLBACK;
  }

  return trimmedName;
}

/**
 * Returns a default reply draft model.
 *
 * @returns {ReplyDraft} Initial reply form state.
 */
function createInitialReplyDraft(): ReplyDraft {
  return {
    content: "",
    displayName: "",
    postAnonymously: true,
  };
}

/**
 * Renders the Public Square discussion board.
 *
 * @returns {JSX.Element} Public Square page layout.
 */
export default function PublicSquarePage() {
  const [threads, setThreads] = useState<Thread[]>(INITIAL_THREADS);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicAnonymous, setNewTopicAnonymous] = useState(true);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, ReplyDraft>>(() => {
    const initialDrafts: Record<string, ReplyDraft> = {};

    for (const thread of INITIAL_THREADS) {
      initialDrafts[thread.id] = createInitialReplyDraft();
    }

    return initialDrafts;
  });

  const topicCountLabel = useMemo(() => {
    return threads.length === 1 ? "1 topic" : `${threads.length} topics`;
  }, [threads.length]);

  /**
   * Creates a new top-level thread from the topic form.
   *
   * @param {FormEvent<HTMLFormElement>} event - Form submission event.
   */
  function handleTopicSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = newTopicTitle.trim();
    if (trimmedTitle.length === 0) {
      return;
    }

    const threadId = `thread-${Date.now()}`;
    const authorName = buildAuthorName(newTopicName, newTopicAnonymous);

    const nextThread: Thread = {
      id: threadId,
      title: trimmedTitle,
      authorName,
      replies: [],
    };

    setThreads((previousThreads) => [nextThread, ...previousThreads]);
    setNewTopicTitle("");
    setNewTopicName("");
    setNewTopicAnonymous(true);
    setReplyDrafts((previousDrafts) => ({
      ...previousDrafts,
      [threadId]: createInitialReplyDraft(),
    }));
  }

  /**
   * Updates one field in a thread reply draft.
   *
   * @param {string} threadId - Target thread identifier.
   * @param {keyof ReplyDraft} field - Draft field to update.
   * @param {string | boolean} value - New field value.
   */
  function updateReplyDraft(threadId: string, field: keyof ReplyDraft, value: string | boolean) {
    setReplyDrafts((previousDrafts) => {
      const previousDraft = previousDrafts[threadId] ?? createInitialReplyDraft();

      return {
        ...previousDrafts,
        [threadId]: {
          ...previousDraft,
          [field]: value,
        },
      };
    });
  }

  /**
   * Submits a reply into a specific thread.
   *
   * @param {string} threadId - Target thread identifier.
   * @param {FormEvent<HTMLFormElement>} event - Form submission event.
   */
  function handleReplySubmit(threadId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const currentDraft = replyDrafts[threadId] ?? createInitialReplyDraft();
    const trimmedContent = currentDraft.content.trim();
    if (trimmedContent.length === 0) {
      return;
    }

    const authorName = buildAuthorName(currentDraft.displayName, currentDraft.postAnonymously);

    const nextReply: Reply = {
      id: `reply-${Date.now()}`,
      content: trimmedContent,
      authorName,
    };

    setThreads((previousThreads) => {
      return previousThreads.map((thread) => {
        if (thread.id !== threadId) {
          return thread;
        }

        return {
          ...thread,
          replies: [...thread.replies, nextReply],
        };
      });
    });

    setReplyDrafts((previousDrafts) => ({
      ...previousDrafts,
      [threadId]: createInitialReplyDraft(),
    }));
  }

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-b from-stone-950 via-neutral-900 to-black text-stone-100 px-4 py-12">
        <div className="mx-auto w-full max-w-4xl rounded-2xl border border-stone-700 bg-stone-900/70 p-6 md:p-10 shadow-2xl">
        <h1 className="text-3xl md:text-5xl font-semibold tracking-wide text-stone-100">Public Square</h1>
        <div className="mt-4 rounded-lg border border-amber-500/60 bg-amber-900/20 px-4 py-3 text-amber-100">
          This discussion board is planned for a future build with a dedicated backend.
        </div>
        <p className="mt-3 text-stone-300 leading-relaxed">
          Open discussions where people can post topics and reply to each other as either anonymous or named.
        </p>
        <p className="mt-1 text-sm text-stone-400">{topicCountLabel}</p>

        <section className="mt-8 rounded-xl border border-stone-700 bg-stone-900/60 p-4 md:p-6">
          <h2 className="text-xl font-medium text-stone-100">Start a topic</h2>
          <form onSubmit={handleTopicSubmit} className="mt-4 space-y-4">
            <div className="space-y-2">
              <label htmlFor="new-topic-title" className="text-sm text-stone-300">
                Topic title
              </label>
              <input
                id="new-topic-title"
                type="text"
                maxLength={MAX_TITLE_LENGTH}
                value={newTopicTitle}
                onChange={(event) => setNewTopicTitle(event.target.value)}
                className="w-full rounded-md border border-stone-600 bg-stone-950 px-3 py-2 text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-500"
                placeholder="Enter a topic title"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="new-topic-anon"
                type="checkbox"
                checked={newTopicAnonymous}
                onChange={(event) => setNewTopicAnonymous(event.target.checked)}
              />
              <label htmlFor="new-topic-anon" className="text-sm text-stone-300">
                Post anonymously
              </label>
            </div>

            <div className="space-y-2">
              <label htmlFor="new-topic-name" className="text-sm text-stone-300">
                Name (optional)
              </label>
              <input
                id="new-topic-name"
                type="text"
                value={newTopicName}
                onChange={(event) => setNewTopicName(event.target.value)}
                disabled={newTopicAnonymous}
                className="w-full rounded-md border border-stone-600 bg-stone-950 px-3 py-2 text-stone-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-stone-500"
                placeholder="Your name"
              />
            </div>

            <button
              type="submit"
              className="rounded-md border border-stone-500 bg-stone-800 px-4 py-2 text-stone-100 hover:bg-stone-700 transition-colors"
            >
              Post topic
            </button>
          </form>
        </section>

        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-medium text-stone-100">Threads</h2>
          {threads.map((thread) => {
            const draft = replyDrafts[thread.id] ?? createInitialReplyDraft();

            return (
              <article key={thread.id} className="rounded-xl border border-stone-700 bg-stone-900/60 p-4 md:p-6">
                <h3 className="text-lg font-semibold text-stone-100">{thread.title}</h3>
                {thread.authorName.trim().length > 0 ? (
                  <p className="mt-1 text-xs text-stone-400">Started by {thread.authorName}</p>
                ) : null}
                <p className="mt-1 text-sm text-stone-400">
                  {thread.replies.length === 0 ? "No replies yet" : `${thread.replies.length} replies`}
                </p>

                <div className="mt-4 space-y-3">
                  {thread.replies.map((reply) => (
                    <div key={reply.id} className="rounded-md border border-stone-700 bg-stone-950/70 px-3 py-2">
                      <p className="text-sm text-stone-200">{reply.content}</p>
                      <p className="mt-1 text-xs text-stone-400">Posted by {reply.authorName}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={(event) => handleReplySubmit(thread.id, event)} className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <label htmlFor={`reply-${thread.id}`} className="text-sm text-stone-300">
                      Reply
                    </label>
                    <textarea
                      id={`reply-${thread.id}`}
                      maxLength={MAX_REPLY_LENGTH}
                      value={draft.content}
                      onChange={(event) => updateReplyDraft(thread.id, "content", event.target.value)}
                      className="min-h-24 w-full rounded-md border border-stone-600 bg-stone-950 px-3 py-2 text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-500"
                      placeholder="Write your reply"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id={`reply-anon-${thread.id}`}
                      type="checkbox"
                      checked={draft.postAnonymously}
                      onChange={(event) =>
                        updateReplyDraft(thread.id, "postAnonymously", event.target.checked)
                      }
                    />
                    <label htmlFor={`reply-anon-${thread.id}`} className="text-sm text-stone-300">
                      Post anonymously
                    </label>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor={`reply-name-${thread.id}`} className="text-sm text-stone-300">
                      Name (optional)
                    </label>
                    <input
                      id={`reply-name-${thread.id}`}
                      type="text"
                      value={draft.displayName}
                      onChange={(event) => updateReplyDraft(thread.id, "displayName", event.target.value)}
                      disabled={draft.postAnonymously}
                      className="w-full rounded-md border border-stone-600 bg-stone-950 px-3 py-2 text-stone-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-stone-500"
                      placeholder="Your name"
                    />
                  </div>

                  <button
                    type="submit"
                    className="rounded-md border border-stone-500 bg-stone-800 px-4 py-2 text-stone-100 hover:bg-stone-700 transition-colors"
                  >
                    Post reply
                  </button>
                </form>
              </article>
            );
          })}
        </section>

          <div className="mt-10">
            <Link href="/" className="text-sm text-stone-300 hover:text-stone-100 underline underline-offset-4">
              Return to main menu
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
