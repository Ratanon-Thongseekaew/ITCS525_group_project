import hashlib

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, create_engine, select
from sqlmodel.pool import StaticPool

from app import database
from app.main import app
from app.models import User


@pytest.fixture
def client(monkeypatch):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    monkeypatch.setattr(database, "get_engine", lambda: engine)
    with TestClient(app) as test_client:
        yield test_client, engine
    engine.dispose()


@pytest.mark.parametrize("role", ["admin", "manager", "staff"])
def test_create_and_read_user(client, role):
    http, engine = client
    payload = {"username": "USER@example.com", "password": "demo-password", "role": role}
    response = http.post("/api/users", json=payload)
    assert response.status_code == 201
    expected = {"id": response.json()["id"], "username": "user@example.com", "role": role}
    assert response.json() == expected
    assert http.get(f"/api/users/{expected['id']}").json() == expected
    assert http.get("/api/users").json() == [expected]
    assert http.get("/api/users?offset=1&limit=1").json() == []

    with Session(engine) as session:
        user = session.exec(select(User)).one()
        algorithm, n, r, p, salt, digest = user.password_hash.split("$")
        assert algorithm == "scrypt"
        assert (
            hashlib.scrypt(
                payload["password"].encode(), salt=bytes.fromhex(salt), n=int(n), r=int(r), p=int(p)
            ).hex()
            == digest
        )


def test_duplicate_username(client):
    http, _ = client
    payload = {"username": "user@example.com", "password": "demo-password", "role": "staff"}
    assert http.post("/api/users", json=payload).status_code == 201
    payload["username"] = "USER@example.com"
    assert http.post("/api/users", json=payload).status_code == 409
    assert len(http.get("/api/users").json()) == 1


@pytest.mark.parametrize(
    "changes",
    [
        {"username": "not-an-email"},
        {"username": "a" * 245 + "@example.com"},
        {"role": "owner"},
        {"password": ""},
        {"password": "short"},
        {"password": "a" * 129},
        {"password": None},
    ],
)
def test_invalid_user(client, changes):
    http, _ = client
    payload = {"username": "user@example.com", "password": "demo-password", "role": "staff"}
    response = http.post("/api/users", json=payload | changes)
    assert response.status_code == 422
    assert http.get("/api/users").json() == []


def test_missing_user_and_empty_list(client):
    http, _ = client
    assert http.get("/api/users").json() == []
    assert http.get("/api/users/999").status_code == 404
    assert http.get("/api/users?limit=101").status_code == 422
    assert http.get("/api/users?offset=-1").status_code == 422


def test_mysql_configuration(monkeypatch):
    monkeypatch.setattr(database, "load_dotenv", lambda _: None)
    monkeypatch.setenv("MYSQL_PASSWORD", "test-only@:/password")
    monkeypatch.setenv("MYSQL_USER", "test_user")
    monkeypatch.setenv("MYSQL_DATABASE", "test_db")
    monkeypatch.setenv("MYSQL_HOST", "127.0.0.1")
    monkeypatch.setenv("MYSQL_PORT", "3307")
    database.get_engine.cache_clear()
    try:
        engine = database.get_engine()
        assert engine.url.drivername == "mysql+pymysql"
        assert engine.url.password == "test-only@:/password"
        assert engine.url.database == "test_db"
        assert engine.url.port == 3307
        engine.dispose()
    finally:
        database.get_engine.cache_clear()


def test_missing_database_password(monkeypatch):
    monkeypatch.setattr(database, "load_dotenv", lambda _: None)
    monkeypatch.delenv("MYSQL_PASSWORD", raising=False)
    database.get_engine.cache_clear()
    with pytest.raises(RuntimeError, match="MYSQL_PASSWORD"):
        database.get_engine()
