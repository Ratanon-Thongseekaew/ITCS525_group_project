"""Create the first administrator (or reset a password) from the command line.

    python -m app.create_admin admin@example.com
    python -m app.create_admin admin@example.com --reset-password

Run it from the repository root with the virtual environment active and the database migrated.
"""

import argparse
import getpass
import sys

from pydantic import ValidationError
from sqlmodel import Session, select

from .database import get_engine
from .models import User
from .schemas import UserCreate, UserRole
from .security import hash_password


def create_or_reset_admin(
    session: Session, username: str, password: str, *, reset_password: bool = False
) -> str:
    """Return 'created' or 'reset'. Raises ValueError for invalid input or existing users."""
    try:
        data = UserCreate(username=username, password=password, role=UserRole.ADMIN)
    except ValidationError as error:
        raise ValueError(error.errors()[0]["msg"]) from None

    existing = session.exec(select(User).where(User.username == str(data.username))).first()
    if existing is None:
        session.add(
            User(
                username=str(data.username),
                password_hash=hash_password(data.password),
                role=UserRole.ADMIN,
            )
        )
        session.commit()
        return "created"
    if not reset_password:
        raise ValueError("That user already exists; pass --reset-password to change the password")
    existing.password_hash = hash_password(data.password)
    existing.role = UserRole.ADMIN
    session.add(existing)
    session.commit()
    return "reset"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create or reset an administrator account.")
    parser.add_argument("username", help="administrator email address")
    parser.add_argument("--reset-password", action="store_true")
    args = parser.parse_args(argv)

    password = getpass.getpass("Password: ")
    if password != getpass.getpass("Repeat password: "):
        print("Passwords do not match.", file=sys.stderr)
        return 1
    try:
        with Session(get_engine()) as session:
            result = create_or_reset_admin(
                session, args.username, password, reset_password=args.reset_password
            )
    except ValueError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    print(f"Administrator {args.username.lower()} {result}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
