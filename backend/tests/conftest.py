from datetime import date

import pytest
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from seed import DEFAULT_DEMO_PASSWORD, seed_demo_data

# The demo seed's dates are relative to "today"; tests pin it so results don't drift.
DEMO_TODAY = date(2026, 11, 27)


@pytest.fixture(autouse=True)
def jwt_secret(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-only-secret-that-is-long-enough-0123456789")


def memory_engine():
    return create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )


@pytest.fixture(scope="session")
def demo_template():
    """The demo seed loaded once per test run; tests get their own copy via ``demo_engine``."""

    engine = memory_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed_demo_data(session, DEMO_TODAY, password=DEFAULT_DEMO_PASSWORD)
    yield engine
    engine.dispose()


@pytest.fixture
def demo_engine(demo_template):
    """A fresh in-memory database holding the demo seed, copied from the template."""

    engine = memory_engine()
    source = demo_template.raw_connection()
    target = engine.raw_connection()
    try:
        source.driver_connection.backup(target.driver_connection)
    finally:
        source.close()
        target.close()
    yield engine
    engine.dispose()
