from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, func, select
from sqlmodel.pool import StaticPool

from app.database import get_session
from app.main import app
from app.models import (
    Bin,
    BinStatus,
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
from seed import seed_development_data

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

    def contractor_id(self) -> int:
        with self.session() as session:
            return session.exec(select(Contractor.id).order_by(Contractor.id)).first()

    def handoff_count(self) -> int:
        with self.session() as session:
            return session.exec(select(func.count()).select_from(Handoff)).one()

    @property
    def manager_id(self) -> int:
        return self.user_id("dashboard.manager@example.invalid")

    @property
    def bkk_staff_id(self) -> int:
        return self.user_id("dashboard.staff.bkk@example.invalid")

    @property
    def cnx_staff_id(self) -> int:
        return self.user_id("dashboard.staff.cnx@example.invalid")

    def record(self, bin_code: str = "HAND-BKK-READY-01", *, photo=DEFAULT_PHOTO, **fields):
        data = {
            "bin_id": str(self.bin_id(bin_code)),
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
def ctx(tmp_path, monkeypatch) -> Iterator[HandoffTestContext]:
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
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
            yield HandoffTestContext(client=client, engine=engine)
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_schema_status_mirrors_model_status() -> None:
    assert [status.value for status in HandoffRecordStatus] == [
        status.value for status in HandoffStatus
    ]


def test_seed_is_idempotent_and_has_no_scheduled_handoffs(ctx: HandoffTestContext) -> None:
    def counts() -> tuple[int, int]:
        with ctx.session() as session:
            return session.exec(select(func.count()).select_from(Bin)).one(), ctx.handoff_count()

    before = counts()
    with ctx.session() as session:
        seed_development_data(session)
        scheduled = session.exec(
            select(Handoff).where(Handoff.status == HandoffStatus.SCHEDULED)
        ).all()
    assert counts() == before
    assert scheduled == []


def test_seeded_picked_up_handoffs_follow_the_three_percent_rule(ctx: HandoffTestContext) -> None:
    with ctx.session() as session:
        statuses = dict(
            session.exec(
                select(Bin.code, Handoff.status)
                .join(Handoff, Handoff.bin_id == Bin.id)
                .where(Bin.code.like("HAND-%"))
            ).all()
        )
    assert statuses == {
        "HAND-BKK-PICKED-01": HandoffStatus.DISPUTED,
        "HAND-CNX-PICKED-01": HandoffStatus.PICKED_UP,
    }


def test_scheduling_endpoints_are_gone(ctx: HandoffTestContext) -> None:
    assert ctx.client.post("/api/handoffs", json={}).status_code == 405
    assert ctx.client.post("/api/handoffs/1/pickup", data={}).status_code == 404


def test_options_list_sites_contractors_and_actor_memberships(ctx: HandoffTestContext) -> None:
    body = ctx.client.get("/api/handoffs/options").json()

    assert [site["name"] for site in body["sites"]] == [
        "Bangkok Sorting Center",
        "Chiang Mai Sorting Center",
    ]
    assert len(body["contractors"]) == 2
    staff = next(actor for actor in body["actors"] if actor["id"] == ctx.bkk_staff_id)
    assert staff["role"] == "staff"
    assert staff["site_ids"] == [ctx.site_id("DASH-BKK")]


def test_ready_bins_are_ready_recycle_bins_without_a_handoff(ctx: HandoffTestContext) -> None:
    bins = ctx.client.get("/api/handoffs/bins").json()["bins"]

    assert sorted(item["code"] for item in bins) == [
        f"HAND-{site}-READY-0{number}" for site in ("BKK", "CNX") for number in (1, 2, 3)
    ]
    site_bins = ctx.client.get(
        "/api/handoffs/bins", params={"site_id": ctx.site_id("DASH-CNX")}
    ).json()["bins"]
    assert {item["site_name"] for item in site_bins} == {"Chiang Mai Sorting Center"}


def test_pickup_within_three_percent_records_all_evidence(ctx: HandoffTestContext) -> None:
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
    assert record["created_by"] == "dashboard.staff.bkk@example.invalid"
    assert record["scale_photo_url"] == f"/api/handoffs/{record['id']}/scale-photo"
    assert ctx.bin_status("HAND-BKK-READY-01") is BinStatus.HANDED_OFF
    codes = [item["code"] for item in ctx.client.get("/api/handoffs/bins").json()["bins"]]
    assert "HAND-BKK-READY-01" not in codes

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

    response = ctx.record(**fields)

    assert response.status_code == status_code
    assert ctx.handoff_count() == before
    assert not any(tmp_path.rglob("*.*"))
    assert ctx.bin_status("HAND-BKK-READY-01") is BinStatus.READY


def test_pickup_time_cannot_be_in_the_future(ctx: HandoffTestContext) -> None:
    soon = datetime.now(UTC) + timedelta(minutes=2)
    later = datetime.now(UTC) + timedelta(hours=1)

    assert ctx.record(picked_up_at=later.isoformat()).status_code == 422
    assert ctx.record(picked_up_at=soon.isoformat()).status_code == 201  # clock drift allowed


def test_pickup_checks_the_bin_and_the_actor_site(ctx: HandoffTestContext) -> None:
    assert ctx.record().status_code == 201
    assert ctx.record().status_code == 409  # the bin already has a handoff
    assert ctx.record("HAND-BKK-PICKED-01").status_code == 409  # already handed off
    assert ctx.record("DASH-BKK-2026-01-RESALE").status_code == 409  # not a recycle bin
    assert ctx.record("HAND-BKK-READY-02", bin_id=999_999).status_code == 404
    assert ctx.record("HAND-BKK-READY-02", actor_id=ctx.cnx_staff_id).status_code == 403
    assert ctx.record("HAND-CNX-READY-01", actor_id=ctx.cnx_staff_id).status_code == 201

    with ctx.session() as session:
        contractor = session.get(Contractor, ctx.contractor_id())
        contractor.is_active = False
        session.add(contractor)
        session.commit()
    assert ctx.record("HAND-BKK-READY-03").status_code == 422


def test_only_staff_can_record_handoffs(ctx: HandoffTestContext) -> None:
    with ctx.session() as session:
        admin = User(username="admin@example.invalid", password_hash="x", role=UserRole.ADMIN)
        session.add(admin)
        session.commit()
        admin_id = admin.id

    for actor_id in (ctx.manager_id, admin_id):
        response = ctx.record(actor_id=actor_id)
        assert response.status_code == 403
        assert response.json()["detail"] == "Only store staff can record handoffs."
    assert ctx.bin_status("HAND-BKK-READY-01") is BinStatus.READY


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
    handoff_id = ctx.record(driver_weight_kg="45.000").json()["id"]

    assert ctx.act(handoff_id, "close").status_code == 409
    assert ctx.act(handoff_id, "approve", ctx.bkk_staff_id).status_code == 422

    approved = ctx.act(handoff_id, "approve").json()
    assert approved["status"] == "approved"
    assert approved["approved_by"] == "dashboard.manager@example.invalid"
    assert approved["approved_at"] is not None
    assert ctx.act(handoff_id, "approve").status_code == 409

    ctx.add_outcome_report(handoff_id)
    closed = ctx.act(handoff_id, "close").json()
    assert closed["status"] == "closed"
    assert closed["closed_at"] is not None
    assert ctx.bin_status("HAND-BKK-READY-01") is BinStatus.CLOSED


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
    handoff_id = ctx.record().json()["id"]

    pending = ctx.act(handoff_id, "close")

    assert pending.status_code == 409
    assert pending.json()["detail"] == (
        "The contractor's outcome report for this handoff is still pending."
    )
    assert ctx.bin_status("HAND-BKK-READY-01") is BinStatus.HANDED_OFF

    ctx.add_outcome_report(handoff_id)
    closed = ctx.act(handoff_id, "close").json()
    assert closed["status"] == "closed"
    assert closed["outcomes"]["fibre_to_fibre_weight_kg"] == 40.0
    assert ctx.bin_status("HAND-BKK-READY-01") is BinStatus.CLOSED


def test_list_returns_outcomes_and_filters_by_status_and_site(ctx: HandoffTestContext) -> None:
    handoffs = ctx.client.get("/api/handoffs").json()["handoffs"]

    closed = [item for item in handoffs if item["status"] == "closed"]
    assert len(closed) == 19
    reported = next(item for item in closed if item["outcomes"] is not None)
    assert sum(reported["outcomes"].values()) == pytest.approx(reported["bin_weight_kg"], abs=0.01)
    assert set(reported["outcomes"]) == {
        "upcycled_weight_kg",
        "fibre_to_fibre_weight_kg",
        "downcycled_weight_kg",
        "exported_weight_kg",
        "landfilled_weight_kg",
        "incinerated_energy_recovery_weight_kg",
    }
    seeded = next(item for item in handoffs if item["bin_code"] == "HAND-BKK-PICKED-01")
    assert seeded["scale_photo_url"].startswith("https://example.invalid/")
    assert ctx.client.get(f"/api/handoffs/{seeded['id']}/scale-photo").status_code == 404

    disputed = ctx.client.get("/api/handoffs", params={"status": "disputed"}).json()["handoffs"]
    assert {item["bin_code"] for item in disputed} == {
        "DASH-BKK-2026-10-RECYCLE",
        "HAND-BKK-PICKED-01",
    }
    cnx = ctx.client.get("/api/handoffs", params={"site_id": ctx.site_id("DASH-CNX")}).json()[
        "handoffs"
    ]
    assert {item["site_name"] for item in cnx} == {"Chiang Mai Sorting Center"}
