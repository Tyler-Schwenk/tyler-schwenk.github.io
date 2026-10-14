import fs from "node:fs";
import path from "node:path";
import library from "@/data/library.json";
import spineColors from "@/data/spineColors.json";

/** a book on the shelf right now, up for borrowing or trading */
export type OwnedBook = {
  id: string;
  title: string;
  author: string;
};

/** a finished book, with my rating out of 5 (null if I never rated it) */
export type ReadBook = {
  id: string;
  title: string;
  subtitle?: string;
  author: string;
  rating: number | null;
  /** ISO date, YYYY-MM-DD */
  dateRead: string;
  review?: string;
};

/** a spine's color, pulled from the book's cover by scripts/extract_spine_colors.py */
export type SpineColor = {
  background: string;
  /** text color with the most contrast on the background */
  ink: string;
};

/** an owned book with everything the shelf needs to draw it and open it up */
export type ShelfBook = OwnedBook & {
  /** null when there's no cover to take it from, so the spine gets a bookcloth color */
  spineColor: SpineColor | null;
  coverSrc: string | null;
  /** my reading log entry for it, or null if I haven't read it */
  read: ReadBook | null;
};

/** every book read in one calendar year, newest first */
export type ReadingYear = {
  year: string;
  books: ReadBook[];
};

// cover files are fetched by scripts/fetch_book_covers.py and named after the book id
const COVER_URL_DIR = "/images/library/covers";
const COVER_DISK_DIR = path.join(process.cwd(), "public", "images", "library", "covers");
const COVER_EXTENSION = ".jpg";
const YEAR_LENGTH = 4;

export const OWNED_BOOKS: OwnedBook[] = library.owned;
export const READ_BOOKS: ReadBook[] = library.read;
const SPINE_COLORS: Record<string, SpineColor> = spineColors;

/**
 * url of a book's cover, if one's been downloaded. runs at build time (the page is
 * statically exported), so books without a file get the cloth fallback instead of a
 * broken image.
 *
 * @param {string} bookId - The book's id from library.json.
 * @returns {string | null} Public cover url, or null when there's no cover file.
 */
export function getCoverSrc(bookId: string): string | null {
  const fileName = `${bookId}${COVER_EXTENSION}`;
  if (!fs.existsSync(path.join(COVER_DISK_DIR, fileName))) return null;
  return `${COVER_URL_DIR}/${fileName}`;
}

/**
 * groups read books by the year they were finished, newest year and newest book first.
 *
 * @param {ReadBook[]} books - Books in any order.
 * @returns {ReadingYear[]} One entry per year that has books.
 */
export function groupByYearRead(books: ReadBook[]): ReadingYear[] {
  // ISO dates sort correctly as plain strings
  const newestFirst = [...books].sort((a, b) => b.dateRead.localeCompare(a.dateRead));
  const years: ReadingYear[] = [];

  for (const book of newestFirst) {
    const year = book.dateRead.slice(0, YEAR_LENGTH);
    const current = years[years.length - 1];
    if (current?.year === year) {
      current.books.push(book);
    } else {
      years.push({ year, books: [book] });
    }
  }
  return years;
}

/**
 * the owned books, in shelf order, joined up with their spine colors, covers and
 * reading log entries. runs at build time (getCoverSrc checks the disk).
 *
 * @returns {ShelfBook[]} One entry per owned book.
 */
export function getShelfBooks(): ShelfBook[] {
  const readById = new Map(READ_BOOKS.map((book) => [book.id, book]));
  return OWNED_BOOKS.map((book) => ({
    ...book,
    spineColor: SPINE_COLORS[book.id] ?? null,
    coverSrc: getCoverSrc(book.id),
    read: readById.get(book.id) ?? null,
  }));
}
