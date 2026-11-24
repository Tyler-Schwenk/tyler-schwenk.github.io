import type { ReactNode } from "react";
import type { DjChatMessage } from "@/app/opium-den/djApi";

/**
 * one chat line, shared by the live room and a set's replay: the name in small mono caps,
 * red (yours in ink), then the message.
 *
 * @param {object} props
 * @param {Pick<DjChatMessage, "nickname" | "content">} props.message - who said what.
 * @param {boolean} props.own - it's from this chatter's nickname.
 * @param {string} props.hint - shown on hover, like when it was sent.
 * @param {ReactNode} [props.lead] - something before the name, like the replay's timestamp.
 * @returns {JSX.Element} the line.
 */
export default function ChatLine({
  message,
  own,
  hint,
  lead,
}: {
  message: Pick<DjChatMessage, "nickname" | "content">;
  own: boolean;
  hint: string;
  lead?: ReactNode;
}) {
  return (
    <li className="break-words text-sm leading-relaxed" title={hint}>
      {lead}
      <span className={`font-den-mono text-[11px] font-medium uppercase ${own ? "text-den-ink" : "text-den-accent-soft"}`}>
        {message.nickname}
      </span>{" "}
      <span className="text-den-ink">{message.content}</span>
    </li>
  );
}
