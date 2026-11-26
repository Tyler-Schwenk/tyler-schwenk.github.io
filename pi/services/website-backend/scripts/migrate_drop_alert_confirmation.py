#!/usr/bin/env python3
"""Migration: drop the confirmation columns from dj_alert_subscribers.

Live alerts don't ask people to confirm anymore, so confirm_sent_at and confirmed_at
go. confirm_sent_at is NOT NULL, so new signups fail until this has run. Everyone
already on the list stays on it, confirmed or not.

Safe to run multiple times: it skips any column that's already gone.

Run from inside the container:
    docker exec -it website-backend-api python scripts/migrate_drop_alert_confirmation.py
"""

import sqlite3
import sys
from pathlib import Path

DB_PATH = Path("/app/data/website_backend.db")
TABLE = "dj_alert_subscribers"
DROPPED_COLUMNS = ("confirm_sent_at", "confirmed_at")


def column_exists(cursor: sqlite3.Cursor, table: str, column: str) -> bool:
    """says whether a table has a column, from PRAGMA table_info."""
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def run_migration() -> None:
    """drops each confirmation column that's still there."""
    if not DB_PATH.exists():
        print(f"ERROR: database not found at {DB_PATH} -- run this inside the website-backend-api container")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        for column in DROPPED_COLUMNS:
            if not column_exists(cursor, TABLE, column):
                print(f"{TABLE}.{column} already gone, skipping")
                continue
            cursor.execute(f"ALTER TABLE {TABLE} DROP COLUMN {column}")
            print(f"dropped {TABLE}.{column}")
        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    run_migration()
