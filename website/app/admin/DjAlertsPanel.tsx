"use client";

import { useState, type FormEvent } from "react";
import {
  DJ_ALERT_BODY_MAX_LENGTH,
  DJ_ALERT_DEFAULT_SUBJECT,
  DJ_ALERT_SUBJECT_MAX_LENGTH,
  DJ_ALERTS_PATH,
  djGuestAlertSubject,
  type DjAlertSendResult,
  type DjAlertSubscriber,
} from "@/app/opium-den/djApi";
import { adminRequest, errorMessage, jsonBody, useAdminData, useAdminFetch } from "./adminApi";
import { formatDate, plural } from "./format";
import { Badge, Button, Card, Field, FlashMessage, INPUT_CLASS, Muted, Toolbar, useFlash } from "./ui";

/**
 * The live alerts panel: write an email and send it to everyone who's signed up and
 * confirmed. Nothing goes out on its own; this is the only way an alert is sent. Sending
 * while a set's recording also makes the subject and message that set's title and
 * description (the backend does it), editable in the set list like any set.
 *
 * Two versions share the form: the admin's (the DJ tab), with who's signed up and remove,
 * and a guest dj's (/guest-dj), which only gets the count, and can only send while
 * they're on air, once per set.
 */

const SUBSCRIBERS_PATH = `${DJ_ALERTS_PATH}/subscribers`;
const AUDIENCE_PATH = `${DJ_ALERTS_PATH}/audience`;

/**
 * What to say once a send's done.
 * @param result - The backend's answer.
 * @returns Like "Sent to 12." or "Sent to 11. Couldn't send to: a@b.com".
 */
function sendSummary(result: DjAlertSendResult): string {
  const labelled = result.labelled_set_id !== null ? " It's the live set's title and description now too." : "";
  const sent = `Sent to ${plural(result.sent, "person", "people")}.${labelled}`;
  if (result.failed.length) return `${sent} Couldn't send to: ${result.failed.join(", ")}`;
  // guests get the count but not the addresses
  if (result.failed_count) return `${sent} The mail server turned away ${plural(result.failed_count, "address", "addresses")}.`;
  return sent;
}

/**
 * Whether a send result had anything refused.
 * @param result - The backend's answer.
 * @returns True if any address was turned away.
 */
function anyFailed(result: DjAlertSendResult): boolean {
  return result.failed.length > 0 || Boolean(result.failed_count);
}

/**
 * The subject and message form, and the send button.
 * @param props.confirmed - How many it'll go to.
 * @param props.defaultSubject - What a blank subject becomes.
 * @param props.blockedReason - Why it can't be sent right now, shown in place of sending; null when it can.
 * @param props.onSent - Called after a send with the backend's answer.
 */
function AlertComposer({
  confirmed,
  defaultSubject,
  blockedReason,
  onSent,
}: {
  confirmed: number;
  defaultSubject: string;
  blockedReason: string | null;
  onSent: (result: DjAlertSendResult) => void;
}) {
  const adminFetch = useAdminFetch();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [flash, showFlash] = useFlash();

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim() || sending || blockedReason) return;
    if (!window.confirm(`Email this to ${plural(confirmed, "person", "people")}? It can't be unsent.`)) return;
    setSending(true);
    try {
      const result = await adminRequest<DjAlertSendResult>(
        adminFetch,
        `${DJ_ALERTS_PATH}/send`,
        "couldn't send the alert",
        jsonBody("POST", { subject: subject.trim() || null, body: body.trim() })
      );
      if (result) {
        showFlash(anyFailed(result) ? "error" : "success", sendSummary(result));
        onSent(result);
      }
      setSubject("");
      setBody("");
    } catch (err) {
      showFlash("error", errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <form onSubmit={send} className="flex flex-col gap-3">
        <Field label="Subject" htmlFor="dj-alert-subject">
          <input
            id="dj-alert-subject"
            className={INPUT_CLASS}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder={defaultSubject}
            maxLength={DJ_ALERT_SUBJECT_MAX_LENGTH}
          />
        </Field>
        <Field label="Message" htmlFor="dj-alert-body">
          <textarea
            id="dj-alert-body"
            className={`${INPUT_CLASS} min-h-28 resize-y`}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="What's the set? The room link and an unsubscribe link get added under it."
            maxLength={DJ_ALERT_BODY_MAX_LENGTH}
          />
        </Field>
        {blockedReason && <Muted>{blockedReason}</Muted>}
        <Button
          type="submit"
          variant="primary"
          className="self-end"
          disabled={!body.trim() || sending || confirmed === 0 || blockedReason !== null}
        >
          {sending ? "Sending..." : `Send to ${plural(confirmed, "person", "people")}`}
        </Button>
      </form>
      <FlashMessage flash={flash} />
    </>
  );
}

