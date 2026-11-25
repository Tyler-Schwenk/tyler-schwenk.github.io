"""Creates a guest dj login, resets its password, or turns it off or back on.

A guest dj streams to their own icecast mount, and their login (the site's /guest-dj page)
can edit their own profile and sets, and send live alerts while they're on air (see
app/dependencies.py). The mount here has to match theirs in ICECAST_GUEST_MOUNTS in
pi/services/dj-stream/.env. Run it on the Pi from inside the container:

    docker exec -it website-backend-api python scripts/create_dj_guest.py --username tommy --name Tracepoint --mount tracepoint

It asks for the password, so it never ends up in shell history. Running it again for the
same username sets a new password (and a new name or mount, if given). --disable turns the
login off and stops their mount counting as live; --enable turns it back on. Neither asks
for a password.
"""

import argparse
import getpass
import os
import re
import sys

# make app importable when run from the project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import bcrypt

from app.config import settings
from app.database import SessionLocal, init_db
from app.models import DjGuest
from app.schemas import MAX_DJ_GUEST_NAME_LENGTH

MIN_PASSWORD_LENGTH = 8
# the same rule dj-stream's entrypoint.sh holds guest mounts to
MOUNT_PATTERN = re.compile(r"^[a-z0-9-]+$")


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


def check_mount(mount: str) -> str:
    """
    Makes sure a mount name will work in icecast and isn't Tyler's.

    Args:
        mount: The mount, with or without its leading slash.

    Returns:
        str: The mount without the slash, like "tracepoint".

    Raises:
        SystemExit: If it has characters icecast's config won't take, or it's Tyler's mount.
    """
    mount = mount.strip().lstrip("/")
    if not MOUNT_PATTERN.match(mount):
        sys.exit(f"mount {mount!r} can only have lowercase letters, digits and dashes -- pick another")
    if f"/{mount}" == settings.DJ_STREAM_MOUNT:
        sys.exit(f"{mount!r} is Tyler's own mount -- pick another for the guest")
    return mount


def check_name(name: str) -> str:
    """
    Makes sure a display name fits.

    Args:
        name: What the site calls them.

    Returns:
        str: The name, on one line and trimmed.

    Raises:
        SystemExit: If it's blank or too long.
    """
    name = " ".join(name.split())
    if not name or len(name) > MAX_DJ_GUEST_NAME_LENGTH:
        sys.exit(f"the name has to be 1 to {MAX_DJ_GUEST_NAME_LENGTH} characters")
    return name


def set_active(username: str, active: bool) -> None:
    """
    Turns a login off or back on.

    Args:
        username: Their login.
        active: True to turn it on, False to turn it off.

    Raises:
        SystemExit: If there's no such login.
    """
    with SessionLocal() as db:
        guest = db.query(DjGuest).filter(DjGuest.username == username).first()
        if guest is None:
            sys.exit(f"no guest dj called {username} -- check the username")
        guest.is_active = active
        db.commit()
    print(f"guest dj {username} is {'on' if active else 'off'}")


def set_dj_guest(username: str, password: str, name: str | None, mount: str | None) -> None:
    """
    Creates the login, or sets a new password (and name or mount) on an existing one.

    Usernames are stored lowercase, matching how the login endpoint looks them up.

    Args:
        username: What they'll log in with.
        password: Plain-text password. Only its bcrypt hash is stored.
        name: What the site calls them; needed for a new login.
        mount: Their icecast mount; needed for a new login.

    Raises:
        SystemExit: If a new login is missing its name or mount, or the mount's someone else's.
    """
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    with SessionLocal() as db:
        if mount is not None:
            holder = db.query(DjGuest).filter(DjGuest.mount == mount, DjGuest.username != username).first()
            if holder is not None:
                sys.exit(f"mount {mount!r} is already {holder.username}'s -- pick another")
        guest = db.query(DjGuest).filter(DjGuest.username == username).first()
        if guest is None:
            if name is None or mount is None:
                sys.exit("a new guest dj needs --name and --mount")
            db.add(DjGuest(username=username, hashed_password=hashed, name=name, mount=mount))
            print(f"guest dj created: {username} ({name}), streaming to /{mount}")
        else:
            guest.hashed_password = hashed
            guest.name = name or guest.name
            guest.mount = mount or guest.mount
            print(f"guest dj already existed, password reset: {username} ({guest.name}, /{guest.mount})")
        db.commit()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="create a guest dj login, reset its password, or turn it off or on")
    parser.add_argument("--username", required=True, help="what they'll log in with, case doesn't matter")
    parser.add_argument("--name", help="what the site calls them, like Tracepoint")
    parser.add_argument("--mount", help="their icecast mount, like tracepoint (match ICECAST_GUEST_MOUNTS)")
    switch = parser.add_mutually_exclusive_group()
    switch.add_argument("--disable", action="store_true", help="turn their login off and stop their mount counting as live")
    switch.add_argument("--enable", action="store_true", help="turn a disabled login back on")
    args = parser.parse_args()

    init_db()
    login = args.username.strip().lower()
    if args.disable or args.enable:
        set_active(login, args.enable)
    else:
        set_dj_guest(
            login,
            read_password(),
            check_name(args.name) if args.name is not None else None,
            check_mount(args.mount) if args.mount is not None else None,
        )
