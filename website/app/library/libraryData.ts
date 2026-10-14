import fs from "node:fs";
import path from "node:path";
import library from "@/data/library.json";

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
