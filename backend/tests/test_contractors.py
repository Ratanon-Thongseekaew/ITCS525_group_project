import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from app import database
from app.auth import require_admin
from app.database import get_session
from app.main import app
from app.models import Contractor, ContractorReport, Handoff, User


def admin_override() -> User:
    return User(id=-1, username="x", password_hash="x", role="admin")


@pytest.fixture
def client(monkeypatch):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    # Enforce foreign keys like MySQL does.
    event.listen(engine, "connect", lambda conn, _: conn.execute("PRAGMA foreign_keys=ON"))
    monkeypatch.setattr(database, "get_engine", lambda: engine)
    SQLModel.metadata.create_all(engine)
    # These tests cover CRUD behaviour; authentication is covered in test_auth.py.
    app.dependency_overrides[require_admin] = admin_override
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture
def demo_client(demo_engine):
    """A client on the demo seed, where every contractor has handoffs and reports."""

    def override_session():
        with Session(demo_engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[require_admin] = admin_override
    with TestClient(app) as test_client:
        yield test_client, demo_engine
    app.dependency_overrides.clear()


def create(http, **fields):
    return http.post("/api/contractors", json={"name": "GreenLoop", **fields})


def test_create_list_and_get_contractor(client):
    response = create(
        client,
        name="  GreenLoop Recycling  ",
        contact_name="  Ann P. ",
        contact_email=" Ann@GreenLoop.example ",
    )
    assert response.status_code == 201
    created = response.json()
    assert created == {
        "id": created["id"],
        "name": "GreenLoop Recycling",
        "contact_name": "Ann P.",
        "contact_email": "ann@greenloop.example",
        "is_active": True,
    }
    assert create(client, name="Alpha Fibre").status_code == 201

    names = [item["name"] for item in client.get("/api/contractors").json()]
    assert names == ["Alpha Fibre", "GreenLoop Recycling"]
    assert client.get(f"/api/contractors/{created['id']}").json() == created


def test_blank_contact_details_are_saved_as_null(client):
    created = create(client, contact_name="   ", contact_email="").json()
    assert created["contact_name"] is None
    assert created["contact_email"] is None


@pytest.mark.parametrize(
    "payload",
    [
        {"name": ""},
        {"name": "   "},
        {"name": "x" * 161},
        {"name": "GreenLoop", "contact_email": "not-an-email"},
        {"name": "GreenLoop", "contact_name": "x" * 121},
        {"name": "GreenLoop", "contact_name": 5},
    ],
)
def test_create_rejects_invalid_input(client, payload):
    assert client.post("/api/contractors", json=payload).status_code == 422


def test_duplicate_names_conflict_regardless_of_case(client):
    assert create(client).status_code == 201
    duplicate = create(client, name="greenloop")
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "A contractor with this name already exists"

    other = create(client, name="Alpha Fibre").json()
    renamed = client.patch(f"/api/contractors/{other['id']}", json={"name": "GREENLOOP"})
    assert renamed.status_code == 409


def test_update_changes_only_sent_fields(client):
    created = create(client, contact_name="Ann", contact_email="ann@example.com").json()
    url = f"/api/contractors/{created['id']}"

    renamed = client.patch(url, json={"name": "GreenLoop Co."}).json()
    assert renamed["name"] == "GreenLoop Co."
    assert renamed["contact_name"] == "Ann"

    # Changing only the letter case of its own name is allowed.
    assert client.patch(url, json={"name": "GREENLOOP CO."}).status_code == 200

    cleared = client.patch(url, json={"contact_name": None, "contact_email": None}).json()
    assert cleared["contact_name"] is None
    assert cleared["contact_email"] is None

    # A null name or status is ignored rather than clearing the field.
    unchanged = client.patch(url, json={"name": None, "is_active": None}).json()
    assert unchanged["name"] == "GREENLOOP CO."
    assert unchanged["is_active"] is True


def test_deactivate_and_reactivate(client):
    url = f"/api/contractors/{create(client).json()['id']}"
    assert client.patch(url, json={"is_active": False}).json()["is_active"] is False
    # Inactive contractors are still listed for administrators.
    assert [item["is_active"] for item in client.get("/api/contractors").json()] == [False]
    assert client.patch(url, json={"is_active": True}).json()["is_active"] is True


def test_missing_contractor_returns_404(client):
    assert client.get("/api/contractors/999").status_code == 404
    assert client.patch("/api/contractors/999", json={}).status_code == 404
    assert client.delete("/api/contractors/999").status_code == 404


def test_delete_unused_contractor(client):
    url = f"/api/contractors/{create(client).json()['id']}"
    assert client.delete(url).status_code == 204
    assert client.get(url).status_code == 404


@pytest.mark.parametrize("history", [Handoff, ContractorReport])
def test_contractor_with_history_cannot_be_deleted(demo_client, history):
    http, engine = demo_client
    with Session(engine) as session:
        contractor_id = session.exec(select(history.contractor_id)).first()
        assert contractor_id is not None

    response = http.delete(f"/api/contractors/{contractor_id}")
    assert response.status_code == 409
    assert "Deactivate it instead" in response.json()["detail"]
    with Session(engine) as session:
        assert session.get(Contractor, contractor_id) is not None
