"use client";

import { adminRequest, errorMessage, useAdminData, useAdminFetch } from "./adminApi";
import { formatDate, plural } from "./format";
import type { Rsvp } from "./types";
import { Badge, Button, Card, FlashMessage, Muted, Toolbar, useFlash } from "./ui";

/**
 * The RSVPs tab: responses grouped by event, each event with its response
 * count and rough headcount (responders plus the friends they're bringing).
 */

/**
 * Groups RSVPs by event, keeping the backend's newest-first order inside each.
 * @param rsvps - All RSVPs.
 * @returns Event slug and its RSVPs, in order of each event's newest response.
 */
function groupByEvent(rsvps: Rsvp[]): [string, Rsvp[]][] {
  const groups = new Map<string, Rsvp[]>();
  for (const rsvp of rsvps) {
    const group = groups.get(rsvp.event_slug);
    if (group) group.push(rsvp);
    else groups.set(rsvp.event_slug, [rsvp]);
  }
  return [...groups.entries()];
}

/**
 * One response.
 * @param props.rsvp - The RSVP.
 * @param props.onDelete - Called to delete it (after confirming).
 */
function RsvpCard({ rsvp, onDelete }: { rsvp: Rsvp; onDelete: () => void }) {
  return (
    <Card className="flex gap-3 p-3">
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-white">{rsvp.name || <span className="text-slate-500">no name</span>}</div>
        <div className="mt-0.5 break-all text-sm text-slate-300">{rsvp.contact_value}</div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone="grey">{rsvp.contact_type}</Badge>
          {rsvp.friends_count > 0 && <Badge tone="orange">+{rsvp.friends_count} friends</Badge>}
          {rsvp.wants_address && <Badge tone="green">wants address</Badge>}
          {rsvp.wants_reminder && <Badge tone="green">wants reminder</Badge>}
          <span className="text-xs text-slate-500">{formatDate(rsvp.created_at)}</span>
        </div>
      </div>
      <Button size="sm" variant="danger" className="self-start" onClick={onDelete} aria-label="Delete RSVP">
        Delete
      </Button>
    </Card>
  );
}

/**
 * The RSVPs tab.
 */
export default function RsvpsTab() {
  const adminFetch = useAdminFetch();
  const rsvps = useAdminData<Rsvp[]>("/events/rsvp", "couldn't load RSVPs");
  const [flash, showFlash] = useFlash();

  const deleteRsvp = async (id: number) => {
    if (!window.confirm("Delete this RSVP? This can't be undone.")) return;
    try {
      await adminRequest(adminFetch, `/events/rsvp/${id}`, "couldn't delete the RSVP", { method: "DELETE" });
      rsvps.setData((current) => current?.filter((rsvp) => rsvp.id !== id) ?? null);
    } catch (err) {
      showFlash("error", errorMessage(err));
    }
  };

  if (!rsvps.data) return <Muted>{rsvps.error ?? "Loading RSVPs..."}</Muted>;

  return (
    <div>
      <Toolbar summary={plural(rsvps.data.length, "RSVP")}>
        <Button size="sm" onClick={rsvps.reload}>
          Refresh
        </Button>
      </Toolbar>
      <FlashMessage flash={flash} />
      {rsvps.data.length === 0 && <Muted>No RSVPs yet.</Muted>}
      <div className="flex flex-col gap-6">
        {groupByEvent(rsvps.data).map(([eventSlug, rows]) => {
          const headcount = rows.length + rows.reduce((sum, rsvp) => sum + rsvp.friends_count, 0);
          return (
            <section key={eventSlug}>
              <h2 className="mb-2 flex flex-wrap items-baseline gap-x-2 font-semibold text-white">
                {eventSlug}
                <span className="text-xs font-normal text-slate-400">
                  {rows.length} responded - about {headcount} people
                </span>
              </h2>
              <div className="grid gap-2 md:grid-cols-2">
                {rows.map((rsvp) => (
                  <RsvpCard key={rsvp.id} rsvp={rsvp} onDelete={() => deleteRsvp(rsvp.id)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
