import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.database import get_session
from app.main import app
from seed import seed_dashboard_data


@pytest.fixture
def dashboard_client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed_dashboard_data(session)

    def override_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_monthly_dashboard_aggregates_seeded_data(dashboard_client: TestClient) -> None:
    response = dashboard_client.get(
        "/api/dashboard", params={"frequency": "monthly", "year": 2026, "month": 10}
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["period_label"] == "October 2026"
    assert payload["summary"] == {
        "recycling_bins_collected": 2,
        "recycling_bins_reported": 1,
        "pending_bins": 1,
        "disputed_handoffs": 1,
        "recovery_rate": 95.0,
        "diverted_weight_kg": 223.25,
        "total_recorded_weight_kg": 482.0,
        "total_reported_weight_kg": 235.0,
        "weight_variance_kg": -247.0,
    }
    assert {outcome["category"] for outcome in payload["outcomes"]} == {
        "upcycled",
        "fibre_to_fibre",
        "downcycled",
        "exported",
        "landfilled",
        "incinerated_energy_recovery",
    }
    assert {exception["status"] for exception in payload["exceptions"]} == {
        "pending",
        "disputed",
    }
    assert len(payload["filters"]["sites"]) == 2
    assert len(payload["filters"]["contractors"]) == 2
    assert payload["filters"]["available_years"] == [2026]


def test_dashboard_filters_by_site(dashboard_client: TestClient) -> None:
    options = dashboard_client.get("/api/dashboard", params={"year": 2026, "month": 10}).json()[
        "filters"
    ]
    bangkok_id = next(site["id"] for site in options["sites"] if site["code"] == "DASH-BKK")

    response = dashboard_client.get(
        "/api/dashboard",
        params={"year": 2026, "month": 10, "site_id": bangkok_id},
    )

    assert response.status_code == 200
    summary = response.json()["summary"]
    assert summary["recycling_bins_collected"] == 1
    assert summary["recycling_bins_reported"] == 1
    assert summary["pending_bins"] == 0
    assert summary["disputed_handoffs"] == 1
    assert summary["total_recorded_weight_kg"] == 235.0
    assert summary["total_reported_weight_kg"] == 235.0


def test_quarterly_dashboard_uses_quarter_boundaries(dashboard_client: TestClient) -> None:
    response = dashboard_client.get(
        "/api/dashboard",
        params={"frequency": "quarterly", "year": 2026, "quarter": 3},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["period_label"] == "Q3 2026"
    assert payload["month"] is None
    assert payload["quarter"] == 3
    assert payload["summary"]["recycling_bins_collected"] == 6
    assert payload["summary"]["recycling_bins_reported"] == 6
    assert payload["exceptions"] == []


def test_dashboard_rejects_invalid_filters(dashboard_client: TestClient) -> None:
    assert dashboard_client.get("/api/dashboard?year=2026&month=13").status_code == 422
    assert dashboard_client.get("/api/dashboard?year=2026&site_id=9999").status_code == 404
    assert dashboard_client.get("/api/dashboard?year=2026&contractor_id=9999").status_code == 404
