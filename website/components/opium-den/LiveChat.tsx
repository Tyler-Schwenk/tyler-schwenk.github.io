"use client";

import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { parseBackendTime } from "@/app/admin/format";
import { DJ_CHAT_MESSAGE_MAX_LENGTH, DJ_CHAT_NICKNAME_MAX_LENGTH, type DjChatMessage } from "@/app/opium-den/djApi";
import { useChatNickname, useDjChat } from "@/lib/useDjChat";
import { SendIcon } from "./playerIcons";

// how close to the bottom still counts as "reading the latest", so new messages follow along
const STICK_TO_BOTTOM_PX = 48;
const INPUT_CLASS =
  "min-w-0 flex-1 rounded-full border border-den-line bg-den-bg px-4 py-2 text-sm text-den-ink placeholder:text-den-faint focus:border-den-accent/60 focus:outline-none disabled:opacity-60";

/**
 * one chat line: the name in red (yours in white), then the message. hover for the time.
 *
 * @param {object} props
 * @param {DjChatMessage} props.message - the message.
 * @param {boolean} props.own - it's from this chatter's nickname.
 * @returns {JSX.Element} the line.
 */
function ChatLine({ message, own }: { message: DjChatMessage; own: boolean }) {
  const sentAt = parseBackendTime(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <li className="break-words text-sm leading-relaxed" title={sentAt}>
      <span className={`font-semibold ${own ? "text-den-ink" : "text-den-accent-soft"}`}>{message.nickname}</span>{" "}
      <span className="text-den-ink/90">{message.content}</span>
    </li>
  );
}

/**
 * the name step: pick what you're called before your first message.
 *
 * @param {object} props
 * @param {(nickname: string) => void} props.onPick - saves the name.
 * @returns {JSX.Element} the form.
 */
function NicknameForm({ onPick }: { onPick: (nickname: string) => void }) {
  const [draft, setDraft] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const name = draft.trim();
    if (name) onPick(name);
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="pick a name to chat"
        maxLength={DJ_CHAT_NICKNAME_MAX_LENGTH}
        aria-label="Your chat name"
        className={INPUT_CLASS}
      />
      <button
        type="submit"
        disabled={!draft.trim()}
        className="rounded-full bg-den-accent px-4 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-40"
      >
        Join
      </button>
    </form>
  );
}

/**
 * the message box, with who you're chatting as and a way to change it.
 *
 * @param {object} props
 * @param {string} props.nickname - who's chatting.
 * @param {() => void} props.onChangeName - forgets the name so a new one can be picked.
 * @param {(content: string) => Promise<void>} props.onSend - sends; throws with a readable reason.
 * @returns {JSX.Element} the form.
 */
function MessageForm({
  nickname,
  onChangeName,
  onSend,
}: {
  nickname: string;
  onChangeName: () => void;
  onSend: (content: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await onSend(content);
      setDraft("");
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="say something"
          maxLength={DJ_CHAT_MESSAGE_MAX_LENGTH}
          aria-label="Chat message"
          className={INPUT_CLASS}
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Send"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-den-accent text-white transition hover:brightness-110 disabled:opacity-40"
        >
          <SendIcon className="h-4 w-4" />
        </button>
      </form>
      <p className="mt-2 px-1 text-xs text-den-faint">
        chatting as <span className="text-den-ink/80">{nickname}</span> ·{" "}
        <button type="button" onClick={onChangeName} className="underline-offset-4 hover:text-den-accent-soft hover:underline">
          change
        </button>
      </p>
      {error && <p className="mt-1 px-1 text-xs text-den-accent-soft">{error}</p>}
    </div>
  );
}

/**
 * the live room's chat, like a stream's side chat: the room's recent messages, following
 * the newest unless you've scrolled up to read, and a box to talk in. anyone can read it;
 * it only takes messages while the stream's live. names are remembered in this browser.
 *
 * @param {object} props
 * @param {boolean} props.live - the stream's on, so the chat's open.
 * @returns {JSX.Element} the chat panel.
 */
export default function LiveChat({ live }: { live: boolean }) {
  const { messages, error, send } = useDjChat();
  const [nickname, setNickname] = useChatNickname();
  const listRef = useRef<HTMLOListElement>(null);
  const stickRef = useRef(true);
  const lastId = messages?.at(-1)?.id;

  // follow new messages, unless they've scrolled up to read something
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && stickRef.current) list.scrollTop = list.scrollHeight;
  }, [lastId]);

  const onScroll = () => {
    const list = listRef.current;
    if (!list) return;
    stickRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < STICK_TO_BOTTOM_PX;
  };

  const empty = messages !== null && messages.length === 0;

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-den-line bg-den-raised/70">
      <header className="flex items-baseline justify-between border-b border-den-line px-4 py-3">
        <h2 className="text-sm font-semibold">Chat</h2>
        <span className="text-xs text-den-faint">{live ? "open while the set's on" : "opens when the next set starts"}</span>
      </header>

      <ol
        ref={listRef}
        onScroll={onScroll}
        aria-live="polite"
        aria-label="Chat messages"
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-3"
      >
        {messages?.map((message) => (
          <ChatLine key={message.id} message={message} own={message.nickname === nickname} />
        ))}
        {empty && (
          <li className="text-sm text-den-faint">{live ? "nobody's said anything yet. say hi." : "the room's quiet."}</li>
        )}
        {messages === null && <li className="text-sm text-den-faint">{error ?? "loading the chat..."}</li>}
      </ol>

      {/* off air there's nothing to type into; the header already says when it opens */}
      {live && (
        <div className="border-t border-den-line p-3">
          {nickname ? (
            <MessageForm nickname={nickname} onChangeName={() => setNickname("")} onSend={(content) => send(nickname, content)} />
          ) : (
            <NicknameForm onPick={setNickname} />
          )}
        </div>
      )}
    </section>
  );
}
