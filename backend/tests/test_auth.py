from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app import database
from app.main import app
from app.models import Bin, BinType, GarmentOutcome, GarmentRecord, Site, User
from app.schemas import UserRole
from app.security import JWT_ALGORITHM, create_access_token, get_jwt_secret, hash_password

PASSWORD = "demo-password"


@pytest.fixture
def env(monkeypatch):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    # Enforce foreign keys like MySQL does so delete-restriction behaviour is realistic.
    event.listen(engine, "connect", lambda conn, _: conn.execute("PRAGMA foreign_keys=ON"))
    monkeypatch.setattr(database, "get_engine", lambda: engine)
    SQLModel.metadata.create_all(engine)
    with TestClient(app) as http:
        yield http, engine
    engine.dispose()


def add_user(engine, username, role, password=PASSWORD) -> int:
    with Session(engine) as session:
        user = User(username=username, password_hash=hash_password(password), role=role)
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id


def login(http, username, password=PASSWORD):
    return http.post("/api/auth/login", json={"username": username, "password": password})


def headers_for(http, username, password=PASSWORD) -> dict[str, str]:
    return {"Authorization": f"Bearer {login(http, username, password).json()['access_token']}"}


def test_login_returns_token_and_user_without_secrets(env):
    http, engine = env
    user_id = add_user(engine, "boss@example.com", UserRole.ADMIN)
    response = login(http, "boss@example.com")
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["user"] == {"id": user_id, "username": "boss@example.com", "role": "admin"}
    assert "password" not in response.text and "scrypt" not in response.text


def test_login_username_is_case_insensitive(env):
    http, engine = env
    add_user(engine, "boss@example.com", UserRole.ADMIN)
    assert login(http, "  BOSS@Example.com ").status_code == 200


@pytest.mark.parametrize(
    ("username", "password"),
    [("boss@example.com", "wrong-password"), ("nobody@example.com", PASSWORD)],
)
def test_login_failures_share_one_message(env, username, password):
    http, engine = env
    add_user(engine, "boss@example.com", UserRole.ADMIN)
    response = login(http, username, password)
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid username or password"}


def test_login_rejects_empty_credentials(env):
    http, _ = env
    assert http.post("/api/auth/login", json={"username": "", "password": ""}).status_code == 422


def test_me_requires_a_valid_token(env):
    http, engine = env
    add_user(engine, "staff@example.com", UserRole.STAFF)
    assert http.get("/api/auth/me").status_code == 401
    assert http.get("/api/auth/me", headers={"Authorization": "Bearer junk"}).status_code == 401
    me = http.get("/api/auth/me", headers=headers_for(http, "staff@example.com"))
    assert me.status_code == 200
    assert me.json()["username"] == "staff@example.com"


def test_expired_and_forged_tokens_are_rejected(env):
    http, engine = env
    user_id = add_user(engine, "staff@example.com", UserRole.STAFF)
    expired = jwt.encode(
        {"sub": str(user_id), "exp": datetime.now(UTC) - timedelta(minutes=1)},
        get_jwt_secret(),
        algorithm=JWT_ALGORITHM,
    )
    forged = jwt.encode(
        {"sub": str(user_id), "exp": datetime.now(UTC) + timedelta(minutes=5)},
        "some-other-secret-that-is-also-long-enough-xx",
        algorithm=JWT_ALGORITHM,
    )
    for token in (expired, forged):
        response = http.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401


def test_jwt_secret_must_be_configured(monkeypatch):
    from app import security

    monkeypatch.setattr(security, "load_dotenv", lambda _: None)
    monkeypatch.setenv("JWT_SECRET", "too-short")
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        create_access_token(1)
    monkeypatch.delenv("JWT_SECRET")
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        create_access_token(1)


def test_user_routes_require_an_administrator(env):
    http, engine = env
    add_user(engine, "manager@example.com", UserRole.MANAGER)
    add_user(engine, "staff@example.com", UserRole.STAFF)
    assert http.get("/api/users").status_code == 401
    assert http.post("/api/users", json={}).status_code == 401
    for username in ("manager@example.com", "staff@example.com"):
        headers = headers_for(http, username)
        assert http.get("/api/users", headers=headers).status_code == 403
        assert http.patch("/api/users/1", headers=headers, json={}).status_code == 403
        assert http.delete("/api/users/1", headers=headers).status_code == 403


