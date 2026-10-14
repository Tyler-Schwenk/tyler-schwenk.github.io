"""
downloads a cover for every book in data/library.json into public/images/library/covers/.

looks each book up on Open Library by title + author and saves the first result
that has a cover as <book id>.jpg. books that already have a cover file are
skipped, so it's safe to rerun after adding books. to swap a bad cover, delete
the file (or drop in your own jpg with the same name) and rerun.

usage (from anywhere): python website/scripts/fetch_book_covers.py
"""

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

WEBSITE_DIR = Path(__file__).resolve().parent.parent
LIBRARY_PATH = WEBSITE_DIR / "data" / "library.json"
COVER_DIR = WEBSITE_DIR / "public" / "images" / "library" / "covers"

SEARCH_URL = "https://openlibrary.org/search.json"
# "M" covers are ~180px wide, about 2x the biggest size the page shows them at
COVER_URL_TEMPLATE = "https://covers.openlibrary.org/b/id/{cover_id}-M.jpg"
SEARCH_RESULT_LIMIT = 5
REQUEST_TIMEOUT_S = 30
# Open Library asks scripts to identify themselves and go easy on the api
USER_AGENT = "tyler-schwenk.com library page (tylerschwenk1@gmail.com)"
PAUSE_BETWEEN_BOOKS_S = 1


def fetch(url: str) -> bytes:
    """
    GET a url with the script's user agent.

    Args:
        url: what to fetch.

    Returns:
        the response body.

    Raises:
        urllib.error.URLError: on network failures or non-2xx responses.
    """
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_S) as response:
        return response.read()


def find_cover_id(title: str, author: str) -> int | None:
    """
    search Open Library for a book and return the first matching cover id.

    Args:
        title: book title as it appears in library.json.
        author: author name, "First Last".

    Returns:
        the Open Library cover id, or None if no result had a cover.
    """
    query = urllib.parse.urlencode({
        "title": title,
        "author": author,
        "limit": SEARCH_RESULT_LIMIT,
        "fields": "cover_i",
    })
    results = json.loads(fetch(f"{SEARCH_URL}?{query}"))
    for doc in results.get("docs", []):
        if doc.get("cover_i"):
            return doc["cover_i"]
    return None


def load_books() -> list[dict]:
    """
    read every book (owned and read) from library.json, deduped by id.

    Returns:
        list of book dicts with at least id, title and author.
    """
    library = json.loads(LIBRARY_PATH.read_text(encoding="utf-8"))
    books_by_id = {book["id"]: book for book in library["owned"] + library["read"]}
    return list(books_by_id.values())


def fetch_cover(book: dict) -> str:
    """
    download one book's cover if it doesn't have one yet.

    Args:
        book: a book dict from library.json.

    Returns:
        short status word: "skipped", "saved" or "missing".
    """
    cover_path = COVER_DIR / f"{book['id']}.jpg"
    if cover_path.exists():
        return "skipped"

    cover_id = find_cover_id(book["title"], book["author"])
    if cover_id is None:
        return "missing"

    cover_path.write_bytes(fetch(COVER_URL_TEMPLATE.format(cover_id=cover_id)))
    return "saved"


def main() -> int:
    """
    fetch covers for every book, carrying on past failures.

    Returns:
        process exit code: 0 if every book has a cover, 1 otherwise.
    """
    COVER_DIR.mkdir(parents=True, exist_ok=True)
    problems = []

    for book in load_books():
        try:
            status = fetch_cover(book)
        except (urllib.error.URLError, TimeoutError) as error:
            status = f"failed ({error})"

        print(f"{status:>8}  {book['id']}")
        if status not in ("skipped", "saved"):
            problems.append(book["id"])
        if status != "skipped":
            time.sleep(PAUSE_BETWEEN_BOOKS_S)

    if problems:
        print(
            f"\nno cover for: {', '.join(problems)}. "
            f"check the title/author in {LIBRARY_PATH.name}, or save a jpg by hand as "
            f"{COVER_DIR.relative_to(WEBSITE_DIR)}/<id>.jpg -- the page shows a plain "
            "cloth cover until one exists."
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
