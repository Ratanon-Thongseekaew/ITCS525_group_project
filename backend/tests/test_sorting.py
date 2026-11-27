from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from app.database import get_session
from app.main import app
from app.models import (
    Bin,
    BinStatus,
    BinType,
    EprQuarterReport,
    EprReportStatus,
    GarmentOutcome,
    GarmentRecord,
    Site,
    User,
    UserSite,
)
from app.schemas import UserRole
from seed import seed_development_data

SORT = "/api/garments/sort"


@dataclass
class SortingTestContext:
    client: TestClient
    engine: object

    def session(self) -> Session:
        return Session(self.engine)

    def user_id(self, username: str) -> int:
        with self.session() as session:
            return session.exec(select(User.id).where(User.username == username)).one()

    def site_id(self, code: str) -> int:
        with self.session() as session:
            return session.exec(select(Site.id).where(Site.code == code)).one()

    @property
    def bkk_staff_id(self) -> int:
        return self.user_id("dashboard.staff.bkk@example.invalid")

    @property
    def cnx_staff_id(self) -> int:
        return self.user_id("dashboard.staff.cnx@example.invalid")

    @property
    def manager_id(self) -> int:
        return self.user_id("dashboard.manager@example.invalid")

    @property
    def bkk_site_id(self) -> int:
        with self.session() as session:
            return session.exec(select(Bin.site_id).where(Bin.code.startswith("SORT-BKK"))).first()

    def sort(self, condition: str, actor_id: int | None = None, **fields):
        body = {"actor_id": actor_id or self.bkk_staff_id, "condition": condition, **fields}
        return self.client.post(SORT, json=body)

    def read(self, path: str, actor_id: int | None = None, site_id: int | None = None, **query):
        """GET as an actor (BKK staff by default), for the BKK site unless told otherwise."""

        params = {"actor_id": actor_id or self.bkk_staff_id, **query}
        if site_id is not None:
            params["site_id"] = site_id
        return self.client.get(path, params=params)

    def active_bins(self, actor_id: int | None = None, site_id: int | None = None) -> dict:
        response = self.read("/api/bins/active", actor_id, site_id)
        assert response.status_code == 200
        return response.json()

    def stats(self, actor_id: int | None = None, site_id: int | None = None) -> dict:
        response = self.read("/api/sorting/stats", actor_id, site_id)
        assert response.status_code == 200
        return response.json()

    def make_bin(self, bin_type: str, **fields):
        return self.client.post(
            "/api/bins", json={"actor_id": self.bkk_staff_id, "bin_type": bin_type, **fields}
        )

    def close(self, bin_id: int, actor_id: int | None = None, **fields):
        return self.client.post(
            f"/api/bins/{bin_id}/close", json={"actor_id": actor_id or self.bkk_staff_id, **fields}
        )


@pytest.fixture
def ctx() -> Iterator[SortingTestContext]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed_development_data(session)

    def override_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            yield SortingTestContext(client=client, engine=engine)
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_seed_is_idempotent_and_adds_one_open_bin_of_each_type_per_site(ctx) -> None:
    with ctx.session() as session:
        seed_development_data(session)
        bins = session.exec(select(Bin).where(Bin.code.startswith("SORT-"))).all()
    assert len(bins) == 6
    assert {b.bin_type for b in bins} == {BinType.RESALE, BinType.RECYCLE, BinType.REPAIR}
    assert all(b.status is BinStatus.ACTIVE and b.item_count == 0 for b in bins)


@pytest.mark.parametrize(
    ("condition", "outcome", "bin_type", "label"),
    [
        ("good_reusable", GarmentOutcome.RESALE, "resale", "Good/Reusable"),
        ("worn_recyclable", GarmentOutcome.RECYCLE, "recycle", "Worn/Recyclable"),
        ("repair_upcycle", GarmentOutcome.REPAIR_UPCYCLE, "repair", "Repair/Upcycle"),
    ],
)
def test_each_condition_is_stored_and_routed_to_its_bin_type(
    ctx, condition, outcome, bin_type, label
) -> None:
    response = ctx.sort(condition, category="Dresses", weight_kg=0.45, notes="Silk dress")

    assert response.status_code == 200
    data = response.json()
    assert data["garment"]["condition"] == condition
    assert data["garment"]["category"] == "Dresses"
    assert data["bin"]["bin_type"] == bin_type
    assert data["bin"]["item_count"] == 1
    assert data["bin"]["total_weight_kg"] == pytest.approx(0.45)
    assert label in data["message"]
    with ctx.session() as session:
        garment = session.get(GarmentRecord, data["garment"]["id"])
        assert garment.outcome is outcome
        assert garment.site_id == ctx.bkk_site_id
        assert garment.recorded_by_user_id == ctx.bkk_staff_id
        assert garment.weight_kg == Decimal("0.450")


