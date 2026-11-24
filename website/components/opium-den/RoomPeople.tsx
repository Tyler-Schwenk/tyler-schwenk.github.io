"use client";

import { useState } from "react";
import { parseBackendTime } from "@/app/admin/format";
import type { DjChatMessage, DjRoomPerson, DjSetChatMessage, DjSetVisit } from "@/app/opium-den/djApi";
import RoomAvatar from "./RoomAvatar";

// how long a message stays up over its sender's head, live and in a replay
const BUBBLE_LIFETIME_MS = 30000;
const BUBBLE_LIFETIME_S = 30;
// the widest a person's spot gets, as % of the stage, so a small room stands together in the middle
const MAX_SPACING_PCT = 15;
// past these, a bubble hangs off to one side of its person instead of centering, so it stays on the stage
const BUBBLE_LEFT_EDGE_PCT = 18;
const BUBBLE_RIGHT_EDGE_PCT = 82;
// two bubbles closer than this (% across) would run into each other, so the second goes up a lane
const BUBBLE_CLASH_PCT = 24;
// how far a raised bubble sits above the usual spot, in px, on a stem down to its person
const RAISED_LIFT_PX = 40;
// the gap between a bubble's tail and the name under it (tailwind mb-2)
const BUBBLE_GAP_PX = 8;
const PERCENT = 100;

/**
 * a message to show over someone's head. order is anything that sorts them oldest first
 * (when the page saw it live, or its spot in a replay), for drawing newer ones on top.
 */
export type RoomBubble = { id: number; content: string; order: number };
/** where a bubble goes: raised a lane to clear its neighbour's, and its stacking order (newest on top). */
type BubbleSpot = { raised: boolean; layer: number };

/**
 * where each person stands, as % across the stage: evenly spread, but no further apart
 * than MAX_SPACING_PCT, centered.
 *
 * @param {number} count - how many people.
 * @returns {number[]} each one's spot.
 */
function standingSpots(count: number): number[] {
  const spacing = Math.min(PERCENT / count, MAX_SPACING_PCT);
  const first = PERCENT / 2 - (spacing * (count - 1)) / 2;
  return Array.from({ length: count }, (_, i) => first + spacing * i);
}

/**
 * when this page first saw each message, so a bubble lasts its 30 s from when it showed up
 * here rather than trusting the phone's clock against the pi's. the messages already there
 * on the first load count as seen when they were sent, so old ones don't all pop up at once.
 * it's worked out during render from the ticking clock, the way react suggests for state
 * that follows a prop.
 *
 * @param {DjChatMessage[] | null} messages - the room's chat.
 * @param {number} nowMs - now, ticking.
 * @returns {Map<number, number>} first-seen time by message id.
 */
function useFirstSeen(messages: DjChatMessage[] | null, nowMs: number): Map<number, number> {
  const [seen, setSeen] = useState<{ source: DjChatMessage[] | null; at: Map<number, number> }>({ source: null, at: new Map() });
  if (messages !== seen.source) {
    const firstLoad = seen.source === null;
    const at = new Map(seen.at);
    for (const message of messages ?? []) {
      if (!at.has(message.id)) at.set(message.id, firstLoad ? parseBackendTime(message.created_at).getTime() : nowMs);
    }
    setSeen({ source: messages, at });
    return at;
  }
  return seen.at;
}

/**
 * the live room's bubbles: each person's latest message from the last 30 s (counted from
 * when this page first saw it), by lowercased name, since names match ignoring case like
 * the pi holds them.
 *
 * @param {DjChatMessage[] | null} messages - the room's chat, oldest first.
 * @param {number} nowMs - now, ticking.
 * @returns {Map<string, RoomBubble>} the bubbles.
 */
