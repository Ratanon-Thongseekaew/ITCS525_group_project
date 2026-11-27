from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.database import get_session
from app.main import app
from app.models import Bin, BinStatus, BinType, Site


@pytest.fixture
def resale_client(demo_engine):
    def override_session():
        with Session(demo_engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            client.engine = demo_engine
            yield client
    finally:
        app.dependency_overrides.clear()


def test_resale_summary_returns_top_sites_from_persisted_bins(
    resale_client: TestClient,
) -> None:
    with Session(resale_client.engine) as session:
        totals: dict[str, Decimal] = defaultdict(Decimal)
        for bin_record, site in session.exec(
            select(Bin, Site)
            .join(Site, Site.id == Bin.site_id)
            .where(Bin.bin_type == BinType.RESALE, Bin.actual_value.is_not(None))
        ).all():
            totals[site.name] += bin_record.actual_value
    expected = sorted(totals.items(), key=lambda item: (-item[1], item[0]))[:5]

    response = resale_client.get("/api/resale-bins/summary")

    assert response.status_code == 200
    stores = response.json()["stores"]
    assert [store["name"] for store in stores] == [name for name, _total in expected]
    assert [store["actual_value"] for store in stores] == [float(total) for _n, total in expected]
    assert stores[0]["name"] == "Bangkok Sorting Center"  # the busiest store


def test_demo_seed_has_unprocessed_resale_bins_for_direct_resale(
    resale_client: TestClient,
) -> None:
    with Session(resale_client.engine) as session:
        waiting = session.exec(
            select(Site.code)
            .join(Bin, Bin.site_id == Site.id)
            .where(
                Bin.bin_type == BinType.RESALE,
                Bin.status == BinStatus.CLOSED,
                Bin.actual_value.is_(None),
            )
        ).all()

    assert sorted(waiting) == ["BKK", "BKK", "CNX", "HKT"]


def staff_and_site(client: TestClient) -> tuple[dict, int]:
    options = client.get("/api/handoffs/options").json()
    staff = next(actor for actor in options["actors"] if actor["role"] == "staff")
    return staff, staff["site_ids"][0]


def waiting_bin(engine, site_id: int, code: str) -> int:
    with Session(engine) as session:
        bin_record = Bin(
            site_id=site_id,
            code=code,
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
        return bin_record.id


def test_resale_bins_can_be_processed_and_are_persisted(resale_client: TestClient) -> None:
    staff, site_id = staff_and_site(resale_client)
    bin_id = waiting_bin(resale_client.engine, site_id, "WAITING-RS-01")

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
    staff, site_id = staff_and_site(resale_client)
    bin_id = waiting_bin(resale_client.engine, site_id, "WAITING-RS-02")
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
