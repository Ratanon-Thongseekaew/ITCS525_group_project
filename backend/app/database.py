import os
from collections.abc import Iterator
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import URL, Engine
from sqlmodel import Session, SQLModel, create_engine

from . import models  # noqa: F401 -- register tables before create_all


@lru_cache
def get_engine() -> Engine:
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    if not os.getenv("MYSQL_PASSWORD"):
        raise RuntimeError(
            "Set MYSQL_PASSWORD in the repository root .env before starting the API."
        )
    url = URL.create(
        "mysql+pymysql",
        username=os.getenv("MYSQL_USER", "textile_app"),
        password=os.environ["MYSQL_PASSWORD"],
        host=os.getenv("MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("MYSQL_PORT", "3307")),
        database=os.getenv("MYSQL_DATABASE", "textile_track"),
        query={"charset": "utf8mb4"},
    )
    return create_engine(url, pool_pre_ping=True)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(get_engine())


def get_session() -> Iterator[Session]:
    with Session(get_engine()) as session:
        yield session