export function useLiveBubbles(messages: DjChatMessage[] | null, nowMs: number): Map<string, RoomBubble> {
  const firstSeen = useFirstSeen(messages, nowMs);
  const bubbles = new Map<string, RoomBubble>();
  for (const message of messages ?? []) {
    const seenMs = firstSeen.get(message.id);
    if (seenMs !== undefined && nowMs - seenMs < BUBBLE_LIFETIME_MS) {
      bubbles.set(message.nickname.toLowerCase(), { id: message.id, content: message.content, order: seenMs });
    }
  }
  return bubbles;
}

/**
 * a replay's bubbles: each person's latest message from the 30 s of the set before where
 * playback is, so they pop up and go with the recording, seeking included.
 *
 * @param {DjSetChatMessage[]} messages - the set's chat on its timeline, oldest first.
 * @param {number} positionS - where playback is.
 * @returns {Map<string, RoomBubble>} the bubbles, by lowercased name.
 */
export function replayBubbles(messages: DjSetChatMessage[], positionS: number): Map<string, RoomBubble> {
  const bubbles = new Map<string, RoomBubble>();
  for (const message of messages) {
    const ageS = positionS - message.offset_s;
    if (ageS >= 0 && ageS < BUBBLE_LIFETIME_S) {
      bubbles.set(message.nickname.toLowerCase(), { id: message.id, content: message.content, order: message.offset_s });
    }
  }
  return bubbles;
}

/**
 * who was in the room at a point in a recorded set, from its saved stays, in the order
 * they came in. someone with overlapping stays (they came back) only shows once.
 *
 * @param {DjSetVisit[]} visits - the set's stays, from GET /dj/sets/{id}/people.
 * @param {number} positionS - where playback is.
 * @returns {DjRoomPerson[]} the people there then.
 */
export function peopleAt(visits: DjSetVisit[], positionS: number): DjRoomPerson[] {
  const present = new Map<string, DjRoomPerson>();
  for (const visit of visits) {
    const key = visit.nickname.toLowerCase();
    if (visit.from_s <= positionS && positionS <= visit.to_s && !present.has(key)) {
      present.set(key, { nickname: visit.nickname, avatar: visit.avatar, photo_id: visit.photo_id });
    }
  }
  return [...present.values()];
}

/**
 * stacks the bubbles so neighbours' don't sit on top of each other: going left to right,
 * one that's close to the last bubble on the bottom lane goes up a lane. a lone talker
 * always stays down by their head. newer bubbles draw over older ones, so the latest
 * thing said is always readable.
 *
 * @param {(RoomBubble | undefined)[]} bubbles - each person's bubble, in standing order.
 * @param {number[]} spots - where each person stands, % across.
 * @returns {(BubbleSpot | undefined)[]} each bubble's spot, undefined where there's no bubble.
 */
function stackBubbles(bubbles: (RoomBubble | undefined)[], spots: number[]): (BubbleSpot | undefined)[] {
  const oldestFirst = bubbles.filter((bubble): bubble is RoomBubble => bubble !== undefined).sort((a, b) => a.order - b.order);
  let lastLowPct: number | null = null;
  return bubbles.map((bubble, i) => {
    if (!bubble) return undefined;
    const raised = lastLowPct !== null && spots[i] - lastLowPct < BUBBLE_CLASH_PCT;
    if (!raised) lastLowPct = spots[i];
    return { raised, layer: oldestFirst.indexOf(bubble) + 1 };
  });
}

/**
 * one person on the stage: their character (or photo) with their name over their head, and over
 * that, a bubble with whatever they last said, for 30 s. a raised bubble hangs on a stem.
 *
 * @param {object} props
 * @param {DjRoomPerson} props.person - who.
 * @param {number} props.leftPct - where they stand, % across.
 * @param {RoomBubble | undefined} props.bubble - what they just said, if anything.
 * @param {BubbleSpot | undefined} props.spot - how the bubble's stacked.
 * @param {boolean} props.own - it's you.
 * @returns {JSX.Element} the person.
 */
