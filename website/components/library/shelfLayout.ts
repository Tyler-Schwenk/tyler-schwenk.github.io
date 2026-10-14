import type { ShelfBook } from "@/app/library/libraryData";

export type DecorKind = "plant" | "hookah" | "candle";

/** one thing sitting on the shelf: a stack of books lying flat, or a bit of decor */
export type ShelfItem =
  | { kind: "stack"; id: string; books: ShelfBook[] }
  | { kind: "decor"; id: string; decor: DecorKind };

// stacks alternate between these sizes so the shelf doesn't look too tidy
const STACK_SIZE_PATTERN = [4, 3] as const;
// decor goes in after every this-many stacks, in this order, until it runs out
const STACKS_PER_DECOR = 2;
const DECOR_ORDER: readonly DecorKind[] = ["plant", "hookah", "candle"];

/**
 * splits books into stacks, keeping their order.
 *
 * @param {ShelfBook[]} books - Books in shelf order.
 * @returns {ShelfBook[][]} Consecutive groups sized by STACK_SIZE_PATTERN.
 */
function chunkIntoStacks(books: ShelfBook[]): ShelfBook[][] {
  const stacks: ShelfBook[][] = [];
  let start = 0;
  while (start < books.length) {
    const size = STACK_SIZE_PATTERN[stacks.length % STACK_SIZE_PATTERN.length];
    stacks.push(books.slice(start, start + size));
    start += size;
  }
  return stacks;
}

/**
 * rough spine length in characters -- good enough to guess which book's widest.
 *
 * @param {ShelfBook} book - The book.
 * @returns {number} Title plus author length.
 */
function spineLength(book: ShelfBook): number {
  return book.title.length + book.author.length;
}

/**
 * lays the owned books out as stacks with decor tucked between them. each stack is
 * ordered narrowest on top, like a real pile.
 *
 * @param {ShelfBook[]} books - Books in shelf order.
 * @returns {ShelfItem[]} Shelf items, left to right.
 */
export function layoutShelf(books: ShelfBook[]): ShelfItem[] {
  const items: ShelfItem[] = [];
  chunkIntoStacks(books).forEach((stack, stackIndex) => {
    const narrowestOnTop = [...stack].sort((a, b) => spineLength(a) - spineLength(b));
    items.push({ kind: "stack", id: stack[0].id, books: narrowestOnTop });

    const decor = DECOR_ORDER[stackIndex / STACKS_PER_DECOR];
    if (stackIndex % STACKS_PER_DECOR === 0 && decor) {
      items.push({ kind: "decor", id: decor, decor });
    }
  });
  return items;
}
