"use client";

import { useState, type FormEvent } from "react";
import {
  DJ_ALERT_BODY_MAX_LENGTH,
  DJ_ALERT_DEFAULT_SUBJECT,
  DJ_ALERT_SUBJECT_MAX_LENGTH,
  DJ_ALERTS_PATH,
  type DjAlertSendResult,
  type DjAlertSubscriber,
} from "@/app/opium-den/djApi";
import { adminRequest, errorMessage, jsonBody, useAdminData, useAdminFetch } from "./adminApi";
import { formatDate, plural } from "./format";
import { Badge, Button, Card, Field, FlashMessage, INPUT_CLASS, Muted, Toolbar, useFlash } from "./ui";

/**
 * The live alerts panel on the DJ tab: write an email and send it to everyone who's
 * signed up and confirmed. Nothing goes out on its own; this is the only way an alert
 * is sent. Under it, who's signed up, with remove.
 */

const SUBSCRIBERS_PATH = `${DJ_ALERTS_PATH}/subscribers`;

/**
 * What to say once a send's done.
 * @param result - The backend's answer.
 * @returns Like "Sent to 12." or "Sent to 11. Couldn't send to: a@b.com".
 */
function sendSummary(result: DjAlertSendResult): string {
  const sent = `Sent to ${plural(result.sent, "person", "people")}.`;
  return result.failed.length ? `${sent} Couldn't send to: ${result.failed.join(", ")}` : sent;
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
 * The live alerts panel.
 */
export default function DjAlertsPanel() {
  const adminFetch = useAdminFetch();
  const subscribers = useAdminData<DjAlertSubscriber[]>(SUBSCRIBERS_PATH, "couldn't load alert signups");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [flash, showFlash] = useFlash();
  const confirmed = subscribers.data?.filter((subscriber) => subscriber.confirmed_at).length ?? 0;
  const unconfirmed = (subscribers.data?.length ?? 0) - confirmed;

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim() || sending) return;
    if (!window.confirm(`Email this to ${plural(confirmed, "person", "people")}? It can't be unsent.`)) return;
    setSending(true);
    try {
      const result = await adminRequest<DjAlertSendResult>(
        adminFetch,
        `${DJ_ALERTS_PATH}/send`,
        "couldn't send the alert",
        jsonBody("POST", { subject: subject.trim() || null, body: body.trim() })
      );
      if (result) showFlash(result.failed.length ? "error" : "success", sendSummary(result));
      setSubject("");
      setBody("");
    } catch (err) {
      showFlash("error", errorMessage(err));
    } finally {
      setSending(false);
    }
  };

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
      <form onSubmit={send} className="flex flex-col gap-3">
        <Field label="Subject" htmlFor="dj-alert-subject">
          <input
            id="dj-alert-subject"
            className={INPUT_CLASS}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder={DJ_ALERT_DEFAULT_SUBJECT}
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
        <Button type="submit" variant="primary" className="self-end" disabled={!body.trim() || sending || confirmed === 0}>
          {sending ? "Sending..." : `Send to ${plural(confirmed, "person", "people")}`}
        </Button>
      </form>
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
