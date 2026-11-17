import type { MicIconName } from "@/app/mic/micData";

/** icons are drawn in a 48 x 48 box */
export const MIC_ICON_SIZE = 48;

/** the line drawing for each icon, in the 48 x 48 box */
const ICON_SHAPES: Record<MicIconName, React.ReactNode> = {
  people: (
    <>
      <circle cx="24" cy="15" r="6" />
      <path d="M12 40c0-7 5.4-12 12-12s12 5 12 12" />
      <circle cx="9" cy="19" r="4.5" />
      <path d="M1 37c0-5 3.6-9 8-9" />
      <circle cx="39" cy="19" r="4.5" />
      <path d="M47 37c0-5-3.6-9-8-9" />
    </>
  ),
  capitol: (
    <>
      <path d="M6 43h36M9 39h30M8 24h32" />
      <path d="M12 24v15M18 24v15M24 24v15M30 24v15M36 24v15" />
      <path d="M14 24a10 10 0 0 1 20 0" />
      <path d="M24 14V8" />
      <circle cx="24" cy="6" r="1.8" />
    </>
  ),
  pentagon: (
    <>
      <polygon points="24,5 43,18.8 35.8,41.2 12.2,41.2 5,18.8" />
      <polygon points="24,16 32.6,22.2 29.3,32.3 18.7,32.3 15.4,22.2" />
    </>
  ),
  factory: (
    <>
      <path d="M4 42V24l10 6v-6l10 6v-6l10 6V8h8v34z" />
      <path d="M10 36h4M18 36h4M26 36h4" />
      <path d="M36 5c2-2 4-2 6 0" />
    </>
  ),
  jet: <path d="M24 3l3 10v8l16 9v4l-16-4v8l5 4v3l-8-2-8 2v-3l5-4v-8L5 34v-4l16-9v-8z" />,
  homes: (
    <>
      <path d="M3 43V27l11-9 11 9v16" />
      <path d="M23 43V22l11-9 11 9v21" />
      <path d="M1 43h46" />
      <path d="M11 43v-7h6v7M31 43v-8h6v8" />
      <path d="M31 25h6" />
    </>
  ),
};

/**
 * one of the diagram's line icons, centered on (x, y). draws with currentColor
 * so the node's css sets its color.
 * @param {object} props - component props.
 * @param {MicIconName} props.name - which icon.
 * @param {number} props.x - center x, in svg units.
 * @param {number} props.y - center y, in svg units.
 * @param {number} props.size - drawn width and height, in svg units.
 * @returns {JSX.Element} an svg group.
 */
export default function MicIcon({ name, x, y, size }: { name: MicIconName; x: number; y: number; size: number }) {
  const scale = size / MIC_ICON_SIZE;
  const offset = size / 2;
  return (
    <g
      transform={`translate(${x - offset} ${y - offset}) scale(${scale})`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_SHAPES[name]}
    </g>
  );
}
