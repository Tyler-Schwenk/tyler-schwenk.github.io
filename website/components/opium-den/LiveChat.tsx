"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { parseBackendTime } from "@/app/admin/format";
import {
  ChatNameTakenError,
  DJ_CHAT_MESSAGE_MAX_LENGTH,
  DJ_CHAT_NICKNAME_MAX_LENGTH,
  LIVE_SECTION_PATH,
} from "@/app/opium-den/djApi";
import type { DjChat } from "@/lib/useDjChat";
import { useStickToBottom } from "@/lib/useStickToBottom";
import AlertSignup from "./AlertSignup";
import ChatLine from "./ChatLine";
import { SendIcon } from "./playerIcons";

// 16px text on phones: ios zooms the whole page into any input smaller than that
const INPUT_BASE_CLASS =
  "min-w-0 flex-1 border bg-den-bg py-2 text-base text-den-ink placeholder:text-den-faint focus:outline-none sm:text-sm";
// the message box is a pill in ink; the name field is square and outlined in red, so the two never look alike
const MESSAGE_INPUT_CLASS = `${INPUT_BASE_CLASS} rounded-full border-den-ink px-4 focus:border-den-accent`;
const NAME_INPUT_CLASS = `${INPUT_BASE_CLASS} border-den-accent px-3`;

/**
 * when a message was sent, in the reader's local time.
 *
 * @param {string} createdAt - the backend's naive utc timestamp.
 * @returns {string} like "9:41 PM".
 */
