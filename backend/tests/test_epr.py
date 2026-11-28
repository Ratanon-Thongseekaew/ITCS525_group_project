from datetime import date, datetime, time
from decimal import Decimal

import pytest
from auth_helpers import bearer, demo_user_id
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.database import get_session
from app.epr import (
    add_epr_adjustment,
    get_epr_management,
    get_quarterly_report,
    lock_open_epr_quarter,
    submit_epr_quarter,
)
from app.main import app
from app.models import (
    Bin,
    ContractorReport,
    ContractorReportEntry,
    DispositionCategory,
    EprQuarterReport,
    EprQuarterSiteSnapshot,
    EprReportStatus,
    GarmentOutcome,
    GarmentRecord,
    ReportStatus,
    Site,
    User,
)
from app.schemas import EprAdjustmentRequest, UserRole

# With the demo seed pinned to 2026-11-27, Q4 2026 (Oct to Nov) is the open draft quarter and
# Q3 2026 is the latest submitted one.
OPEN = (2026, 4)
SUBMITTED = (2026, 3)


@pytest.fixture
def report_session(demo_engine):
    with Session(demo_engine) as session:
        yield session


def first_manager(session: Session) -> User:
    """The first manager or admin by username, the account the old EPR actor picker listed first."""

    return session.exec(
        select(User)
        .where(User.role.in_((UserRole.ADMIN, UserRole.MANAGER)))
        .order_by(User.username)
    ).first()


def expected_live_totals(session: Session, start: date, end: date) -> dict[str, Decimal]:
    """Quarter totals computed straight from the seeded rows."""

    received_from = datetime.combine(start, time.min)
    received_to = datetime.combine(end, time.min)
    totals = {"received": Decimal(0), "resold": Decimal(0), "repaired": Decimal(0)}
    for garment, bin_record in session.exec(
        select(GarmentRecord, Bin).join(Bin, Bin.id == GarmentRecord.bin_id)
    ).all():
        if not received_from <= garment.received_at.replace(tzinfo=None) < received_to:
            continue
        totals["received"] += garment.weight_kg
        if garment.outcome is GarmentOutcome.RESALE and bin_record.actual_value is not None:
            totals["resold"] += garment.weight_kg
        if garment.outcome is GarmentOutcome.REPAIR_UPCYCLE:
            totals["repaired"] += garment.weight_kg
    for category in DispositionCategory:
        totals[category.value] = Decimal(0)
    for entry, report in session.exec(
        select(ContractorReportEntry, ContractorReport).join(
            ContractorReport, ContractorReport.id == ContractorReportEntry.contractor_report_id
        )
    ).all():
        if start <= report.report_month < end and report.status is ReportStatus.IMPORTED:
            totals[entry.disposition.value] += entry.weight_kg
    return totals


def test_live_report_uses_intake_and_reconciles_imported_dispositions(report_session: Session):
    expected = expected_live_totals(report_session, date(2026, 10, 1), date(2027, 1, 1))
    report = get_quarterly_report(report_session, *OPEN)

    assert report.source == "live_records"
    assert report.total_weight_received_kg == pytest.approx(float(expected["received"]))
    assert report.resold_weight_kg == pytest.approx(float(expected["resold"]))
    assert report.repaired_weight_kg == pytest.approx(float(expected["repaired"]))
    for category in DispositionCategory:
        assert getattr(report, f"{category.value}_weight_kg") == pytest.approx(
            float(expected[category.value])
        )
    categorized = sum(value for key, value in expected.items() if key != "received")
    assert report.uncategorized_weight_kg == pytest.approx(
        float(expected["received"] - categorized)
    )

    # Reports that aren't imported don't count.
    october = report_session.exec(
        select(ContractorReport)
        .join(Site, Site.id == ContractorReport.site_id)
        .where(ContractorReport.report_month == date(2026, 10, 1), Site.code == "CNX")
    ).one()
    october_landfilled = report_session.exec(
        select(ContractorReportEntry.weight_kg).where(
            ContractorReportEntry.contractor_report_id == october.id,
            ContractorReportEntry.disposition == DispositionCategory.LANDFILLED,
        )
    ).all()
    october.status = ReportStatus.INVALID
    report_session.add(october)
    report_session.flush()
    report = get_quarterly_report(report_session, *OPEN)
    assert report.landfilled_weight_kg == pytest.approx(
        float(expected["landfilled"] - sum(october_landfilled))
    )


