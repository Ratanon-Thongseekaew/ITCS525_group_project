from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, func, select

from app.database import get_session
from app.main import app
from app.models import (
    Bin,
    BinStatus,
    BinType,
    Contractor,
    ContractorReport,
    ContractorReportEntry,
    DispositionCategory,
    Handoff,
    HandoffStatus,
    Site,
    User,
)
from app.schemas import HandoffRecordStatus, UserRole

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
PICKED_UP_AT = "2026-11-21T10:15:00+07:00"
DEFAULT_PHOTO = ("scale.png", PNG_BYTES, "image/png")


@dataclass
class HandoffTestContext:
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

    def bin_id(self, code: str) -> int:
        with self.session() as session:
            return session.exec(select(Bin.id).where(Bin.code == code)).one()

    def bin_status(self, code: str) -> BinStatus:
        with self.session() as session:
            return session.exec(select(Bin.status).where(Bin.code == code)).one()

    def ready_bin(self, site_code: str = "BKK") -> str:
        """The store's seeded recycle bin that is sealed and waiting for pickup."""
        with self.session() as session:
            return session.exec(
                select(Bin.code)
                .join(Site, Site.id == Bin.site_id)
                .where(Site.code == site_code, Bin.status == BinStatus.READY)
                .order_by(Bin.id)
            ).first()

    def new_ready_bin(self, site_code: str = "BKK") -> str:
        """Another sealed recycle bin, for tests that need more than the seeded one."""
        with self.session() as session:
            count = session.exec(select(func.count()).select_from(Bin)).one()
            bin_record = Bin(
                site_id=self.site_id(site_code),
                code=f"{site_code}-RC-T{count}",
                bin_type=BinType.RECYCLE,
                status=BinStatus.READY,
                item_count=50,
                total_weight_kg=Decimal("40.000"),
            )
            session.add(bin_record)
            session.commit()
            return bin_record.code

    def handed_off_bin(self, site_code: str = "BKK") -> str:
        with self.session() as session:
            return session.exec(
                select(Bin.code)
                .join(Site, Site.id == Bin.site_id)
                .where(Site.code == site_code, Bin.status == BinStatus.HANDED_OFF)
            ).first()

    def bin_of_type(self, bin_type: BinType, site_code: str = "BKK") -> str:
        with self.session() as session:
            return session.exec(
                select(Bin.code)
                .join(Site, Site.id == Bin.site_id)
                .where(Site.code == site_code, Bin.bin_type == bin_type)
            ).first()

    def contractor_id(self) -> int:
        with self.session() as session:
            return session.exec(select(Contractor.id).order_by(Contractor.id)).first()

    def handoff_count(self) -> int:
        with self.session() as session:
            return session.exec(select(func.count()).select_from(Handoff)).one()

    @property
    def manager_id(self) -> int:
        return self.user_id("manager.bkk@example.com")

    @property
    def bkk_staff_id(self) -> int:
        return self.user_id("staff.bkk@example.com")

    @property
    def cnx_staff_id(self) -> int:
        return self.user_id("staff.cnx@example.com")

    def record(self, bin_code: str | None = None, *, photo=DEFAULT_PHOTO, **fields):
        data = {
            "bin_id": str(self.bin_id(bin_code or self.ready_bin())),
            "contractor_id": str(self.contractor_id()),
            "actor_id": str(self.bkk_staff_id),
            "picked_up_at": PICKED_UP_AT,
            "staff_weight_kg": "40.000",
            "driver_weight_kg": "40.000",
            "driver_name": "Somchai P.",
            "vehicle_plate_number": "1KB-2345",
            **{key: str(value) for key, value in fields.items()},
        }
        files = {"scale_photo": photo} if photo else None
        return self.client.post("/api/handoffs/pickups", data=data, files=files)

    def add_outcome_report(self, handoff_id: int) -> None:
        """Saves a contractor outcome report entry for the handoff, as an import would."""
        with self.session() as session:
            handoff = session.get(Handoff, handoff_id)
            report = ContractorReport(
                site_id=handoff.site_id,
                contractor_id=handoff.contractor_id,
                uploaded_by_user_id=self.manager_id,
                report_month=date(2026, 12, 1),
                source_filename="outcomes.csv",
            )
            session.add(report)
            session.flush()
            session.add(
                ContractorReportEntry(
                    contractor_report_id=report.id,
                    handoff_id=handoff_id,
                    disposition=DispositionCategory.FIBRE_TO_FIBRE,
                    weight_kg=Decimal("40.000"),
                )
            )
            session.commit()

    def act(self, handoff_id: int, action: str, actor_id: int | None = None):
        return self.client.post(
            f"/api/handoffs/{handoff_id}/{action}", json={"actor_id": actor_id or self.manager_id}
        )