def test_sorting_persists_and_updates_stats_and_recent_feed(ctx) -> None:
    for condition in ("good_reusable", "good_reusable", "worn_recyclable", "repair_upcycle"):
        assert ctx.sort(condition).status_code == 200

    stats = ctx.stats()
    assert stats["total_sorted_today"] == 4
    assert (stats["resale_count"], stats["recycle_count"], stats["repair_count"]) == (2, 1, 1)
    assert stats["resale_percentage"] == 50.0
    assert stats["active_repair_bin_code"] == "SORT-BKK-RP-01"
    assert stats["active_resale_bin_items"] == 2

    recent = ctx.read("/api/garments/recent", limit=3).json()
    assert [item["condition"] for item in recent] == [
        "repair_upcycle",
        "worn_recyclable",
        "good_reusable",
    ]


def test_items_fill_the_existing_active_bin_of_their_type(ctx) -> None:
    first = ctx.sort("repair_upcycle").json()
    second = ctx.sort("repair_upcycle").json()

    assert first["bin"]["bin_code"] == "SORT-BKK-RP-01"
    assert second["bin"]["id"] == first["bin"]["id"]
    assert second["bin"]["item_count"] == 2


def test_a_bin_is_created_when_none_is_active(ctx) -> None:
    active = ctx.active_bins()
    assert ctx.close(active["repair_bin"]["id"]).status_code == 409  # empty bins can't be sealed
    with ctx.session() as session:
        for bin_record in session.exec(select(Bin).where(Bin.bin_type == BinType.REPAIR)):
            bin_record.status = BinStatus.CLOSED
            session.add(bin_record)
        session.commit()

    data = ctx.sort("repair_upcycle").json()

    assert data["bin"]["bin_code"].startswith("DASH-BKK-RP-")
    assert data["bin"]["bin_code"] != "SORT-BKK-RP-01"
    assert data["bin"]["bin_type"] == "repair"
    assert data["bin"]["status"] == "active"
    assert data["bin"]["notes"] == "Auto-created when incoming garment was sorted"


def test_a_full_bin_is_skipped_and_a_new_one_is_created(ctx) -> None:
    small = ctx.make_bin("resale", max_capacity=1, bin_code="TINY-1").json()
    with ctx.session() as session:
        for bin_record in session.exec(
            select(Bin).where(Bin.code == "SORT-BKK-RS-01", Bin.bin_type == BinType.RESALE)
        ):
            bin_record.status = BinStatus.CLOSED
            session.add(bin_record)
        session.commit()

    first = ctx.sort("good_reusable").json()
    second = ctx.sort("good_reusable").json()

    assert first["bin"]["id"] == small["id"]
    assert second["bin"]["id"] != small["id"]
    assert second["bin"]["item_count"] == 1


def test_requested_bin_of_the_wrong_type_is_ignored(ctx) -> None:
    resale_bin = ctx.active_bins()["resale_bin"]

    data = ctx.sort("repair_upcycle", bin_id=resale_bin["id"]).json()

    assert data["bin"]["bin_type"] == "repair"


def test_requested_active_bin_of_the_right_type_is_used(ctx) -> None:
    other = ctx.make_bin("recycle").json()

    data = ctx.sort("worn_recyclable", bin_id=other["id"]).json()

    assert data["bin"]["id"] == other["id"]


def test_staff_cannot_use_a_bin_from_another_site(ctx) -> None:
    cnx_bin = ctx.active_bins(ctx.cnx_staff_id)["resale_bin"]

    response = ctx.sort("good_reusable", bin_id=cnx_bin["id"])

    assert response.status_code == 403