def test_the_demo_seed_submits_past_quarters_and_leaves_last_month_open(report_session: Session):
    statuses = {
        (report.report_year, report.quarter): report.status
        for report in report_session.exec(select(EprQuarterReport)).all()
    }

    assert statuses == {
        (2025, 4): EprReportStatus.SUBMITTED,
        (2026, 1): EprReportStatus.SUBMITTED,
        (2026, 2): EprReportStatus.SUBMITTED,
        (2026, 3): EprReportStatus.SUBMITTED,
    }
    assert len(get_epr_management(report_session, *SUBMITTED).adjustments) == 1
    lock_open_epr_quarter(report_session, date(2026, 10, 1))  # last month's quarter is open


def test_submitted_report_combines_saved_site_weights_before_calculating_rate(
    report_session: Session,
):
    report_id = report_session.exec(
        select(EprQuarterReport.id).where(
            EprQuarterReport.report_year == SUBMITTED[0], EprQuarterReport.quarter == SUBMITTED[1]
        )
    ).one()
    snapshots = report_session.exec(
        select(EprQuarterSiteSnapshot).where(
            EprQuarterSiteSnapshot.epr_quarter_report_id == report_id
        )
    ).all()
    before = get_quarterly_report(report_session, *SUBMITTED)
    received = sum(snapshot.total_weight_received_kg for snapshot in snapshots) + Decimal("50")
    landfilled = sum(snapshot.landfilled_weight_kg for snapshot in snapshots)
    snapshots[0].total_weight_received_kg += Decimal("50")
    report_session.add(snapshots[0])
    report_session.flush()

    report = get_quarterly_report(report_session, *SUBMITTED)
    assert report.source == "submitted_snapshot"
    assert report.total_weight_received_kg == pytest.approx(float(received))
    assert report.uncategorized_weight_kg == pytest.approx(before.uncategorized_weight_kg + 50)
    assert report.recovery_rate_percent == pytest.approx(
        float(
            (received - landfilled - Decimal(str(report.uncategorized_weight_kg))) / received * 100
        ),
        abs=0.001,
    )


def test_empty_quarter_has_zero_weights_and_rate(report_session: Session):
    report = get_quarterly_report(report_session, year=2027, quarter=2)
    assert report.total_weight_received_kg == 0
    assert report.recovery_rate_percent == 0
    assert report.garments_missing_weight == 0


def test_submit_saves_draft_totals_and_locks_all_months(report_session: Session):
    draft = get_epr_management(report_session, *OPEN)
    actor = first_manager(report_session)
    result = submit_epr_quarter(actor, report_session, *OPEN)

    assert result.status == "submitted"
    assert result.submitted_at is not None
    assert result.submitted_by == actor.username
    assert len(result.sites) == 5
    assert result.report.total_weight_received_kg == draft.report.total_weight_received_kg
    assert result.report.landfilled_weight_kg == draft.report.landfilled_weight_kg
    assert result.report.uncategorized_weight_kg == draft.report.uncategorized_weight_kg

    with pytest.raises(HTTPException, match="quarter is locked") as conflict:
        lock_open_epr_quarter(report_session, date(2026, 12, 1))
    assert conflict.value.status_code == 409
    report_session.rollback()
    with pytest.raises(HTTPException, match="quarter is locked"):
        submit_epr_quarter(actor, report_session, *OPEN)
    report_session.rollback()
    assert get_quarterly_report(report_session, *OPEN) == result.report


