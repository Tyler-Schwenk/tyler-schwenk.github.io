import { DANCERS, type Dancer } from "@/components/disco/constants";

/**
 * the live room's characters: the disco flier's dancing kids, in the order they're handed
 * out, then the same six again inverted. the pi hands out (and checks picks against)
 * numbers 0 to ROOM_CHARACTER_COUNT - 1 (DJ_ROOM_CHARACTER_COUNT in its schemas.py), so
 * keep the two counts in step. numbers from there up are people standing in as their own
 * photo, or a room that's run out of characters, which starts the list over.
 */

const CHARACTER_ORDER = ["snoopy", "sally", "linus", "schroeder", "shermy", "headback"];
// what each one's called in the picker, by dancer name
const CHARACTER_LABELS: Record<string, string> = {
  snoopy: "Snoopy",
  sally: "Sally",
  linus: "Linus",
  schroeder: "Schroeder",
  shermy: "Shermy",
  // the girl dancing with her head thrown back
  headback: "Head back",
};
const DANCERS_IN_ORDER: readonly Dancer[] = CHARACTER_ORDER.map((name) => {
  const dancer = DANCERS.find((candidate) => candidate.name === name);
  if (!dancer) throw new Error(`no disco dancer called ${name} -- check DANCERS in components/disco/constants.ts`);
  return dancer;
});

/** how many characters there are to pick from: each dancer plain, then inverted. */
export const ROOM_CHARACTER_COUNT = DANCERS_IN_ORDER.length * 2;

/** one character: which dancer, whether it's the inverted one, and what to call it. */
export type RoomCharacter = { dancer: Dancer; inverted: boolean; label: string };

/**
 * the character for an avatar number. past the list it starts over, plain then inverted.
 *
 * @param {number} avatar - the number from the pi.
 * @returns {RoomCharacter} the character.
 */
export function characterFor(avatar: number): RoomCharacter {
  const dancer = DANCERS_IN_ORDER[avatar % DANCERS_IN_ORDER.length];
  const inverted = Math.floor(avatar / DANCERS_IN_ORDER.length) % 2 === 1;
  const name = CHARACTER_LABELS[dancer.name] ?? dancer.name;
  return { dancer, inverted, label: inverted ? `Dark ${name}` : name };
}
