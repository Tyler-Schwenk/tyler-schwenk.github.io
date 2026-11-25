"""Creates a kiln editor login, resets its password, or removes it.

A kiln editor can add notes and photos to firings on the kiln page and nothing else
(see app/dependencies.py). Run it on the Pi from inside the container:

    docker exec -it website-backend-api python scripts/create_kiln_editor.py --username jude

It asks for the password, so it never ends up in shell history. Running it again for the
same username just sets a new password. --remove deletes the login, and since every kiln
token is checked against it, anyone still logged in as it is out straight away (it doesn't
ask for a password):

    docker exec -it website-backend-api python scripts/create_kiln_editor.py --username jude --remove
"""

import argparse
import getpass
import os
import sys

# make app importable when run from the project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import bcrypt

from app.database import SessionLocal, init_db
from app.models import KilnEditor

MIN_PASSWORD_LENGTH = 8


def read_password() -> str:
    """
    Asks for the new password twice, without echoing it.

    Returns:
        str: The password.

    Raises:
        SystemExit: If the two don't match or it's too short.
    """
    password = getpass.getpass("new password: ")
    if len(password) < MIN_PASSWORD_LENGTH:
        sys.exit(f"password's too short -- use at least {MIN_PASSWORD_LENGTH} characters")
    if getpass.getpass("same again: ") != password:
        sys.exit("passwords didn't match -- run it again")
    return password


def set_kiln_editor(username: str, password: str) -> None:
    """
    Creates the login, or sets a new password on an existing one.

    Usernames are stored lowercase, matching how the login endpoint looks them up.

    Args:
        username: What they'll log in with.
        password: Plain-text password. Only its bcrypt hash is stored.
    """
    init_db()
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    db = SessionLocal()
    try:
        editor = db.query(KilnEditor).filter(KilnEditor.username == username).first()
        if editor is None:
            db.add(KilnEditor(username=username, hashed_password=hashed))
            print(f"kiln editor created: {username}")
        else:
            editor.hashed_password = hashed
            print(f"kiln editor already existed, password reset: {username}")
        db.commit()
    finally:
        db.close()


def remove_kiln_editor(username: str) -> None:
    """
    Deletes the login, which turns off every token it was given.

    Args:
        username: The login to remove, lowercase.

    Raises:
        SystemExit: If there's no such login.
    """
    init_db()
    db = SessionLocal()
    try:
        editor = db.query(KilnEditor).filter(KilnEditor.username == username).first()
        if editor is None:
            sys.exit(f"no kiln editor called {username} -- check the spelling, nothing was removed")
        db.delete(editor)
        db.commit()
        print(f"kiln editor removed: {username} (logged out everywhere)")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="create a kiln editor login, reset its password, or remove it")
    parser.add_argument("--username", required=True, help="what they'll log in with, case doesn't matter")
    parser.add_argument("--remove", action="store_true", help="delete the login and log it out everywhere")
    args = parser.parse_args()

    username = args.username.strip().lower()
    if args.remove:
        remove_kiln_editor(username)
    else:
        set_kiln_editor(username, read_password())
