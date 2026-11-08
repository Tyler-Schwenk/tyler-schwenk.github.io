"use client";

import { useEffect } from "react";
import { useAdminData } from "./adminApi";
import { formatElapsed } from "./format";
import type { PresencePerson, PresenceState } from "./types";
import { Badge, Button, Card, Muted, Toolbar } from "./ui";

/**
 * The Home tab: who's home, from whose phone is on the wifi. The presence agent on
 * fart-pi scans for phones and the backend decides who counts as home (see
 * pi/docs/services/presence-agent.md).
 */

// the agent scans every 15 s, so this keeps the page about as fresh as the data
const REFRESH_INTERVAL_MS = 30_000;
const MS_PER_MIN = 60_000;

// arrivals newer than this read as "x min ago", older ones as a clock time
const RECENT_ARRIVAL_MS = 30 * MS_PER_MIN;

/**
 * When someone arrived, for timing the wifi against walking in the door.
 * @param arrivedAtMs - Epoch ms of the arrival.
 * @param nowMs - The backend's clock.
 * @returns Like "arrived 4 min ago (3:42:10 PM)", "arrived at 3:42 PM" or "arrived Sat 3:42 PM".
 */
function describeArrival(arrivedAtMs: number, nowMs: number): string {
  const arrivedAt = new Date(arrivedAtMs);
  if (nowMs - arrivedAtMs < RECENT_ARRIVAL_MS) {
    const exact = arrivedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
    return `arrived ${formatElapsed(nowMs - arrivedAtMs)} ago (${exact})`;
  }
  const time = arrivedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const sameDay = arrivedAt.toDateString() === new Date(nowMs).toDateString();
  if (sameDay) return `arrived at ${time}`;
  return `arrived ${arrivedAt.toLocaleDateString([], { weekday: "short" })} ${time}`;
}

/**
 * One person's row.
 * @param props.person - Who, when they were last seen and arrived, and whether that's home.
 * @param props.nowMs - The backend's clock, so "seen 3 min ago" doesn't depend on the phone's.
 */
function PersonRow({ person, nowMs }: { person: PresencePerson; nowMs: number }) {
  const seen =
    person.last_seen_ms === null
      ? "not seen yet"
      : `seen ${formatElapsed(nowMs - person.last_seen_ms)} ago`;
  return (
    <Card className="flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-white">{person.name}</div>
        {person.arrived_at_ms !== null && (
          <div className="mt-0.5 text-sm text-slate-200">{describeArrival(person.arrived_at_ms, nowMs)}</div>
        )}
        <div className="mt-0.5 text-sm text-slate-400">{seen}</div>
      </div>
      <Badge tone={person.home ? "green" : "grey"}>{person.home ? "home" : "away"}</Badge>
    </Card>
  );
}

/**
 * The Home tab.
 */
export default function PresenceTab() {
  const presence = useAdminData<PresenceState>("/presence", "couldn't load who's home");
  const { reload } = presence;

  useEffect(() => {
    const timer = window.setInterval(reload, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [reload]);

  if (!presence.data) return <Muted>{presence.error ?? "Checking who's home..."}</Muted>;

  const { people, now_ms: nowMs, agent_online: agentOnline, away_after_ms: awayAfterMs } = presence.data;
  const homeCount = people.filter((person) => person.home).length;

  return (
    <div>
      <Toolbar summary={`${homeCount} of ${people.length} home`}>
        <Button size="sm" onClick={reload}>
          Refresh
        </Button>
      </Toolbar>
      {!agentOnline && (
        <Card className="mb-4 border-orange-900 p-3 text-sm text-orange-300">
          The presence agent on fart-pi isn&apos;t checking in, so this is out of date. Check it&apos;s running:{" "}
          <code>journalctl -u presence-agent</code>
        </Card>
      )}
      {presence.error && <p className="mb-4 text-sm text-red-400">{presence.error}</p>}
      {people.length === 0 && <Muted>Nobody to watch for yet. Add people to people.json on fart-pi.</Muted>}
      <div className="grid gap-2 md:grid-cols-2">
        {people.map((person) => (
          <PersonRow key={person.name} person={person} nowMs={nowMs} />
        ))}
      </div>
      <p className="mt-6 text-xs text-slate-500">
        Home means their phone answered on the wifi in the last {Math.round(awayAfterMs / MS_PER_MIN)} min.
        Sleeping phones go quiet for a while, so leaving takes that long to show. Arriving means their phone
        came back after being quiet that long, timed to within about 15 s.
      </p>
    </div>
  );
}
