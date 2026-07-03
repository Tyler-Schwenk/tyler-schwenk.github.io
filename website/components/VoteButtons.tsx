"use client";

import { useState } from "react";

type VoteDirection = 1 | -1;

/**
 * Up/down vote arrows with a score display. Dumb/reusable for posts and
 * comments alike — the parent owns the actual vote state and fetch call;
 * this component just renders and reports clicks. Styled per Round Table's
 * neobrutalism theme (see website/docs/themes/neobrutalism.md): a small
 * bordered block with hard-edged arrow buttons.
 *
 * @param {object} props - Component props.
 * @param {number} props.score - Current net score to display.
 * @param {1 | -1 | 0} props.yourVote - This visitor's current vote state (0 = no vote).
 * @param {(direction: VoteDirection) => Promise<void>} props.onVote - Called with the clicked direction; the backend decides whether it's a new vote, a flip, or a retraction.
 * @returns {JSX.Element} The vote control.
 */
export default function VoteButtons({
  score,
  yourVote,
  onVote,
}: {
  score: number;
  yourVote: 1 | -1 | 0;
  onVote: (direction: VoteDirection) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  /**
   * Wraps onVote so rapid double-clicks can't fire overlapping requests.
   *
   * @param {VoteDirection} direction - The vote direction clicked.
   */
  async function handleClick(direction: VoteDirection) {
    if (pending) return;
    setPending(true);
    try {
      await onVote(direction);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center border-[3px] border-[var(--n-border-default)] bg-[var(--n-neutral-primary-soft)] shadow-[var(--n-shadow-sm)] select-none shrink-0">
      <button
        type="button"
        aria-label="Upvote"
        disabled={pending}
        onClick={() => handleClick(1)}
        className={`w-9 h-8 flex items-center justify-center text-base leading-none border-b-[3px] border-[var(--n-border-default)] transition-colors duration-100 ease-linear disabled:opacity-50 ${
          yourVote === 1 ? "bg-[var(--n-brand)] text-black" : "text-[var(--n-heading)] hover:bg-[var(--n-brand-softer)]"
        }`}
      >
        &#9650;
      </button>
      <span className="w-9 py-1 text-center text-sm font-bold font-[family-name:var(--n-font-mono)] text-[var(--n-heading)]">
        {score}
      </span>
      <button
        type="button"
        aria-label="Downvote"
        disabled={pending}
        onClick={() => handleClick(-1)}
        className={`w-9 h-8 flex items-center justify-center text-base leading-none border-t-[3px] border-[var(--n-border-default)] transition-colors duration-100 ease-linear disabled:opacity-50 ${
          yourVote === -1 ? "bg-[var(--n-pink)] text-white" : "text-[var(--n-heading)] hover:bg-[var(--n-brand-softer)]"
        }`}
      >
        &#9660;
      </button>
    </div>
  );
}
