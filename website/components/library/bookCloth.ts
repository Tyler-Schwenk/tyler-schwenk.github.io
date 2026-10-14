import { seededPick } from "@/lib/seededRandom";

// faded bookcloth colors -- old library bindings, not new paperbacks
const CLOTH_CLASSES = [
  "clothOxblood",
  "clothForest",
  "clothNavy",
  "clothMustard",
  "clothRust",
  "clothSlate",
  "clothPlum",
  "clothOlive",
] as const;

/**
 * picks a book's bookcloth color class from its id, so a book keeps the same color
 * on the shelf and as a fallback cover across builds.
 *
 * @param {string} bookId - The book's id from library.json.
 * @returns {string} Name of a cloth class in library.module.css.
 */
export function clothClassFor(bookId: string): (typeof CLOTH_CLASSES)[number] {
  return seededPick(bookId, "cloth", CLOTH_CLASSES);
}
