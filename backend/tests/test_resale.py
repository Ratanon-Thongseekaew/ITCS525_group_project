from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from auth_helpers import bearer, demo_user_id
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.database import get_session
from app.main import app
from app.models import Bin, BinStatus, BinType, ResaleBinProcess, Site, UserSite


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

    admin = bearer(demo_user_id(resale_client.engine, "admin@example.com"))
    response = resale_client.get("/api/resale-bins/summary", headers=admin)

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


def staff_and_site(client: TestClient) -> tuple[dict[str, str], int]:
    """A signed-in Bangkok staff member's headers and their store."""

    staff_id = demo_user_id(client.engine, "staff.bkk@example.com")
    with Session(client.engine) as session:
        site_id = session.exec(select(UserSite.site_id).where(UserSite.user_id == staff_id)).one()
    return bearer(staff_id), site_id


PROCESS_12 = {
    "accepted_item_count": 12,
    "rejected_item_count": 0,
    "revenue": 100,
    "processed_at": "2026-11-26",
}


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
        headers=staff,
        json={
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
    listed = resale_client.get(
        "/api/resale-bins", params={"site_id": site_id}, headers=staff
    ).json()
    saved = next(record for record in listed if record["id"] == bin_id)
    assert saved["status"] == "processed"
    assert saved["accepted_item_count"] == 12


def test_resale_processing_requires_exact_item_count_and_cannot_repeat(
    resale_client: TestClient,
) -> None:
    staff, site_id = staff_and_site(resale_client)
    bin_id = waiting_bin(resale_client.engine, site_id, "WAITING-RS-02")
    payload = {
        "accepted_item_count": 11,
        "rejected_item_count": 0,
        "revenue": 100,
        "processed_at": "2026-11-26",
    }

    invalid = resale_client.post(f"/api/resale-bins/{bin_id}/process", json=payload, headers=staff)
    assert invalid.status_code == 422

    payload["accepted_item_count"] = 12
    processed = resale_client.post(
        f"/api/resale-bins/{bin_id}/process", json=payload, headers=staff
    )
    assert processed.status_code == 200
    duplicate = resale_client.post(
        f"/api/resale-bins/{bin_id}/process", json=payload, headers=staff
    )
    assert duplicate.status_code == 409


def test_resale_routes_need_a_signed_in_user(resale_client: TestClient) -> None:
    _staff, site_id = staff_and_site(resale_client)
    bin_id = waiting_bin(resale_client.engine, site_id, "WAITING-RS-03")

    assert resale_client.get("/api/resale-bins", params={"site_id": site_id}).status_code == 401
    assert resale_client.get("/api/resale-bins/summary").status_code == 401
    processed = resale_client.post(f"/api/resale-bins/{bin_id}/process", json=PROCESS_12)
    assert processed.status_code == 401


def test_resale_reads_follow_the_site_rules(resale_client: TestClient) -> None:
    engine = resale_client.engine
    staff, bkk_id = staff_and_site(resale_client)
    with Session(engine) as session:
        cnx_id = session.exec(select(Site.id).where(Site.code == "CNX")).one()
    manager = bearer(demo_user_id(engine, "manager.bkk@example.com"))

    def listing(site_id: int, headers: dict[str, str]) -> int:
        return resale_client.get(
            "/api/resale-bins", params={"site_id": site_id}, headers=headers
        ).status_code

    assert listing(bkk_id, staff) == 200
    assert listing(cnx_id, staff) == 403
    assert listing(bkk_id, manager) == 200
    assert listing(cnx_id, manager) == 403
    # The store summary is for managers and administrators.
    assert resale_client.get("/api/resale-bins/summary", headers=staff).status_code == 403
    assert resale_client.get("/api/resale-bins/summary", headers=manager).status_code == 200


def test_only_staff_of_the_bins_store_can_process_it(resale_client: TestClient) -> None:
    engine = resale_client.engine
    _staff, bkk_id = staff_and_site(resale_client)
    bin_id = waiting_bin(engine, bkk_id, "WAITING-RS-04")
    other_staff = bearer(demo_user_id(engine, "staff.cnx@example.com"))
    manager = bearer(demo_user_id(engine, "manager.bkk@example.com"))
    url = f"/api/resale-bins/{bin_id}/process"

    other = resale_client.post(url, json=PROCESS_12, headers=other_staff)
    assert other.status_code == 403
    assert other.json()["detail"] == "Staff can only process bins at their site."
    as_manager = resale_client.post(url, json=PROCESS_12, headers=manager)
    assert as_manager.status_code == 403
    assert as_manager.json()["detail"] == "Only store staff can process resale bins."


def test_processing_records_the_signed_in_staff_not_a_sent_actor_id(
    resale_client: TestClient,
) -> None:
    engine = resale_client.engine
    staff, site_id = staff_and_site(resale_client)
    bin_id = waiting_bin(engine, site_id, "WAITING-RS-05")
    admin_id = demo_user_id(engine, "admin@example.com")

    response = resale_client.post(
        f"/api/resale-bins/{bin_id}/process",
        json={**PROCESS_12, "actor_id": admin_id},
        headers=staff,
    )

    assert response.status_code == 200, response.text
    with Session(engine) as session:
        process = session.exec(
            select(ResaleBinProcess).where(ResaleBinProcess.bin_id == bin_id)
        ).one()
        assert process.processed_by_user_id == demo_user_id(engine, "staff.bkk@example.com")
