"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { confirmDjAlerts, LIVE_ROOM_PATH, LIVE_SECTION_PATH, unsubscribeFromDjAlerts } from "@/app/opium-den/djApi";
import AlertSignup from "./AlertSignup";

/** what the page was opened to do, from its query. */
type LinkAction = { kind: "confirm" | "unsubscribe"; token: string } | null;

/** how the link's request went: still going, done (with what to say), or failed. */
type Outcome = { state: "working" } | { state: "done"; message: string } | { state: "failed"; message: string };

const HEADINGS = {
  confirm: "You're on the list",
  unsubscribe: "You're off the list",
  signup: "Live alerts",
};

/**
 * reads what an email's link asked for: ?confirm=<token> or ?unsubscribe=<token>.
 *
 * @param {URLSearchParams} params - the page's query.
 * @returns {LinkAction} the action and its token, or null for a plain visit.
 */
function readAction(params: URLSearchParams): LinkAction {
  const confirm = params.get("confirm");
  if (confirm) return { kind: "confirm", token: confirm };
  const unsubscribe = params.get("unsubscribe");
  if (unsubscribe) return { kind: "unsubscribe", token: unsubscribe };
  return null;
}

/**
 * runs a link's action against the backend.
 *
 * @param {NonNullable<LinkAction>} action - what to do.
 * @returns {Promise<string>} what to tell the visitor once it's done.
 */
async function runAction(action: NonNullable<LinkAction>): Promise<string> {
  if (action.kind === "confirm") {
    const email = await confirmDjAlerts(action.token);
    return `${email} will get an email when I go live.`;
  }
  await unsubscribeFromDjAlerts(action.token);
  return "no more live alerts. changed your mind? sign up again any time.";
}

/**
 * where the live alerts emails link to. with ?confirm= it confirms the signup, with
 * ?unsubscribe= it takes them off the list, both as soon as the page opens (a page doing
 * it, not the link itself, so mail scanners that open links can't trigger either). a
 * plain visit is just the signup, so the page doubles as a link to send people.
 *
 * @returns {JSX.Element} the page's content.
 */
export default function AlertsLanding() {
  const params = useSearchParams();
  const action = readAction(params);
  const kind = action?.kind;
  const token = action?.token;
  const [outcome, setOutcome] = useState<Outcome>({ state: "working" });

  useEffect(() => {
    if (!kind || !token) return;
    let cancelled = false;
    runAction({ kind, token })
      .then((message) => !cancelled && setOutcome({ state: "done", message }))
      .catch((err) => !cancelled && setOutcome({ state: "failed", message: (err as Error).message }));
    return () => {
      cancelled = true;
    };
  }, [kind, token]);

  const heading = !action ? HEADINGS.signup : outcome.state === "failed" ? "That link didn't work" : HEADINGS[action.kind];

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-24 sm:px-5 sm:pt-28">
      <h1 className="border-b border-den-ink pb-2 text-[2.5rem] font-extrabold leading-none tracking-[-0.045em]">
        {heading}
        <span className="text-den-accent">.</span>
      </h1>

      {action && outcome.state === "working" && <p className="mt-6 text-den-muted">one sec...</p>}
      {action && outcome.state !== "working" && <p className="mt-6 text-den-muted">{outcome.message}</p>}
      {!action && (
        <p className="mt-6 text-den-muted">
          I stream dj sets live from the den. leave your email and you&apos;ll hear when one&apos;s on.
        </p>
      )}

      {/* a plain visit, an unsubscribe, or a broken link all get the chance to sign up */}
      {action?.kind !== "confirm" || outcome.state === "failed" ? (
        <AlertSignup startOpen={!action} className="mt-8" />
      ) : null}

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
