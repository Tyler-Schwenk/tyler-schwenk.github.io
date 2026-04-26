"""One-time script to create the admin user in the database.

Run once on the Pi after initial deployment:

    python scripts/create_admin.py --email YOUR_EMAIL --password YOUR_PASSWORD

Password is passed as a CLI arg so it's never stored in code.
Run from inside the container with docker exec:

    docker exec -it website-backend python scripts/create_admin.py --email ... --password ...
"""

import argparse
import os
import sys

# make app importable when run from the project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import bcrypt

from app.database import SessionLocal, init_db
from app.models import User


def create_admin(email: str, password: str) -> None:
    """
    Create an admin user in the database with a hashed password.

    Exits with a non-zero status if the email already exists. Run
    init_db() first to make sure the tables exist.

    Args:
        email: Admin email address.
        password: Plain-text password — hashed before storage, never persisted raw.
    """
    init_db()

    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == email).first():
            print(f"user already exists: {email}")
            print("to reset the password, delete the user row first or update hashed_password directly")
            sys.exit(1)

        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        user = User(
            email=email,
            hashed_password=hashed,
            is_active=True,
            is_superuser=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        print(f"admin user created: {email}")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="create the admin user for the website backend")
    parser.add_argument("--email", required=True, help="admin email address")
    parser.add_argument("--password", required=True, help="plain-text password — gets hashed before storage")
    args = parser.parse_args()

    create_admin(args.email, args.password)
