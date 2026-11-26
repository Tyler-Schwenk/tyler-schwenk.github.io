"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LIVE_ROOM_PATH, LIVE_SECTION_PATH, unsubscribeFromDjAlerts } from "@/app/opium-den/djApi";
import AlertSignup from "./AlertSignup";

/** how the link's request went: still going, done (with what to say), or failed. */
type Outcome = { state: "working" } | { state: "done"; message: string } | { state: "failed"; message: string };

const HEADINGS = {
  unsubscribe: "You're off the list",
  signup: "Live alerts",
};
const UNSUBSCRIBED_MESSAGE = "no more live alerts. changed your mind? sign up again any time.";

/**
 * where the live alerts emails' unsubscribe link goes. with ?unsubscribe=<token> it
 * takes them off the list as soon as the page opens (a page doing it, not the link
 * itself, so mail scanners that open links can't). a plain visit is just the signup, so
 * the page doubles as a link to send people.
 *
 * @returns {JSX.Element} the page's content.
 */
export default function AlertsLanding() {
  const params = useSearchParams();
  // null on a plain visit, when it's just the signup
  const token = params.get("unsubscribe") || null;
  const [outcome, setOutcome] = useState<Outcome>({ state: "working" });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    unsubscribeFromDjAlerts(token)
      .then(() => !cancelled && setOutcome({ state: "done", message: UNSUBSCRIBED_MESSAGE }))
      .catch((err) => !cancelled && setOutcome({ state: "failed", message: (err as Error).message }));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const heading = !token ? HEADINGS.signup : outcome.state === "failed" ? "That link didn't work" : HEADINGS.unsubscribe;

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-24 sm:px-5 sm:pt-28">
      <h1 className="border-b border-den-ink pb-2 text-[2.5rem] font-extrabold leading-none tracking-[-0.045em]">
        {heading}
        <span className="text-den-accent">.</span>
      </h1>

      {token && outcome.state === "working" && <p className="mt-6 text-den-muted">one sec...</p>}
      {token && outcome.state !== "working" && <p className="mt-6 text-den-muted">{outcome.message}</p>}
      {!token && (
        <p className="mt-6 text-den-muted">
          I stream dj sets live from the den. leave your email and you&apos;ll hear when one&apos;s on.
        </p>
      )}

      {/* a plain visit, an unsubscribe, or a broken link all get the chance to sign up */}
      <AlertSignup startOpen={!token} className="mt-8" />

      <p className="mt-10 flex gap-5 font-den-mono text-[11px] uppercase">
        <Link href={LIVE_ROOM_PATH} className="border-b border-den-accent transition-colors hover:text-den-accent-soft">
          Live room &rarr;
        </Link>
        <Link href={LIVE_SECTION_PATH} className="border-b border-den-accent transition-colors hover:text-den-accent-soft">
          Past sets &rarr;
        </Link>
      </p>
    </main>
  );
}