@pytest.mark.parametrize("weight", [-0.1, 50.1, 400])
def test_unrealistic_weights_are_rejected(ctx, weight) -> None:
    assert ctx.sort("good_reusable", weight_kg=weight).status_code == 422


def test_a_huge_weight_is_rejected_and_nothing_is_stored(ctx) -> None:
    assert ctx.sort("good_reusable", weight_kg=1e12).status_code == 422
    assert ctx.stats()["total_sorted_today"] == 0


def test_unknown_condition_and_blank_category_are_rejected(ctx) -> None:
    assert ctx.sort("sell_it").status_code == 422
    assert ctx.sort("good_reusable", category="  ").status_code == 422


def test_only_staff_with_a_site_can_sort(ctx) -> None:
    assert ctx.sort("good_reusable", actor_id=ctx.manager_id).status_code == 403
    assert ctx.sort("good_reusable", actor_id=999_999).status_code == 422
    assert ctx.client.post(SORT, json={"condition": "good_reusable"}).status_code == 422


def test_staff_only_see_and_fill_their_own_sites_bins(ctx) -> None:
    ctx.sort("good_reusable")

    cnx = ctx.sort("good_reusable", actor_id=ctx.cnx_staff_id).json()

    assert cnx["bin"]["bin_code"] == "SORT-CNX-RS-01"
    assert ctx.stats()["total_sorted_today"] == 1
    assert ctx.stats(ctx.cnx_staff_id)["total_sorted_today"] == 1
    bkk_codes = {b["bin_code"] for b in ctx.read("/api/bins").json()}
    assert not any("CNX" in code for code in bkk_codes)


def test_stats_only_count_garments_received_today(ctx) -> None:
    ctx.sort("good_reusable")
    with ctx.session() as session:
        # The dashboard seed adds older garment records; pick the one just sorted.
        garment = session.exec(
            select(GarmentRecord)
            .where(GarmentRecord.recorded_by_user_id == ctx.bkk_staff_id)
            .order_by(GarmentRecord.id.desc())
        ).first()
        garment.received_at = datetime.now(UTC) - timedelta(days=2)
        session.add(garment)
        session.commit()

    assert ctx.stats()["total_sorted_today"] == 0
    assert ctx.stats()["resale_percentage"] == 0.0


READ_PATHS = ("/api/bins", "/api/bins/active", "/api/sorting/stats", "/api/garments/recent")


@pytest.mark.parametrize("path", READ_PATHS)
def test_reads_require_a_known_actor(ctx, path) -> None:
    assert ctx.client.get(path).status_code == 422
    assert ctx.read(path, actor_id=999_999).status_code == 422


@pytest.mark.parametrize("path", READ_PATHS)
def test_staff_cannot_read_another_site(ctx, path) -> None:
    cnx_site = ctx.site_id("DASH-CNX")

    assert ctx.read(path, site_id=cnx_site).status_code == 403
    assert ctx.read(path, site_id=ctx.bkk_site_id).status_code == 200
    assert ctx.read(path, site_id=999_999).status_code == 404


def test_staff_reads_default_to_their_own_site(ctx) -> None:
    ctx.sort("good_reusable")
    bins = ctx.read("/api/bins").json()
    recent = ctx.read("/api/garments/recent").json()

    assert {b["site_id"] for b in bins} == {ctx.bkk_site_id}
    assert {g["site_id"] for g in recent} == {ctx.bkk_site_id}
    assert bins[0]["site_name"] and recent[0]["site_name"]


def test_manager_can_switch_between_their_sites(ctx) -> None:
    cnx_site = ctx.site_id("DASH-CNX")
    ctx.sort("good_reusable")
    ctx.sort("worn_recyclable", actor_id=ctx.cnx_staff_id)

    cnx = ctx.read("/api/bins", ctx.manager_id, cnx_site).json()
    bkk = ctx.read("/api/bins", ctx.manager_id, ctx.bkk_site_id).json()

    assert {b["site_id"] for b in cnx} == {cnx_site}
    assert {b["site_id"] for b in bkk} == {ctx.bkk_site_id}
    assert ctx.stats(ctx.manager_id, cnx_site)["recycle_count"] == 1
    assert ctx.stats(ctx.manager_id, ctx.bkk_site_id)["resale_count"] == 1


