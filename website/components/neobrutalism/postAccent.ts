/**
 * Deterministic accent color for a Round Table post.
 *
 * Keying off the post id (not its position) means a post keeps the same accent
 * no matter the sort order or which page it shows up on -- the list and the
 * thread view agree. Returns a `var(--n-*)` reference from the neobrutalism
 * accent palette, meant for an inline style (e.g. a card's left border color).
 */
const POST_ACCENT_COLORS = [
  "var(--n-pink)",
  "var(--n-cyan)",
  "var(--n-lime)",
  "var(--n-purple)",
  "var(--n-orange)",
  "var(--n-blue)",
];

/**
 * Pick the accent color for a post from its id.
 *
 * @param {number} id - Post id.
 * @returns {string} A `var(--n-*)` accent color string for inline styles.
 */
export function postAccentColor(id: number): string {
  return POST_ACCENT_COLORS[id % POST_ACCENT_COLORS.length];
}
