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
import { useChatNickname, useDjChat } from "@/lib/useDjChat";
import { useStickToBottom } from "@/lib/useStickToBottom";
import AlertSignup from "./AlertSignup";
import ChatLine from "./ChatLine";
import { SendIcon } from "./playerIcons";

// 16px text on phones: ios zooms the whole page into any input smaller than that
const INPUT_BASE_CLASS =
  "min-w-0 flex-1 border bg-den-bg py-2 text-base text-den-ink placeholder:text-den-faint focus:outline-none sm:text-sm";
// the message box is a pill; the name field is squarer and outlined in red, so the two never look alike
const MESSAGE_INPUT_CLASS = `${INPUT_BASE_CLASS} rounded-full border-den-line px-4 focus:border-den-accent/60`;
const NAME_INPUT_CLASS = `${INPUT_BASE_CLASS} rounded-md border-den-accent/50 px-3 focus:border-den-accent`;

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
 * the "pick a name" panel. it opens above the message box the first time you send (your
 * message waits in the box and goes out as soon as there's a name), or from "change".
 * styled as its own labelled form so it can't be mistaken for the message box.
 *
 * @param {object} props
 * @param {string} props.initial - the current name, to edit, or "".
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
    <form onSubmit={submit} className="mb-3 rounded-lg border border-den-accent/40 bg-den-accent/10 p-3">
      <label htmlFor="den-chat-name" className="block text-sm font-medium">
        {initial ? "Change your name" : "Pick a name first"}
      </label>
      <p className="mt-0.5 text-xs text-den-muted">
        it shows next to your messages{hasPending ? ", and your message sends as soon as you pick one." : "."}
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
          className="min-h-10 shrink-0 rounded-md bg-den-accent px-4 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-40"
        >
          {hasPending ? "Send" : "Save"}
        </button>
      </div>
      <button type="button" onClick={onCancel} className="mt-2 text-xs text-den-faint transition-colors hover:text-den-accent-soft">
        cancel
      </button>
    </form>
  );
}

/**
 * where you talk: always a message box, so typing goes where you'd expect. without a
 * name yet, sending opens the name panel instead and the message waits for it, and the
 * same happens when the name turns out to be someone else's. under the box it says who
 * you're chatting as, with a way to change it.
 *
 * @param {object} props
 * @param {string} props.nickname - the saved name, "" before one's picked.
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
    if (!nickname) {
      setNaming(true);
      return;
    }
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
      <p className="mt-2 px-1 text-xs text-den-faint">
        {nickname ? (
          <>
            chatting as <span className="text-den-ink/80">{nickname}</span> ·{" "}
            <button type="button" onClick={() => setNaming(true)} className="underline-offset-4 hover:text-den-accent-soft hover:underline">
              change
            </button>
          </>
        ) : (
          "you'll pick a name when you send your first message"
        )}
      </p>
      {error && <p className="mt-1 px-1 text-xs text-den-accent-soft">{error}</p>}
    </div>
  );
}

/**
 * the live room's chat, like a stream's side chat: the room's recent messages, following
 * the newest unless you've scrolled up to read, and a box to talk in. anyone can read it;
 * it only takes messages while the stream's live, and off air the box is swapped for the
 * live alerts signup. names are remembered in this browser.
 *
 * @param {object} props
 * @param {boolean} props.live - the stream's on, so the chat's open.
 * @returns {JSX.Element} the chat panel.
 */
export default function LiveChat({ live }: { live: boolean }) {
  const { messages, error, send } = useDjChat();
  const [nickname, setNickname] = useChatNickname();
  const [listRef, onListScroll] = useStickToBottom<HTMLOListElement>(messages?.at(-1)?.id);
  const empty = messages !== null && messages.length === 0;

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-den-line bg-den-raised/70">
      <header className="flex items-baseline justify-between border-b border-den-line px-4 py-3">
        <h2 className="text-sm font-semibold">Chat</h2>
        <span className="text-xs text-den-faint">{live ? "open while the set's on" : "opens when the next set starts"}</span>
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
        {empty && live && <li className="text-sm text-den-faint">nobody&apos;s said anything yet. say hi.</li>}
        {empty && !live && (
          <li className="text-sm text-den-faint">
            the room&apos;s quiet.{" "}
            <Link href={LIVE_SECTION_PATH} className="text-den-accent-soft underline-offset-4 hover:underline">
              the past sets
            </Link>{" "}
            are all recorded, chat and all.
          </li>
        )}
        {messages === null && <li className="text-sm text-den-faint">{error ?? "loading the chat..."}</li>}
      </ol>

      {/* off air there's nothing to type into, so the box's spot offers an email for next time */}
      <div className="border-t border-den-line p-3">
        {live ? (
          <Composer nickname={nickname} onNickname={setNickname} onSend={send} />
        ) : (
          <AlertSignup startOpen />
        )}
      </div>
    </section>
  );
}