function Person({
  person,
  leftPct,
  bubble,
  spot,
  own,
}: {
  person: DjRoomPerson;
  leftPct: number;
  bubble: RoomBubble | undefined;
  spot: BubbleSpot | undefined;
  own: boolean;
}) {
  const liftPx = spot?.raised ? RAISED_LIFT_PX : 0;
  const bubbleSide =
    leftPct < BUBBLE_LEFT_EDGE_PCT ? "left-0" : leftPct > BUBBLE_RIGHT_EDGE_PCT ? "right-0" : "left-1/2 -translate-x-1/2";
  const tailSide = leftPct < BUBBLE_LEFT_EDGE_PCT ? "left-4" : leftPct > BUBBLE_RIGHT_EDGE_PCT ? "right-4" : "left-1/2 -translate-x-1/2";
  return (
    <div className="den-pop absolute bottom-0.5 flex -translate-x-1/2 flex-col items-center" style={{ left: `${leftPct}%`, zIndex: spot?.layer }}>
      <div className="relative">
        {bubble && liftPx > 0 && (
          <span
            className="absolute bottom-full left-1/2 w-px bg-den-ink"
            style={{ height: liftPx + BUBBLE_GAP_PX }}
            aria-hidden="true"
          />
        )}
        {bubble && (
          <p
            key={bubble.id}
            style={{ marginBottom: liftPx + BUBBLE_GAP_PX }}
            className={`den-pop absolute bottom-full w-max max-w-[9rem] rounded-2xl border border-den-ink bg-den-bg px-2.5 py-1 text-[12px] leading-snug text-den-ink shadow-[2px_2px_0_var(--color-den-ink)] sm:max-w-[12rem] sm:text-[13px] ${bubbleSide}`}
          >
            <span className="line-clamp-3 break-words">{bubble.content}</span>
            <span
              className={`absolute -bottom-[5px] h-2 w-2 rotate-45 border-b border-r border-den-ink bg-den-bg ${tailSide}`}
              aria-hidden="true"
            />
          </p>
        )}
        <span
          className={`block max-w-[6.5rem] truncate bg-den-raised/90 px-1 font-den-mono text-[10px] uppercase leading-tight ${
            own ? "text-den-accent-soft" : "text-den-ink"
          }`}
        >
          {person.nickname}
        </span>
      </div>
      <RoomAvatar avatar={person.avatar} photoId={person.photo_id} />
    </div>
  );
}

/**
 * the people in the live room, standing along the bottom of a stage: each one a little
 * dancing character with their name over their head, and anything they say pops up in a
 * bubble above them for 30 s (it's in the chat as usual too). used live, with who's in
 * now (useLiveBubbles), and on a set's page as it replays, with who was in then
 * (peopleAt, replayBubbles). it doesn't take clicks, so whatever's under it still works.
 *
 * @param {object} props
 * @param {DjRoomPerson[]} props.people - who's in, in the order they came.
 * @param {Map<string, RoomBubble>} props.bubbles - what people just said, by lowercased name.
 * @param {string} [props.nickname] - your name, to pick you out live.
 * @returns {JSX.Element} the people layer.
 */
export default function RoomPeople({
  people,
  bubbles,
  nickname = "",
}: {
  people: DjRoomPerson[];
  bubbles: Map<string, RoomBubble>;
  nickname?: string;
}) {
  const spots = standingSpots(people.length);
  const ownKey = nickname.toLowerCase();
  const personBubbles = people.map((person) => bubbles.get(person.nickname.toLowerCase()));
  const bubbleSpots = stackBubbles(personBubbles, spots);

  return (
    <div className="pointer-events-none absolute inset-0">
      <p className="sr-only">In the room: {people.map((person) => person.nickname).join(", ")}</p>
      {people.map((person, i) => {
        // a character number is only free again once its person's gone, but a replay's
        // stays run a little past their last check-in, so the name keeps them apart
        return (
          <Person
            key={`${person.avatar}-${person.nickname.toLowerCase()}`}
            person={person}
            leftPct={spots[i]}
            bubble={personBubbles[i]}
            spot={bubbleSpots[i]}
            own={person.nickname.toLowerCase() === ownKey}
          />
        );
      })}
    </div>
  );
}
