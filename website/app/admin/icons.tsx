import type { ReactNode } from "react";

/**
 * Line icons for the admin page (24x24, drawn in currentColor, so they take
 * the text colour around them).
 */

/**
 * Wraps an icon's paths in a 24x24 stroked svg.
 * @param props.children - The paths.
 * @param props.className - Size classes; defaults to 20px.
 */
function Icon({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

/** A monitor, for the display remote. */
export function MonitorIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </Icon>
  );
}

/** Stacked photos, for galleries. */
export function PhotosIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <rect x="3" y="6" width="14" height="14" rx="2" />
      <path d="M7 3h12a2 2 0 0 1 2 2v12M3 16l4-4 4 4 2-2 4 4" />
    </Icon>
  );
}

/** An arrow into a tray, for uploads. */
export function UploadIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </Icon>
  );
}

/** A checklist, for rsvps. */
export function ListIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />
    </Icon>
  );
}

/** A speech bubble, for the public square. */
export function ChatIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z" />
    </Icon>
  );
}

/** A chevron pointing up (rotate it for the other directions). */
export function ChevronIcon(props: { className?: string }) {
  return (
    <Icon {...props}>
      <path d="M6 15l6-6 6 6" />
    </Icon>
  );
}
