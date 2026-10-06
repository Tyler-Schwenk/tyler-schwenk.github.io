"use client";

import { useEffect, type CSSProperties } from "react";
import { useClockSlot } from "./useClockSlot";
import { confirmTrash, type TrashTakeover } from "./trashTakeover";
import {
  TRASH_ALERT_TITLE,
  TRASH_CONFIRM_LINE,
  TRASH_CONFIRM_TITLE,
  TRASH_THANKS_TITLE,
  trashAlertLine,
  trashThanksLine,
} from "./trashPhrases";

/**
 * Display panel for trash night, shown in place of everything else while
 * useTrashTakeover says so. During the alert the monitor below shows the trash
 * and the day's line, and the laptop screen on top asks for a key press on its
 * own keyboard (a lone screen shows both). Any key confirms: the grabbed kiosk
 * keys via the agent, everything else through the keydown listener here,
 * whichever browser window has focus. After that both screens show the happy
 * cormorant until the takeover ends.
 * @param props.takeover - The alert or the thanks screen.
 * @param props.role - Which screen this page is on.
 */

const TRASH_IMAGE_URL = "/images/display/trash.avif";
const CORMORANT_IMAGE_URL = "/images/display/cormorant.png";

// one alert line per trash day: a week-long clock slot. epoch weeks turn over thursday
// 00:00 UTC (wednesday afternoon in california), so trash night never straddles one
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// the beak and fish reach the photo's top edge, so cropping to fill comes off the bottom
const CORMORANT_FOCUS = "center top";

// big text has to read from across the room, over a busy photo
const TEXT_SHADOW = "drop-shadow-[0_0.4vh_1.2vh_rgba(0,0,0,0.9)]";

/**
 * A photo blurred and darkened to fill the screen behind the sharp content.
 * @param props.url - Image url.
 * @param props.opacity - Tailwind opacity class.
 */
function BlurredBackdrop({ url, opacity }: { url: string; opacity: string }) {
  const style: CSSProperties = { backgroundImage: `url("${url}")` };
  return <div className={`absolute inset-0 bg-cover bg-center blur-2xl scale-110 ${opacity}`} style={style} />;
}

/**
 * The alert for the screen below (or a lone screen): the trash, the title and the day's line.
 * @param props.withConfirmHint - Also say how to confirm (a lone screen has no laptop screen for it).
 */
function TrashAlertScreen({ withConfirmHint }: { withConfirmHint: boolean }) {
  const weekSlot = useClockSlot(WEEK_MS);
  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white text-center">
      <BlurredBackdrop url={TRASH_IMAGE_URL} opacity="opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-red-800/70 via-black/20 to-black/80" />
      <div className="relative h-full flex flex-col items-center gap-[3vh] py-[4vh] px-[5vw]">
        <h1 className={`text-[11vh] leading-none font-black uppercase tracking-wide animate-pulse ${TEXT_SHADOW}`}>
          {TRASH_ALERT_TITLE}
        </h1>
        <div className="flex-1 min-h-0 w-full flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={TRASH_IMAGE_URL} alt="" className="max-h-full max-w-full rounded-[3vh] shadow-2xl" />
        </div>
        {weekSlot !== null && (
          <p className={`text-[6vh] leading-tight font-bold max-w-[85vw] ${TEXT_SHADOW}`}>{trashAlertLine(weekSlot)}</p>
        )}
        {withConfirmHint && (
          <p className={`text-[4vh] text-gray-200 ${TEXT_SHADOW}`}>
            {TRASH_CONFIRM_TITLE} {TRASH_CONFIRM_LINE}
          </p>
        )}
      </div>
    </div>
  );
}

/** A chevron pointing down at the keyboard. */
function DownChevron() {
  return (
    <svg viewBox="0 0 24 24" className="w-[14vh] h-[14vh]" fill="none" stroke="currentColor" strokeWidth={3}>
      <path d="M4 8l8 8 8-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The alert for the laptop screen on top: how to say the trash is out. */
function TrashConfirmScreen() {
  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white text-center">
      <BlurredBackdrop url={TRASH_IMAGE_URL} opacity="opacity-25" />
      <div className="relative h-full flex flex-col items-center justify-center gap-[4vh] px-[5vw]">
        <h1 className={`text-[12vh] leading-none font-black ${TEXT_SHADOW}`}>{TRASH_CONFIRM_TITLE}</h1>
        <p className={`text-[7vh] leading-tight font-bold text-amber-300 ${TEXT_SHADOW}`}>{TRASH_CONFIRM_LINE}</p>
        <div className="flex gap-[8vw] mt-[4vh] text-amber-300 animate-bounce">
          <DownChevron />
          <DownChevron />
          <DownChevron />
        </div>
      </div>
    </div>
  );
}

/**
 * The happy cormorant, on every screen, once the trash is out.
 * @param props.untilMs - When it ends; also picks the line, so both screens agree.
 */
function TrashThanksScreen({ untilMs }: { untilMs: number }) {
  const style: CSSProperties = { backgroundImage: `url("${CORMORANT_IMAGE_URL}")`, backgroundPosition: CORMORANT_FOCUS };
  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-cover" style={style} />
      {/* the left of the photo is open water, so the text sits there */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent" />
      <div className="relative h-full flex flex-col justify-center gap-[3vh] px-[5vw] max-w-[55vw]">
        <h1 className={`text-[13vh] leading-none font-black uppercase ${TEXT_SHADOW}`}>{TRASH_THANKS_TITLE}</h1>
        <p className={`text-[6vh] leading-tight font-bold ${TEXT_SHADOW}`}>{trashThanksLine(untilMs)}</p>
      </div>
    </div>
  );
}

export default function TrashPanel({
  takeover,
  role,
}: {
  takeover: TrashTakeover;
  role: "primary" | "secondary" | "solo";
}) {
  const alerting = takeover.kind === "alert";

  // keys xbindkeys doesn't grab reach whichever browser window has focus; the grabbed
  // ones go to the agent, which confirms with them itself
  useEffect(() => {
    if (!alerting) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.repeat) confirmTrash();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [alerting]);

  if (takeover.kind === "thanks") return <TrashThanksScreen untilMs={takeover.untilMs} />;
  if (role === "secondary") return <TrashConfirmScreen />;
  return <TrashAlertScreen withConfirmHint={role === "solo"} />;
}
