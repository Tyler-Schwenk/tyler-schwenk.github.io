/**
 * What the trash night screens say. Matt is the friend whose voice fart-pi
 * uses for the trash reminders, and we want him to be proud of us. The bird is
 * the cormorant, our god, which sends good waves to those who please it and
 * flat spells and onshore wind to those who don't.
 *
 * Add or reword lines freely; nothing else depends on how many there are.
 */

/** Big text on the alert. */
export const TRASH_ALERT_TITLE = "It's trash day!";

/** One per trash day, cycling through in order week by week (see trashAlertLine). */
export const TRASH_ALERT_LINES = [
  "Please take it out so we can make Matt so proud!",
  "The bird will love you so much.",
  "Matt believes in you. Don't let Matt down.",
  "Take it out and the cormorant will send glassy dawn patrols all week.",
  "An empty bin pleases the bird. A full bin brings onshore wind.",
  "Matt would have taken it out by now. Just saying.",
  "The cormorant sees all bins. The cormorant remembers.",
  "Do it for Matt. Do it for the bird. Do it for the waves.",
  "Please the cormorant and it shall send you overhead and offshore.",
  "Matt is counting on you. The bird is counting on you. No pressure.",
  "A clean curb is the way to the cormorant's heart.",
  "Leave it in and the bird sends knee-high mush for a month.",
  "Make Matt proud. He's so nice. He deserves this.",
  "The cormorant has spoken: the bins go out tonight.",
  "Every bag you carry out is a set wave the bird sends back.",
  "Matt said please. Matt should never have to say please twice.",
  "The bird hungers for your devotion (and an empty kitchen bin).",
  "Roll the bins to the curb and the bird will roll the sets to you.",
  "Do you want a flat spell? Because this is how you get a flat spell.",
  "Matt would be so proud of you. Go on. The curb awaits.",
] as const;

/** Instructions on the laptop screen, above its keyboard. */
export const TRASH_CONFIRM_TITLE = "Took the trash out?";
export const TRASH_CONFIRM_LINE = "Press any key on the keyboard below";

/** Big text on the thanks screen. */
export const TRASH_THANKS_TITLE = "Happy cormorant!";

/** One per confirmation (see trashThanksLine). */
export const TRASH_THANKS_LINES = [
  "Matt is so proud of you.",
  "The bird loves you so much.",
  "Offshore winds are on the way.",
  "The cormorant smiles upon this house.",
  "Matt says thank you. Matt loves you.",
  "Good waves are coming. The bird has decreed it.",
  "You have pleased the bird. Expect glass.",
  "A clean curb. A happy bird. A proud Matt.",
  "The bird will remember this when the swell comes.",
  "Matt is telling everyone about you.",
] as const;

/**
 * The alert line for a trash day.
 * @param weekSlot - Weeks since the epoch (useClockSlot with a week's interval).
 * @returns The line, the same all evening and different next week.
 */
export function trashAlertLine(weekSlot: number): string {
  return TRASH_ALERT_LINES[weekSlot % TRASH_ALERT_LINES.length];
}

/**
 * The thanks line for one confirmation. Picked from its time, so both screens agree.
 * @param thanksUntilMs - When the thanks screen ends, from the agent.
 * @returns The line.
 */
export function trashThanksLine(thanksUntilMs: number): string {
  return TRASH_THANKS_LINES[thanksUntilMs % TRASH_THANKS_LINES.length];
}