def test_manager_without_a_site_filter_sees_all_their_sites_combined(ctx) -> None:
    ctx.sort("good_reusable")
    ctx.sort("worn_recyclable", actor_id=ctx.cnx_staff_id)

    bins = ctx.read("/api/bins", ctx.manager_id).json()
    recent = ctx.read("/api/garments/recent", ctx.manager_id).json()
    stats = ctx.stats(ctx.manager_id)

    assert {b["site_id"] for b in bins} == {ctx.bkk_site_id, ctx.site_id("DASH-CNX")}
    assert {g["site_name"] for g in recent} >= {b["site_name"] for b in bins}
    assert (stats["total_sorted_today"], stats["resale_count"], stats["recycle_count"]) == (2, 1, 1)
    # Open bins belong to one site, so a combined view reports none.
    assert stats["active_resale_bin_code"] is None


def test_managers_are_limited_to_the_sites_they_belong_to(ctx) -> None:
    cnx_site = ctx.site_id("DASH-CNX")
    with ctx.session() as session:
        manager = session.get(User, ctx.manager_id)
        for membership in session.exec(select(UserSite).where(UserSite.user_id == manager.id)):
            if membership.site_id == cnx_site:
                session.delete(membership)
        session.commit()

    assert ctx.read("/api/bins", ctx.manager_id, cnx_site).status_code == 403
    assert {b["site_id"] for b in ctx.read("/api/bins", ctx.manager_id).json()} == {ctx.bkk_site_id}


def test_a_manager_without_a_site_and_an_admin_can_read_every_site(ctx) -> None:
    with ctx.session() as session:
        admin = User(
            username="sorting.admin@example.invalid", password_hash="x", role=UserRole.ADMIN
        )
        session.add(admin)
        for membership in session.exec(select(UserSite).where(UserSite.user_id == ctx.manager_id)):
            session.delete(membership)
        session.commit()
        admin_id = admin.id

    for actor_id in (ctx.manager_id, admin_id):
        sites = {b["site_id"] for b in ctx.read("/api/bins", actor_id).json()}
        assert sites >= {ctx.bkk_site_id, ctx.site_id("DASH-CNX")}


def test_active_bins_need_a_single_site_for_managers(ctx) -> None:
    assert ctx.read("/api/bins/active", ctx.manager_id).status_code == 422

    data = ctx.read("/api/bins/active", ctx.manager_id, ctx.bkk_site_id).json()

    assert data["resale_bin"]["site_id"] == ctx.bkk_site_id


def test_create_bin_generates_codes_and_rejects_duplicates(ctx) -> None:
    first = ctx.make_bin("repair")
    assert first.status_code == 201
    assert first.json()["bin_code"].startswith("DASH-BKK-RP-")
    second = ctx.make_bin("repair")
    assert second.json()["bin_code"] != first.json()["bin_code"]
    assert first.json()["status"] == "active"

    custom = ctx.make_bin("repair", bin_code="COUNTER-2", max_capacity=20, notes="Station 2")
    assert custom.json()["bin_code"] == "COUNTER-2"
    assert custom.json()["max_capacity"] == 20

    assert ctx.make_bin("repair", bin_code="COUNTER-2").status_code == 409
    assert ctx.make_bin("repair", max_capacity=0).status_code == 422
    assert ctx.make_bin("repair", max_capacity=501).status_code == 422


def test_generated_bin_codes_are_prefixed_with_the_site_code(ctx) -> None:
    bkk = ctx.make_bin("recycle").json()
    cnx = ctx.make_bin("recycle", actor_id=ctx.cnx_staff_id).json()

    # Each site counts its own bins, so both get the same number under different prefixes.
    assert bkk["bin_code"].startswith("DASH-BKK-RC-")
    assert cnx["bin_code"].startswith("DASH-CNX-RC-")
    assert bkk["bin_code"].removeprefix("DASH-BKK-") == cnx["bin_code"].removeprefix("DASH-CNX-")


def test_custom_bin_code_must_be_unique_across_sites(ctx) -> None:
    assert ctx.make_bin("repair", bin_code="SHARED-1").status_code == 201

    response = ctx.make_bin("repair", bin_code="SHARED-1", actor_id=ctx.cnx_staff_id)

    assert response.status_code == 409
    assert response.json()["detail"] == "A bin with this code already exists."


