"""Sign test clients in with real access tokens, in place of the old ``actor_id`` field."""

from sqlmodel import Session, select

from app.models import User
from app.security import create_access_token


def bearer(user_id: int) -> dict[str, str]:
    """An ``Authorization`` header for this user, the same token a real login returns."""

    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def sign_in(client, user_id: int):
    """Send every later request from ``client`` as this user."""

    client.headers.update(bearer(user_id))
    return client


def demo_user_id(engine, username: str) -> int:
    """The id of a seeded demo account, such as ``admin@example.com``."""

    with Session(engine) as session:
        return session.exec(select(User.id).where(User.username == username)).one()