@pytest.fixture
def ctx(tmp_path, monkeypatch, demo_engine) -> Iterator[HandoffTestContext]:
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))

    def override_session():
        with Session(demo_engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            yield HandoffTestContext(client=client, engine=demo_engine)
    finally:
        app.dependency_overrides.clear()


def test_schema_status_mirrors_model_status() -> None:
    assert [status.value for status in HandoffRecordStatus] == [
        status.value for status in HandoffStatus
    ]


def test_seeded_handoffs_follow_the_three_percent_rule(ctx: HandoffTestContext) -> None:
    with ctx.session() as session:
        handoffs = session.exec(select(Handoff)).all()

    assert not any(handoff.status is HandoffStatus.SCHEDULED for handoff in handoffs)
    for handoff in handoffs:
        assert handoff.requires_manager_approval == (handoff.weight_variance_percent > 3)
        if handoff.status is HandoffStatus.DISPUTED:
            assert handoff.approved_by_user_id is None
        if handoff.requires_manager_approval and handoff.status is not HandoffStatus.DISPUTED:
            assert handoff.approved_by_user_id is not None
    assert sum(handoff.status is HandoffStatus.DISPUTED for handoff in handoffs) == 1


def test_scheduling_endpoints_are_gone(ctx: HandoffTestContext) -> None:
    assert ctx.client.post("/api/handoffs", json={}).status_code == 405
    assert ctx.client.post("/api/handoffs/1/pickup", data={}).status_code == 404


def test_options_list_sites_contractors_and_actor_memberships(ctx: HandoffTestContext) -> None:
    body = ctx.client.get("/api/handoffs/options").json()

    assert sorted(site["name"] for site in body["sites"]) == [
        "Bangkok Sorting Center",
        "Chiang Mai Sorting Center",
        "Hat Yai Sorting Center",
        "Khon Kaen Sorting Center",
        "Phuket Sorting Center",
    ]
    assert len(body["contractors"]) == 3
    staff = next(actor for actor in body["actors"] if actor["id"] == ctx.bkk_staff_id)
    assert staff["role"] == "staff"
    assert staff["site_ids"] == [ctx.site_id("BKK")]


def test_ready_bins_are_ready_recycle_bins_without_a_handoff(ctx: HandoffTestContext) -> None:
    bins = ctx.client.get("/api/handoffs/bins").json()["bins"]

    assert sorted(item["code"] for item in bins) == sorted(
        ctx.ready_bin(code) for code in ("BKK", "CNX", "HKT")
    )
    site_bins = ctx.client.get("/api/handoffs/bins", params={"site_id": ctx.site_id("CNX")}).json()[
        "bins"
    ]
    assert {item["site_name"] for item in site_bins} == {"Chiang Mai Sorting Center"}


def test_pickup_within_three_percent_records_all_evidence(ctx: HandoffTestContext) -> None:
    bin_code = ctx.ready_bin()
    response = ctx.record(driver_weight_kg="41.200")  # exactly 3%

    assert response.status_code == 201
    record = response.json()
    assert record["status"] == "picked_up"
    assert record["requires_manager_approval"] is False
    assert record["staff_weight_kg"] == 40.0
    assert record["driver_weight_kg"] == 41.2
    assert record["weight_variance_percent"] == 3.0
    assert record["driver_name"] == "Somchai P."
    assert record["vehicle_plate_number"] == "1KB-2345"
    assert record["picked_up_at"].startswith("2026-11-21T03:15:00")
    assert record["created_by"] == "staff.bkk@example.com"
    assert record["scale_photo_url"] == f"/api/handoffs/{record['id']}/scale-photo"
    assert ctx.bin_status(bin_code) is BinStatus.HANDED_OFF
    codes = [item["code"] for item in ctx.client.get("/api/handoffs/bins").json()["bins"]]
    assert bin_code not in codes

    photo = ctx.client.get(record["scale_photo_url"])
    assert photo.status_code == 200
    assert photo.content == PNG_BYTES


def test_pickup_over_three_percent_is_disputed_and_shown_on_dashboard(
    ctx: HandoffTestContext,
) -> None:
    record = ctx.record(driver_weight_kg="41.300").json()

    assert record["status"] == "disputed"
    assert record["requires_manager_approval"] is True
    assert record["weight_variance_percent"] == 3.25
    dashboard = ctx.client.get(
        "/api/dashboard", params={"frequency": "monthly", "year": 2026, "month": 11}
    ).json()
    disputed = [item for item in dashboard["exceptions"] if item["handoff_id"] == record["id"]]
    assert disputed[0]["status"] == "disputed"
    assert disputed[0]["variance_percent"] == 3.25


@pytest.mark.parametrize(
    ("fields", "status_code"),
    [
        ({"photo": None}, 422),
        ({"photo": ("scale.txt", b"hello", "text/plain")}, 422),
        ({"photo": ("fake.png", b"not a png", "image/png")}, 422),
        ({"photo": ("big.png", PNG_BYTES + b"\x00" * (5 * 1024 * 1024), "image/png")}, 413),
        ({"driver_name": " "}, 422),
        ({"vehicle_plate_number": ""}, 422),
        ({"staff_weight_kg": "-1"}, 422),
        ({"driver_weight_kg": "-1"}, 422),
        ({"picked_up_at": "2026-11-21T10:15:00"}, 422),  # no UTC offset
        ({"contractor_id": 999_999}, 422),
        ({"actor_id": 999_999}, 422),
    ],
)
def test_rejected_pickups_leave_nothing_behind(
    ctx: HandoffTestContext, tmp_path, fields, status_code
) -> None:
    before = ctx.handoff_count()
    bin_code = ctx.ready_bin()

    response = ctx.record(**fields)

    assert response.status_code == status_code
    assert ctx.handoff_count() == before
    assert not any(tmp_path.rglob("*.*"))
    assert ctx.bin_status(bin_code) is BinStatus.READY


def test_pickup_time_cannot_be_in_the_future(ctx: HandoffTestContext) -> None:
    soon = datetime.now(UTC) + timedelta(minutes=2)
    later = datetime.now(UTC) + timedelta(hours=1)

    assert ctx.record(picked_up_at=later.isoformat()).status_code == 422
    assert ctx.record(picked_up_at=soon.isoformat()).status_code == 201  # clock drift allowed


def test_pickup_checks_the_bin_and_the_actor_site(ctx: HandoffTestContext) -> None:
    first = ctx.ready_bin()
    assert ctx.record(first).status_code == 201
    assert ctx.record(first).status_code == 409  # the bin already has a handoff
    assert ctx.record(ctx.handed_off_bin()).status_code == 409  # already handed off
    assert ctx.record(ctx.bin_of_type(BinType.RESALE)).status_code == 409  # not a recycle bin
    second = ctx.new_ready_bin()
    assert ctx.record(second, bin_id=999_999).status_code == 404
    assert ctx.record(second, actor_id=ctx.cnx_staff_id).status_code == 403
    assert ctx.record(ctx.ready_bin("CNX"), actor_id=ctx.cnx_staff_id).status_code == 201

    with ctx.session() as session:
        contractor = session.get(Contractor, ctx.contractor_id())
        contractor.is_active = False
        session.add(contractor)
        session.commit()
    assert ctx.record(ctx.new_ready_bin()).status_code == 422


def test_only_staff_can_record_handoffs(ctx: HandoffTestContext) -> None:
    with ctx.session() as session:
        admin_id = session.exec(select(User.id).where(User.role == UserRole.ADMIN)).first()

    for actor_id in (ctx.manager_id, admin_id):
        response = ctx.record(actor_id=actor_id)
        assert response.status_code == 403
        assert response.json()["detail"] == "Only store staff can record handoffs."
    assert ctx.bin_status(ctx.ready_bin()) is BinStatus.READY


def test_failed_database_write_removes_the_saved_photo(
    ctx: HandoffTestContext, tmp_path, monkeypatch
) -> None:
    def fail(*_args, **_kwargs):
        raise ValueError("simulated database failure")

    monkeypatch.setattr(Handoff, "record_pickup_weights", fail)
    with pytest.raises(ValueError):
        ctx.record()

    assert not any(tmp_path.rglob("*.png"))


def test_disputed_handoff_needs_manager_approval_before_closing(
    ctx: HandoffTestContext,
) -> None:
    bin_code = ctx.ready_bin()
    handoff_id = ctx.record(driver_weight_kg="45.000").json()["id"]

    assert ctx.act(handoff_id, "close").status_code == 409
    assert ctx.act(handoff_id, "approve", ctx.bkk_staff_id).status_code == 422

    approved = ctx.act(handoff_id, "approve").json()
    assert approved["status"] == "approved"
    assert approved["approved_by"] == "manager.bkk@example.com"
    assert approved["approved_at"] is not None
    assert ctx.act(handoff_id, "approve").status_code == 409

    ctx.add_outcome_report(handoff_id)
    closed = ctx.act(handoff_id, "close").json()
    assert closed["status"] == "closed"
    assert closed["closed_at"] is not None
    assert ctx.bin_status(bin_code) is BinStatus.CLOSED


def test_close_rules_for_undisputed_handoffs(ctx: HandoffTestContext) -> None:
    handoff_id = ctx.record().json()["id"]

    assert ctx.act(handoff_id, "close", ctx.bkk_staff_id).status_code == 422
    assert ctx.act(handoff_id, "approve").status_code == 409
    ctx.add_outcome_report(handoff_id)
    assert ctx.act(handoff_id, "close").json()["status"] == "closed"
    assert ctx.act(handoff_id, "close").status_code == 409
    assert ctx.act(999_999, "close").status_code == 404


def test_handoff_stays_open_while_the_outcome_report_is_pending(
    ctx: HandoffTestContext,
) -> None:
    bin_code = ctx.ready_bin()
    handoff_id = ctx.record().json()["id"]

    pending = ctx.act(handoff_id, "close")

    assert pending.status_code == 409
    assert pending.json()["detail"] == (
        "The contractor's outcome report for this handoff is still pending."
    )
    assert ctx.bin_status(bin_code) is BinStatus.HANDED_OFF

    ctx.add_outcome_report(handoff_id)
    closed = ctx.act(handoff_id, "close").json()
    assert closed["status"] == "closed"
    assert closed["outcomes"]["fibre_to_fibre_weight_kg"] == 40.0
    assert ctx.bin_status(bin_code) is BinStatus.CLOSED


def test_list_returns_outcomes_and_filters_by_status_and_site(ctx: HandoffTestContext) -> None:
    with ctx.session() as session:
        closed_count = session.exec(
            select(func.count()).select_from(Handoff).where(Handoff.status == HandoffStatus.CLOSED)
        ).one()
        disputed_codes = set(
            session.exec(
                select(Bin.code)
                .join(Handoff, Handoff.bin_id == Bin.id)
                .where(Handoff.status == HandoffStatus.DISPUTED)
            ).all()
        )
    handoffs = ctx.client.get("/api/handoffs").json()["handoffs"]

    closed = [item for item in handoffs if item["status"] == "closed"]
    assert len(closed) == closed_count
    reported = next(item for item in closed if item["outcomes"] is not None)
    # Contractors categorize at most what was weighed, leaving up to 1% uncategorized.
    assert sum(reported["outcomes"].values()) <= reported["bin_weight_kg"] + 0.01
    assert set(reported["outcomes"]) == {
        "upcycled_weight_kg",
        "fibre_to_fibre_weight_kg",
        "downcycled_weight_kg",
        "exported_weight_kg",
        "landfilled_weight_kg",
        "incinerated_energy_recovery_weight_kg",
    }
    seeded = closed[0]
    assert seeded["scale_photo_url"].startswith("https://example.invalid/")
    assert ctx.client.get(f"/api/handoffs/{seeded['id']}/scale-photo").status_code == 404

    disputed = ctx.client.get("/api/handoffs", params={"status": "disputed"}).json()["handoffs"]
    assert {item["bin_code"] for item in disputed} == disputed_codes
    cnx = ctx.client.get("/api/handoffs", params={"site_id": ctx.site_id("CNX")}).json()["handoffs"]
    assert {item["site_name"] for item in cnx} == {"Chiang Mai Sorting Center"}