function sentAt(createdAt: string): string {
  return parseBackendTime(createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * the "change your name" panel. it opens above the message box from "change", or when
 * a send finds your name's someone else's (your message waits in the box and goes out
 * with the new name).
 * styled as its own labelled form so it can't be mistaken for the message box.
 *
 * @param {object} props
 * @param {string} props.initial - the current name, to edit.
 * @param {boolean} props.hasPending - a message is waiting to send once there's a name.
 * @param {(nickname: string) => void} props.onSave - takes the new name.
 * @param {() => void} props.onCancel - closes it without changing anything.
 * @returns {JSX.Element} the form.
 */
function NamePanel({
  initial,
  hasPending,
  onSave,
  onCancel,
}: {
  initial: string;
  hasPending: boolean;
  onSave: (nickname: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const name = draft.trim();
    if (name) onSave(name);
  };
  return (
    <form onSubmit={submit} className="mb-3 border border-den-accent bg-den-accent/5 p-3">
      <label htmlFor="den-chat-name" className="block text-sm font-semibold">
        Change your name
      </label>
      <p className="mt-0.5 font-den-mono text-[11px] text-den-muted">
        it shows over your character and next to your messages{hasPending ? ", and your message sends with it." : "."}
      </p>
      <div className="mt-2 flex gap-2">
        <input
          id="den-chat-name"
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="your name"
          autoComplete="nickname"
          maxLength={DJ_CHAT_NICKNAME_MAX_LENGTH}
          className={NAME_INPUT_CLASS}
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="min-h-10 shrink-0 bg-den-accent px-4 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-40"
        >
          {hasPending ? "Send" : "Save"}
        </button>
      </div>
      <button type="button" onClick={onCancel} className="mt-2 font-den-mono text-[11px] text-den-muted transition-colors hover:text-den-accent-soft">
        cancel
      </button>
    </form>
  );
}

/**
 * where you talk: a message box, with who you're chatting as under it and a way to
 * change it. if the name turns out to be someone else's when you send, the name panel
 * opens and the message waits for the new one.
 *
 * @param {object} props
 * @param {string} props.nickname - your name (you picked one to come into the room).
 * @param {(nickname: string) => void} props.onNickname - saves a name.
 * @param {(nickname: string, content: string) => Promise<void>} props.onSend - sends; throws with a readable reason.
 * @returns {JSX.Element} the composer.
 */
function Composer({
  nickname,
  onNickname,
  onSend,
}: {
  nickname: string;
  onNickname: (nickname: string) => void;
  onSend: (nickname: string, content: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [naming, setNaming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deliver = async (name: string, content: string) => {
    setSending(true);
    try {
      await onSend(name, content);
      setDraft("");
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      // the name's someone else's: straight back to picking one, the message still waiting
      if (err instanceof ChatNameTakenError) setNaming(true);
    } finally {
      setSending(false);
    }
  };

  const submitMessage = (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    deliver(nickname, content);
  };

  const saveName = (name: string) => {
    onNickname(name);
    setNaming(false);
    const content = draft.trim();
    if (content) deliver(name, content);
  };

  return (
    <div>
      {naming && (
        <NamePanel initial={nickname} hasPending={Boolean(draft.trim())} onSave={saveName} onCancel={() => setNaming(false)} />
      )}
      <form onSubmit={submitMessage} className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="say something"
          maxLength={DJ_CHAT_MESSAGE_MAX_LENGTH}
          aria-label="Chat message"
          className={MESSAGE_INPUT_CLASS}
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-den-accent text-white transition hover:brightness-110 disabled:opacity-40"
        >
          <SendIcon className="h-4 w-4" />
        </button>
      </form>
      <p className="mt-2 px-1 font-den-mono text-[11px] text-den-muted">
        chatting as <span className="text-den-ink">{nickname}</span> ·{" "}
        <button type="button" onClick={() => setNaming(true)} className="underline-offset-4 hover:text-den-accent-soft hover:underline">
          change
        </button>
      </p>
      {error && <p className="mt-1 px-1 font-den-mono text-[11px] text-den-accent-soft">{error}</p>}
    </div>
  );
}

/**
 * the live room's chat, like a stream's side chat: the room's recent messages, following
 * the newest unless you've scrolled up to read, and a box to talk in. it only takes
 * messages while the stream's live, and off air the box is swapped for the live alerts
 * signup. the room owns the chat and the name (the stage shows the same messages as
 * bubbles), so they come in as props.
 *
 * @param {object} props
 * @param {boolean} props.live - the stream's on, so the chat's open.
 * @param {DjChat} props.chat - the room's chat, from useDjChat.
 * @param {string} props.nickname - your name.
 * @param {(nickname: string) => void} props.onNickname - saves a new name.
 * @returns {JSX.Element} the chat panel.
 */
export default function LiveChat({
  live,
  chat,
  nickname,
  onNickname,
}: {
  live: boolean;
  chat: DjChat;
  nickname: string;
  onNickname: (nickname: string) => void;
}) {
  const { messages, error, send } = chat;
  const [listRef, onListScroll] = useStickToBottom<HTMLOListElement>(messages?.at(-1)?.id);
  const empty = messages !== null && messages.length === 0;

  return (
    <section className="flex h-full min-h-0 flex-col border border-den-ink bg-den-raised">
      <header className="flex items-baseline justify-between border-b border-den-line px-4 py-2.5 font-den-mono text-[11px] uppercase">
        <h2 className="font-medium">Chat</h2>
        <span className="text-den-muted">{live ? "open while the set's on" : "opens when the next set starts"}</span>
      </header>

      <ol
        ref={listRef}
        onScroll={onListScroll}
        aria-live="polite"
        aria-label="Chat messages"
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-4 py-3"
      >
        {messages?.map((message) => (
          <ChatLine key={message.id} message={message} own={message.nickname === nickname} hint={sentAt(message.created_at)} />
        ))}
        {empty && live && <li className="font-den-mono text-xs text-den-muted">nobody&apos;s said anything yet. say hi.</li>}
        {empty && !live && (
          <li className="font-den-mono text-xs text-den-muted">
            the room&apos;s quiet.{" "}
            <Link href={LIVE_SECTION_PATH} className="border-b border-den-accent text-den-ink hover:text-den-accent-soft">
              the past sets
            </Link>{" "}
            are all recorded, chat and all.
          </li>
        )}
        {messages === null && <li className="font-den-mono text-xs text-den-muted">{error ?? "loading the chat..."}</li>}
      </ol>

      {/* off air there's nothing to type into, so the box's spot offers an email for next time */}
      <div className="border-t border-den-line p-3">
        {live ? (
          <Composer nickname={nickname} onNickname={onNickname} onSend={send} />
        ) : (
          <AlertSignup startOpen />
        )}
      </div>
    </section>
  );
}
