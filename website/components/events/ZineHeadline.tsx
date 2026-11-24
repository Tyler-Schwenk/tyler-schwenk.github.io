/**
 * the riso zine's misregistered two-ink headline. the pink plate is the real text,
 * and a css ::after reprints it in blue a few px off, so the blue copy rides along
 * in data-t (newlines keep the line breaks the same on both plates).
 *
 * @param {object} props - component props.
 * @param {string[]} props.lines - the headline, one entry per printed line.
 * @param {boolean} [props.small] - smaller type, for long titles like an event's name.
 * @returns {JSX.Element} the h1.
 */
export default function ZineHeadline({ lines, small = false }: { lines: string[]; small?: boolean }) {
  return (
    <h1 className={`zine-headline${small ? " zine-headline-sm" : ""}`} data-t={lines.join("\n")}>
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </h1>
  );
}
