"use client";

import { useState } from "react";

type VoteDirection = 1 | -1;

/**
 * Up/down vote arrows with a score display. Dumb/reusable for posts and
 * comments alike — the parent owns the actual vote state and fetch call;
 * this component just renders and reports clicks.
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
    <div className="flex flex-col items-center gap-1 select-none">
      <button
        type="button"
        aria-label="Upvote"
        disabled={pending}
        onClick={() => handleClick(1)}
        className={`text-lg leading-none transition disabled:opacity-50 ${
          yourVote === 1 ? "text-orange-400" : "text-gray-400 hover:text-orange-300"
        }`}
      >
        ▲
      </button>
      <span className="text-sm font-semibold text-gray-200">{score}</span>
      <button
        type="button"
        aria-label="Downvote"
        disabled={pending}
        onClick={() => handleClick(-1)}
        className={`text-lg leading-none transition disabled:opacity-50 ${
          yourVote === -1 ? "text-blue-400" : "text-gray-400 hover:text-blue-300"
        }`}
      >
        ▼
      </button>
    </div>
  );
}
