import { CONTROL_CONFIG, MALLARDS_SLOT_ID, PHOTOS_SLOT_ID } from "../display/displayConfig";
import { INITIAL_CONTROL_STATE, applyControlEvent, type ControlState, type DisplayMode } from "../display/kioskControl";

/**
 * The console panel's sections: an overview that runs the standard rotation,
 * and one per thing the screens can show. Picking a section puts the screens
 * on that thing, and whatever the screens are on picks the section, so keys
 * pressed on the keyboard keep the panel in step.
 */

export type SectionId = "overview" | "photos" | "mallards" | "surf" | "bpm";

/** One section of the panel. */
export interface ConsoleSection {
  id: SectionId;
  /** Name on its tab. */
  label: string;
  /** What it is and how it works, a paragraph per entry. */
  description: string[];
  /**
   * The state the screens go to when the section's picked.
   * @param atMs - When it was picked, epoch ms.
   */
  enter: (atMs: number) => ControlState;
}

/**
 * The state a kiosk key press leads to from the standard display.
 * @param key - Kiosk key name.
 * @param atMs - When it was pressed, epoch ms.
 * @returns The state after it.
 */
function afterKey(key: string, atMs: number): ControlState {
  return applyControlEvent(INITIAL_CONTROL_STATE, { key, at_ms: atMs }, CONTROL_CONFIG);
}

/**
 * Staying on one rotation slot. There's no kiosk key that holds the photos
 * slot with its photos still changing (shortcut 1 freezes the photo), so the
 * holds are built directly; the kiosk gets here with ] and [.
 * @param slotId - The slot to stay on.
 * @returns The state.
 */
export function holdSlotState(slotId: string): ControlState {
  return { ...INITIAL_CONTROL_STATE, mode: { kind: "hold-slot", slotId } };
}

const LOREM_IPSUM = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.",
];

/** The sections, in tab order. */
export const CONSOLE_SECTIONS: ConsoleSection[] = [
  {
    id: "overview",
    label: "overview",
    description: LOREM_IPSUM,
    enter: () => INITIAL_CONTROL_STATE,
  },
  {
    id: "photos",
    label: "photos",
    description: [
      "Random photos from every public gallery on this site, pulled live from the Pi's API. Each screen shuffles its own list and changes every 15 seconds, half a step out of time with the other, so the two screens take turns.",
      "Freezing stops both screens on the photo they're showing, and the arrows step through from there.",
    ],
    enter: () => holdSlotState(PHOTOS_SLOT_ID),
  },
  {
    id: "mallards",
    label: "mallards",
    description: [
      "The laptop screen shows the current mallard count, with one drifting duck per mallard behind it (up to a cap, so it stays light on the hardware). The count comes through the Pi's API, which checks for a new number every minute.",
      "The monitor keeps showing photos while it's up.",
    ],
    enter: (atMs) => afterKey("2", atMs),
  },
  {
    id: "surf",
    label: "surf cams",
    description: [
      "Live surf cams from around San Diego. On the real console the monitor plays the cam's stream full screen with an info bar over it, and the laptop shows the conditions: waves, wind and the tide curve.",
      "The cams' owners don't let other sites embed their streams, so here the video is a drawn stand-in and the conditions are made up, though shaped like the real thing. The link below opens the real stream of the cam that's up.",
    ],
    enter: (atMs) => afterKey("3", atMs),
  },
  {
    id: "bpm",
    label: "bpm",
    description: [
      "A mic in the room listens to whatever's playing. A little agent on the laptop tracks the tempo and the spectrum, and the screens turn that into visualizers that pulse on the beat.",
      "There's no mic here, so your browser plays a synthesised 122 bpm house loop and analyses it the same way. If the pulse looks off from what you hear, nudge the beat earlier or later.",
    ],
    enter: (atMs) => afterKey("b", atMs),
  },
];

/**
 * The section for what the screens are doing.
 * @param mode - Current display mode.
 * @returns The section that covers it.
 */
export function sectionForMode(mode: DisplayMode): SectionId {
  if (mode.kind === "rotation") return "overview";
  if (mode.kind === "hold-photo") return "photos";
  if (mode.kind === "cam-rotation") return "surf";
  if (mode.kind === "bpm") return "bpm";
  if (mode.slotId === PHOTOS_SLOT_ID) return "photos";
  if (mode.slotId === MALLARDS_SLOT_ID) return "mallards";
  return "surf";
}
