from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.database import get_session
from app.main import app
from app.models import Bin, BinStatus, BinType
from seed import seed_dashboard_data


@pytest.fixture
def resale_client():
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
            client.engine = engine
            yield client
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_resale_summary_returns_top_sites_from_persisted_bins(
    resale_client: TestClient,
) -> None:
    response = resale_client.get("/api/resale-bins/summary")

    assert response.status_code == 200
    stores = response.json()["stores"]
    assert [store["name"] for store in stores] == [
        "Chiang Mai Sorting Center",
        "Bangkok Sorting Center",
    ]
    assert [store["actual_value"] for store in stores] == [95530.0, 85690.0]


def test_resale_bins_can_be_processed_and_are_persisted(resale_client: TestClient) -> None:
    options = resale_client.get("/api/handoffs/options").json()
    staff = next(actor for actor in options["actors"] if actor["role"] == "staff")
    site_id = staff["site_ids"][0]
    with Session(resale_client.engine) as session:
        bin_record = Bin(
            site_id=site_id,
            code="WAITING-RS-01",
            bin_type=BinType.RESALE,
            status=BinStatus.CLOSED,
            item_count=12,
            total_weight_kg=5,
            max_capacity=50,
            closed_at=datetime.now(UTC),
        )
        session.add(bin_record)
        session.commit()
        session.refresh(bin_record)
        bin_id = bin_record.id

    response = resale_client.post(
        f"/api/resale-bins/{bin_id}/process",
        json={
            "actor_id": staff["id"],
            "accepted_item_count": 12,
            "rejected_item_count": 0,
            "revenue": 456.12,
            "processed_at": "2026-11-26",
            "notes": "Test sale",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "processed"
    assert response.json()["revenue"] == 456.12
    assert response.json()["notes"] == "Test sale"
    listed = resale_client.get("/api/resale-bins", params={"site_id": site_id}).json()
    saved = next(record for record in listed if record["id"] == bin_id)
    assert saved["status"] == "processed"
    assert saved["accepted_item_count"] == 12


def test_resale_processing_requires_exact_item_count_and_cannot_repeat(
    resale_client: TestClient,
) -> None:
    options = resale_client.get("/api/handoffs/options").json()
    staff = next(actor for actor in options["actors"] if actor["role"] == "staff")
    site_id = staff["site_ids"][0]
    with Session(resale_client.engine) as session:
        bin_record = Bin(
            site_id=site_id,
            code="WAITING-RS-02",
            bin_type=BinType.RESALE,
            status=BinStatus.CLOSED,
            item_count=12,
            total_weight_kg=5,
            max_capacity=50,
            closed_at=datetime.now(UTC),
        )
        session.add(bin_record)
        session.commit()
        session.refresh(bin_record)
        bin_id = bin_record.id
    payload = {
        "actor_id": staff["id"],
        "accepted_item_count": 11,
        "rejected_item_count": 0,
        "revenue": 100,
        "processed_at": "2026-11-26",
    }

    invalid = resale_client.post(f"/api/resale-bins/{bin_id}/process", json=payload)
    assert invalid.status_code == 422

    payload["accepted_item_count"] = 12
    processed = resale_client.post(f"/api/resale-bins/{bin_id}/process", json=payload)
    assert processed.status_code == 200
    duplicate = resale_client.post(f"/api/resale-bins/{bin_id}/process", json=payload)
    assert duplicate.status_code == 409