/**
 * Everyone signed up, with whether they've confirmed and a remove button.
 * @param props.subscribers - The list.
 * @param props.onRemove - Removes one (after confirming).
 */
function SubscriberList({
  subscribers,
  onRemove,
}: {
  subscribers: DjAlertSubscriber[];
  onRemove: (subscriber: DjAlertSubscriber) => void;
}) {
  if (subscribers.length === 0) return <Muted>Nobody&apos;s signed up yet.</Muted>;
  return (
    <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
      {subscribers.map((subscriber) => (
        <li key={subscriber.id} className="flex items-center gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-slate-200">{subscriber.email}</span>
          <span className="hidden text-xs text-slate-500 sm:inline">{formatDate(subscriber.created_at)}</span>
          <Badge tone={subscriber.confirmed_at ? "green" : "orange"}>
            {subscriber.confirmed_at ? "confirmed" : "unconfirmed"}
          </Badge>
          <Button size="sm" variant="danger" onClick={() => onRemove(subscriber)}>
            Remove
          </Button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The admin's live alerts panel, with who's signed up.
 * @param props.onLabelledSet - Called after a send that relabelled the live set, so the set list can reload.
 */
export default function DjAlertsPanel({ onLabelledSet }: { onLabelledSet: () => void }) {
  const adminFetch = useAdminFetch();
  const subscribers = useAdminData<DjAlertSubscriber[]>(SUBSCRIBERS_PATH, "couldn't load alert signups");
  const [flash, showFlash] = useFlash();
  const confirmed = subscribers.data?.filter((subscriber) => subscriber.confirmed_at).length ?? 0;
  const unconfirmed = (subscribers.data?.length ?? 0) - confirmed;

  const remove = async (subscriber: DjAlertSubscriber) => {
    if (!window.confirm(`Take ${subscriber.email} off the alerts list?`)) return;
    try {
      await adminRequest(adminFetch, `${SUBSCRIBERS_PATH}/${subscriber.id}`, "couldn't remove them", { method: "DELETE" });
      subscribers.setData((current) => current?.filter((row) => row.id !== subscriber.id) ?? null);
    } catch (err) {
      showFlash("error", errorMessage(err));
    }
  };

  const summary = subscribers.data
    ? `Live alerts: ${plural(confirmed, "person", "people")} signed up${unconfirmed ? `, ${unconfirmed} unconfirmed` : ""}`
    : "Live alerts";

  return (
    <Card className="mb-4 p-3">
      <Toolbar summary={summary}>
        <Button size="sm" onClick={subscribers.reload}>
          Refresh
        </Button>
      </Toolbar>
      {subscribers.error && !subscribers.data && <Muted>{subscribers.error}</Muted>}
      <AlertComposer
        confirmed={confirmed}
        defaultSubject={DJ_ALERT_DEFAULT_SUBJECT}
        blockedReason={null}
        onSent={(result) => {
          if (result.labelled_set_id != null) onLabelledSet();
        }}
      />
      <FlashMessage flash={flash} />
      {subscribers.data && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-slate-400">Who&apos;s signed up</summary>
          <div className="mt-3">
            <SubscriberList subscribers={subscribers.data} onRemove={remove} />
          </div>
        </details>
      )}
    </Card>
  );
}

/**
 * A guest dj's live alerts panel: how many it'll go to, and the form, only usable while
 * they're on air. The backend holds them to one per set and says so if they try again.
 * @param props.name - The guest's name, for the default subject.
 * @param props.onAir - Their set's the one live right now.
 * @param props.onLabelledSet - Called after a send that relabelled their live set.
 */
export function GuestAlertsPanel({
  name,
  onAir,
  onLabelledSet,
}: {
  name: string;
  onAir: boolean;
  onLabelledSet: () => void;
}) {
  const audience = useAdminData<{ confirmed: number }>(AUDIENCE_PATH, "couldn't load how many signed up");
  const confirmed = audience.data?.confirmed ?? 0;
  const summary = audience.data ? `Live alerts: ${plural(confirmed, "person", "people")} signed up` : "Live alerts";

  return (
    <Card className="mb-4 p-3">
      <Toolbar summary={summary}>
        <Button size="sm" onClick={audience.reload}>
          Refresh
        </Button>
      </Toolbar>
      {audience.error && !audience.data && <Muted>{audience.error}</Muted>}
      <AlertComposer
        confirmed={confirmed}
        defaultSubject={djGuestAlertSubject(name)}
        blockedReason={onAir ? null : "You can send one once you're on air, one per set."}
        onSent={(result) => {
          if (result.labelled_set_id != null) onLabelledSet();
        }}
      />
    </Card>
  );
}
