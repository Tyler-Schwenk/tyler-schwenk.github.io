"use client";

import Link from "next/link";
import { fetchDjStatus, LIVE_SECTION_PATH } from "@/app/opium-den/djApi";
import { usePoll } from "@/lib/usePoll";
import LiveStatus from "./LiveStatus";

// how quickly a den visitor notices the stream going live, without hammering the pi
const STATUS_POLL_INTERVAL_MS = 15000;

/**
 * the den's way over to the live section, where the dj sets live: one panel with the live
 * status, with a red edge while the stream's on. the whole panel's the link.
 *
 * @returns {JSX.Element} the link.
 */
export default function LiveSectionLink() {
  const { data: status } = usePoll(fetchDjStatus, STATUS_POLL_INTERVAL_MS);
  const live = Boolean(status?.live);

  return (
    <Link
      href={LIVE_SECTION_PATH}
      className={`group mt-14 flex items-center gap-4 border border-den-ink bg-den-raised p-4 transition-colors hover:bg-den-bg ${
        live ? "shadow-[inset_3px_0_0_var(--color-den-accent)]" : ""
      }`}
    >
      {/* a div, not a span: LiveStatus is a paragraph */}
      <div className="min-w-0 flex-1">
        <span className="block text-2xl font-extrabold tracking-[-0.04em] text-den-ink transition-colors group-hover:text-den-accent-soft">
          Live from the den
        </span>
        <span className="mt-0.5 block text-sm text-den-muted">my dj sets, live and recorded, with their chat</span>
        <LiveStatus status={status} className="mt-2 text-[11px]" />
      </div>
      <span className="shrink-0 text-xl text-den-accent transition-transform group-hover:translate-x-1" aria-hidden="true">
        &rarr;
      </span>
    </Link>
  );
}