def test_adjustment_moves_weight_between_metrics_without_rewriting_export(
    report_session: Session,
):
    actor = first_manager(report_session)
    submitted = submit_epr_quarter(actor, report_session, *OPEN)
    payload = EprAdjustmentRequest.model_validate(
        {
            "expected_latest_adjustment_id": None,
            # Chiang Mai's October report is imported, so it has landfill weight to move.
            "site_id": next(site.id for site in submitted.sites if "Chiang Mai" in site.label),
            "effective_date": "2026-11-19",
            "reason": "Correct contractor classification",
            "lines": [
                {"metric": "landfilled", "weight_delta_kg": "-1"},
                {"metric": "incinerated_energy_recovery", "weight_delta_kg": "1"},
            ],
        }
    )
    amended = add_epr_adjustment(payload, actor, report_session, *OPEN)

    assert amended.report == submitted.report
    assert get_quarterly_report(report_session, *OPEN) == submitted.report
    assert amended.adjusted_report.landfilled_weight_kg == pytest.approx(
        submitted.report.landfilled_weight_kg - 1
    )
    assert amended.adjusted_report.incinerated_energy_recovery_weight_kg == pytest.approx(
        submitted.report.incinerated_energy_recovery_weight_kg + 1
    )
    assert [row.weight_delta_kg for row in amended.adjustments] == [-1, 1]
    assert all(row.effective_date == date(2026, 11, 19) for row in amended.adjustments)

    with pytest.raises(HTTPException, match="adjustment history changed"):
        add_epr_adjustment(payload, actor, report_session, *OPEN)
    report_session.rollback()

    invalid = payload.model_copy(
        update={
            "expected_latest_adjustment_id": amended.adjustments[-1].id,
            "lines": [payload.lines[0].model_copy(update={"weight_delta_kg": Decimal("-100")})],
        }
    )
    with pytest.raises(HTTPException, match="weights outside the valid range"):
        add_epr_adjustment(invalid, actor, report_session, *OPEN)
    report_session.rollback()
    assert len(get_epr_management(report_session, *OPEN).adjustments) == 2


def test_rejects_adjustment_before_submission(report_session: Session):
    actor = first_manager(report_session)
    payload = EprAdjustmentRequest.model_validate(
        {
            "expected_latest_adjustment_id": None,
            "site_id": 1,
            "effective_date": "2026-11-19",
            "reason": "Correct weight",
            "lines": [{"metric": "landfilled", "weight_delta_kg": "1"}],
        }
    )
    with pytest.raises(HTTPException, match="Submit the quarter"):
        add_epr_adjustment(payload, actor, report_session, *OPEN)


@pytest.fixture
def epr_http(demo_engine):
    def override_session():
        with Session(demo_engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as client:
        yield client, demo_engine
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/epr/quarterly-report"),
        ("get", "/api/epr/quarterly-report/management"),
        ("post", "/api/epr/quarterly-report/submit"),
        ("post", "/api/epr/quarterly-report/adjustments"),
    ],
)
def test_epr_routes_require_a_manager_or_admin_token(epr_http, method, path):
    client, engine = epr_http
    params = {"year": OPEN[0], "quarter": OPEN[1]}
    staff = bearer(demo_user_id(engine, "staff.bkk@example.com"))

    assert client.request(method, path, params=params).status_code == 401
    assert client.request(method, path, params=params, headers=staff).status_code == 403


def test_submit_records_the_signed_in_manager_not_a_chosen_account(epr_http):
    client, engine = epr_http
    manager = bearer(demo_user_id(engine, "manager.cnx@example.com"))
    params = {"year": OPEN[0], "quarter": OPEN[1]}

    management = client.get("/api/epr/quarterly-report/management", params=params, headers=manager)
    assert management.status_code == 200
    assert "actors" not in management.json()

    # An old client still sending actor_id can't choose who is recorded.
    admin_id = demo_user_id(engine, "admin@example.com")
    submitted = client.post(
        "/api/epr/quarterly-report/submit",
        params=params,
        json={"actor_id": admin_id},
        headers=manager,
    )
    assert submitted.status_code == 200
    assert submitted.json()["submitted_by"] == "manager.cnx@example.com"