def test_admin_user_lifecycle(env):
    http, engine = env
    add_user(engine, "boss@example.com", UserRole.ADMIN)
    admin = headers_for(http, "boss@example.com")

    created = http.post(
        "/api/users",
        headers=admin,
        json={"username": "New@Example.com", "password": "first-password", "role": "staff"},
    )
    assert created.status_code == 201
    user_id = created.json()["id"]
    assert login(http, "new@example.com", "first-password").status_code == 200

    updated = http.patch(
        f"/api/users/{user_id}",
        headers=admin,
        json={"username": "Renamed@Example.com", "role": "manager", "password": "second-password"},
    )
    assert updated.status_code == 200
    assert updated.json() == {"id": user_id, "username": "renamed@example.com", "role": "manager"}
    assert login(http, "renamed@example.com", "first-password").status_code == 401
    assert login(http, "renamed@example.com", "second-password").status_code == 200

    # A partial update leaves everything else alone.
    only_role = http.patch(f"/api/users/{user_id}", headers=admin, json={"role": "staff"})
    assert only_role.json()["username"] == "renamed@example.com"
    assert login(http, "renamed@example.com", "second-password").status_code == 200

    assert http.delete(f"/api/users/{user_id}", headers=admin).status_code == 204
    assert http.get(f"/api/users/{user_id}", headers=admin).status_code == 404
    assert login(http, "renamed@example.com", "second-password").status_code == 401


def test_update_and_delete_missing_user(env):
    http, engine = env
    add_user(engine, "boss@example.com", UserRole.ADMIN)
    admin = headers_for(http, "boss@example.com")
    assert http.patch("/api/users/999", headers=admin, json={"role": "staff"}).status_code == 404
    assert http.delete("/api/users/999", headers=admin).status_code == 404


def test_update_validation_and_duplicate_username(env):
    http, engine = env
    add_user(engine, "boss@example.com", UserRole.ADMIN)
    other = add_user(engine, "other@example.com", UserRole.STAFF)
    admin = headers_for(http, "boss@example.com")
    clash = http.patch(f"/api/users/{other}", headers=admin, json={"username": "BOSS@example.com"})
    assert clash.status_code == 409
    for bad in ({"username": "nope"}, {"role": "owner"}, {"password": "short"}):
        assert http.patch(f"/api/users/{other}", headers=admin, json=bad).status_code == 422


def test_admin_cannot_delete_self(env):
    http, engine = env
    admin_id = add_user(engine, "boss@example.com", UserRole.ADMIN)
    add_user(engine, "second@example.com", UserRole.ADMIN)
    response = http.delete(f"/api/users/{admin_id}", headers=headers_for(http, "boss@example.com"))
    assert response.status_code == 400


def test_last_administrator_cannot_be_demoted(env):
    http, engine = env
    admin_id = add_user(engine, "boss@example.com", UserRole.ADMIN)
    admin = headers_for(http, "boss@example.com")
    blocked = http.patch(f"/api/users/{admin_id}", headers=admin, json={"role": "staff"})
    assert blocked.status_code == 400
    assert http.get(f"/api/users/{admin_id}", headers=admin).json()["role"] == "admin"

    add_user(engine, "second@example.com", UserRole.ADMIN)
    allowed = http.patch(f"/api/users/{admin_id}", headers=admin, json={"role": "staff"})
    assert allowed.status_code == 200


def test_role_change_takes_effect_on_existing_token(env):
    http, engine = env
    add_user(engine, "boss@example.com", UserRole.ADMIN)
    target = add_user(engine, "second@example.com", UserRole.ADMIN)
    admin = headers_for(http, "boss@example.com")
    second = headers_for(http, "second@example.com")
    assert http.get("/api/users", headers=second).status_code == 200
    http.patch(f"/api/users/{target}", headers=admin, json={"role": "staff"})
    assert http.get("/api/users", headers=second).status_code == 403


def test_deleted_users_token_stops_working(env):
    http, engine = env
    add_user(engine, "boss@example.com", UserRole.ADMIN)
    victim = add_user(engine, "victim@example.com", UserRole.STAFF)
    victim_headers = headers_for(http, "victim@example.com")
    http.delete(f"/api/users/{victim}", headers=headers_for(http, "boss@example.com"))
    assert http.get("/api/auth/me", headers=victim_headers).status_code == 401


def test_user_with_recorded_activity_cannot_be_deleted(env):
    http, engine = env
    add_user(engine, "boss@example.com", UserRole.ADMIN)
    staff_id = add_user(engine, "staff@example.com", UserRole.STAFF)
    with Session(engine) as session:
        site = Site(code="BKK", name="Bangkok")
        session.add(site)
        session.commit()
        session.refresh(site)
        resale_bin = Bin(site_id=site.id, code="B-1", bin_type=BinType.RESALE)
        session.add(resale_bin)
        session.commit()
        session.refresh(resale_bin)
        session.add(
            GarmentRecord(
                site_id=site.id,
                recorded_by_user_id=staff_id,
                bin_id=resale_bin.id,
                outcome=GarmentOutcome.RESALE,
                received_at=datetime.now(UTC),
            )
        )
        session.commit()

    admin = headers_for(http, "boss@example.com")
    response = http.delete(f"/api/users/{staff_id}", headers=admin)
    assert response.status_code == 409
    assert http.get(f"/api/users/{staff_id}", headers=admin).status_code == 200
