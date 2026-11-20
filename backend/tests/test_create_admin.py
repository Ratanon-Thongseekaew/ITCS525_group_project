import pytest
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from app.create_admin import create_or_reset_admin
from app.models import User
from app.schemas import UserRole
from app.security import verify_password


@pytest.fixture
def session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as db:
        yield db
    engine.dispose()


def test_creates_admin_with_hashed_password(session):
    assert create_or_reset_admin(session, "Boss@Example.com", "demo-password") == "created"
    user = session.exec(select(User)).one()
    assert user.username == "boss@example.com"
    assert user.role == UserRole.ADMIN
    assert verify_password("demo-password", user.password_hash)


def test_existing_user_requires_reset_flag(session):
    create_or_reset_admin(session, "boss@example.com", "demo-password")
    with pytest.raises(ValueError, match="already exists"):
        create_or_reset_admin(session, "boss@example.com", "another-password")
    assert (
        create_or_reset_admin(session, "boss@example.com", "another-password", reset_password=True)
        == "reset"
    )
    user = session.exec(select(User)).one()
    assert verify_password("another-password", user.password_hash)


@pytest.mark.parametrize(
    ("username", "password"), [("not-an-email", "demo-password"), ("a@b.co", "x")]
)
def test_rejects_invalid_input(session, username, password):
    with pytest.raises(ValueError):
        create_or_reset_admin(session, username, password)
