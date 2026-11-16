import os
from collections.abc import Iterator
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import URL, Engine, make_url
from sqlmodel import Session, create_engine

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def get_database_url() -> URL:
    """Build a database URL without interpolating or logging credentials."""

    load_dotenv(REPOSITORY_ROOT / ".env")
    if database_url := os.getenv("DATABASE_URL"):
        return make_url(database_url)

    if not os.getenv("MYSQL_PASSWORD"):
        raise RuntimeError(
            "Set MYSQL_PASSWORD in the repository root .env before starting the API."
        )

    return URL.create(
        "mysql+pymysql",
        username=os.getenv("MYSQL_USER", "textile_app"),
        password=os.environ["MYSQL_PASSWORD"],
        host=os.getenv("MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("MYSQL_PORT", "3307")),
        database=os.getenv("MYSQL_DATABASE", "textile_track"),
        query={"charset": "utf8mb4"},
    )


@lru_cache
def get_engine() -> Engine:
    return create_engine(get_database_url(), pool_pre_ping=True, pool_recycle=3600)


def get_session() -> Iterator[Session]:
    with Session(get_engine()) as session:
        yield session