def test_list_bins_filters_by_type_and_status(ctx) -> None:
    repair_bins = ctx.read("/api/bins", bin_type="repair").json()
    assert "SORT-BKK-RP-01" in {b["bin_code"] for b in repair_bins}
    assert all(b["bin_type"] == "repair" for b in repair_bins)

    ctx.sort("worn_recyclable")
    recycle_id = ctx.active_bins()["recycle_bin"]["id"]
    ctx.close(recycle_id)
    ready = ctx.read("/api/bins", status="ready").json()
    assert recycle_id in {b["id"] for b in ready}
    assert all(b["status"] == "ready" for b in ready)


def test_sealing_a_recycling_bin_makes_it_ready_for_handoff(ctx) -> None:
    ctx.sort("worn_recyclable", weight_kg=0.6)
    recycle_bin = ctx.active_bins()["recycle_bin"]

    response = ctx.close(recycle_bin["id"], notes="Full, moved to backroom")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["ready_at"] is not None
    assert data["closed_at"] is None
    assert data["notes"].endswith("Full, moved to backroom")
    assert ctx.active_bins()["recycle_bin"] is None

    handoff_bins = ctx.client.get(f"/api/handoffs/bins?site_id={ctx.bkk_site_id}").json()["bins"]
    assert recycle_bin["id"] in {b["id"] for b in handoff_bins}


@pytest.mark.parametrize(
    ("condition", "key"), [("good_reusable", "resale_bin"), ("repair_upcycle", "repair_bin")]
)
def test_sealing_a_resale_or_repair_bin_closes_it(ctx, condition, key) -> None:
    ctx.sort(condition)
    bin_id = ctx.active_bins()[key]["id"]

    data = ctx.close(bin_id).json()

    assert data["status"] == "closed"
    assert data["closed_at"] is not None
    assert data["ready_at"] is None


def test_sealing_rules(ctx) -> None:
    ctx.sort("good_reusable")
    bin_id = ctx.active_bins()["resale_bin"]["id"]

    assert ctx.close(999_999).status_code == 404
    assert ctx.close(bin_id, actor_id=ctx.cnx_staff_id).status_code == 403
    assert ctx.close(bin_id, actor_id=ctx.manager_id).status_code == 403
    assert ctx.close(bin_id, notes="x" * 501).status_code == 422
    assert ctx.close(bin_id).status_code == 200
    assert ctx.close(bin_id).status_code == 409
    assert ctx.client.post(f"/api/bins/{bin_id}/close", json={}).status_code == 422


def test_sorted_garments_cannot_be_added_to_a_sealed_bin(ctx) -> None:
    ctx.sort("good_reusable")
    sealed = ctx.active_bins()["resale_bin"]
    ctx.close(sealed["id"])

    data = ctx.sort("good_reusable", bin_id=sealed["id"]).json()

    assert data["bin"]["id"] != sealed["id"]


def test_sorting_is_refused_while_the_current_quarter_is_submitted(ctx) -> None:
    now = datetime.now(UTC)
    with ctx.session() as session:
        garments_before = len(session.exec(select(GarmentRecord)).all())
        quarter = (now.month - 1) // 3 + 1
        report = session.exec(
            select(EprQuarterReport).where(
                EprQuarterReport.report_year == now.year, EprQuarterReport.quarter == quarter
            )
        ).first() or EprQuarterReport(report_year=now.year, quarter=quarter)
        report.status = EprReportStatus.SUBMITTED
        report.submitted_by_user_id = ctx.manager_id
        report.submitted_at = now
        report.locked_at = now
        session.add(report)
        session.commit()

    response = ctx.sort("good_reusable", weight_kg=0.5)

    assert response.status_code == 409
    with ctx.session() as session:
        assert len(session.exec(select(GarmentRecord)).all()) == garments_before
    assert ctx.active_bins()["resale_bin"]["item_count"] == 0


def test_weights_are_rounded_to_the_stored_precision(ctx) -> None:
    ctx.sort("good_reusable", weight_kg=0.12345)
    data = ctx.sort("good_reusable", weight_kg=0.12345).json()

    assert data["garment"]["weight_kg"] == pytest.approx(0.123)
    assert data["bin"]["total_weight_kg"] == pytest.approx(0.246)
