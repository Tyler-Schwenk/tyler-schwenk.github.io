#!/usr/bin/env python3
"""Migration: add display_order column to galleries table and seed initial values.

Safe to run multiple times — skips the ALTER TABLE if the column already exists,
and skips any UPDATE if the gallery isnt found.

Run from inside the container:
    docker exec -it website-backend-api python scripts/migrate_add_display_order.py
"""

import sqlite3
import sys
from pathlib import Path


DB_PATH = Path("/app/data/website_backend.db")

# The original ordering from the site before the dynamic rewrite.
# display_order is descending: higher value = shown first.
# Trips and people are in separate frontend sections so they can share
# the same number space — the frontend filters by PEOPLE_SLUGS after sorting.
INITIAL_DISPLAY_ORDER = {
    # trips (shown first → last)
    "instinct": 150,
    "jordan": 140,
    "epc": 130,
    "durango": 120,
    "celciliawedding": 110,
    "elcap": 100,
    "halfdome": 90,
    "enchantments": 80,
    # people (shown first → last)
    "friends": 70,
    "college": 60,
    "palestinepals": 50,
    "family": 40,
    "bikenite": 30,
}


def column_exists(cursor: sqlite3.Cursor, table: str, column: str) -> bool:
    """Check if a column exists on a table using PRAGMA table_info."""
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def run_migration() -> None:
    """Add display_order column and seed initial ordering values."""
    if not DB_PATH.exists():
        print(f"ERROR: database not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # add column if missing
        if column_exists(cursor, "galleries", "display_order"):
            print("column display_order already exists, skipping ALTER TABLE")
        else:
            cursor.execute(
                "ALTER TABLE galleries ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0"
            )
            print("added display_order column")

        # seed initial values
        updated = 0
        skipped = 0
        for slug, order in INITIAL_DISPLAY_ORDER.items():
            cursor.execute(
                "UPDATE galleries SET display_order = ? WHERE slug = ?",
                (order, slug),
            )
            if cursor.rowcount > 0:
                updated += 1
                print(f"  set {slug} → {order}")
            else:
                skipped += 1
                print(f"  skipped {slug} (not in DB)")

        conn.commit()
        print(f"\ndone — {updated} galleries updated, {skipped} slugs not found")

    finally:
        conn.close()


if __name__ == "__main__":
    run_migration()
