from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlmodel import Session, SQLModel, create_engine, select

from app.epr import (
    add_epr_adjustment,
    get_epr_management,
    get_quarterly_report,
    lock_open_epr_quarter,
    submit_epr_quarter,
)
from app.models import ContractorReport, EprQuarterReport, EprQuarterSiteSnapshot, ReportStatus
from app.schemas import EprAdjustmentRequest, EprSubmitRequest
from seed import seed_dashboard_data


@pytest.fixture
def report_session():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed_dashboard_data(session)
        yield session
    engine.dispose()


def test_live_report_uses_intake_and_reconciles_imported_dispositions(report_session: Session):
    report = get_quarterly_report(report_session, year=2026, quarter=4)

    assert report.source == "live_records"
    assert report.total_weight_received_kg == 822
    assert report.resold_weight_kg == 248
    assert report.repaired_weight_kg == 92
    assert report.upcycled_weight_kg == 35.25
    assert report.fibre_to_fibre_weight_kg == 94
    assert report.downcycled_weight_kg == 47
    assert report.exported_weight_kg == 18.8
    assert report.landfilled_weight_kg == 11.75
    assert report.incinerated_energy_recovery_weight_kg == 28.2
    assert report.uncategorized_weight_kg == 247
    assert report.recovery_rate_percent == round(563.25 / 822 * 100, 4)

    monthly_report = report_session.exec(
        select(ContractorReport).where(ContractorReport.report_month == date(2026, 10, 1))
    ).one()
    monthly_report.status = ReportStatus.INVALID
    report_session.add(monthly_report)
    report_session.flush()
    report = get_quarterly_report(report_session, year=2026, quarter=4)
    assert report.landfilled_weight_kg == 0
    assert report.uncategorized_weight_kg == 482


def test_submitted_report_combines_saved_site_weights_before_calculating_rate(
    report_session: Session,
):
    report_id = report_session.exec(
        select(EprQuarterReport.id).where(EprQuarterReport.quarter == 3)
    ).one()
    snapshots = report_session.exec(
        select(EprQuarterSiteSnapshot).where(
            EprQuarterSiteSnapshot.epr_quarter_report_id == report_id
        )
    ).all()
    received = sum(snapshot.total_weight_received_kg for snapshot in snapshots) + Decimal("50")
    landfilled = sum(snapshot.landfilled_weight_kg for snapshot in snapshots)
    snapshots[0].total_weight_received_kg += Decimal("50")
    report_session.add(snapshots[0])
    report_session.flush()

    report = get_quarterly_report(report_session, year=2026, quarter=3)
    assert report.source == "submitted_snapshot"
    assert report.total_weight_received_kg == float(received)
    assert report.uncategorized_weight_kg == 50
    assert report.recovery_rate_percent == float(
        round((received - landfilled - 50) / received * 100, 4)
    )


def test_empty_quarter_has_zero_weights_and_rate(report_session: Session):
    report = get_quarterly_report(report_session, year=2027, quarter=1)
    assert report.total_weight_received_kg == 0
    assert report.recovery_rate_percent == 0
    assert report.garments_missing_weight == 0


def test_submit_saves_draft_totals_and_locks_all_months(report_session: Session):
    draft = get_epr_management(report_session, year=2026, quarter=4)
    actor_id = draft.actors[0].id
    result = submit_epr_quarter(EprSubmitRequest(actor_id=actor_id), report_session, 2026, 4)

    assert result.status == "submitted"
    assert result.submitted_at is not None
    assert result.submitted_by == draft.actors[0].label
    assert len(result.sites) == 2
    assert result.report.total_weight_received_kg == draft.report.total_weight_received_kg
    assert result.report.landfilled_weight_kg == draft.report.landfilled_weight_kg
    assert result.report.uncategorized_weight_kg == 247

    with pytest.raises(HTTPException, match="quarter is locked") as conflict:
        lock_open_epr_quarter(report_session, date(2026, 12, 1))
    assert conflict.value.status_code == 409
    report_session.rollback()
    with pytest.raises(HTTPException, match="quarter is locked"):
        submit_epr_quarter(EprSubmitRequest(actor_id=actor_id), report_session, 2026, 4)
    report_session.rollback()
    assert get_quarterly_report(report_session, 2026, 4) == result.report


def test_adjustment_moves_weight_between_metrics_without_rewriting_export(
    report_session: Session,
):
    draft = get_epr_management(report_session, 2026, 4)
    actor_id = draft.actors[0].id
    submitted = submit_epr_quarter(EprSubmitRequest(actor_id=actor_id), report_session, 2026, 4)
    payload = EprAdjustmentRequest.model_validate(
        {
            "actor_id": actor_id,
            "expected_latest_adjustment_id": None,
            "site_id": next(site.id for site in submitted.sites if "Bangkok" in site.label),
            "effective_date": "2026-11-19",
            "reason": "Correct contractor classification",
            "lines": [
                {"metric": "landfilled", "weight_delta_kg": "-4"},
                {"metric": "incinerated_energy_recovery", "weight_delta_kg": "4"},
            ],
        }
    )
    amended = add_epr_adjustment(payload, report_session, 2026, 4)

    assert amended.report == submitted.report
    assert get_quarterly_report(report_session, 2026, 4) == submitted.report
    assert amended.adjusted_report.landfilled_weight_kg == 7.75
    assert amended.adjusted_report.incinerated_energy_recovery_weight_kg == 32.2
    assert [row.weight_delta_kg for row in amended.adjustments] == [-4, 4]
    assert all(row.effective_date == date(2026, 11, 19) for row in amended.adjustments)

    with pytest.raises(HTTPException, match="adjustment history changed"):
        add_epr_adjustment(payload, report_session, 2026, 4)
    report_session.rollback()

    invalid = payload.model_copy(
        update={
            "expected_latest_adjustment_id": amended.adjustments[-1].id,
            "lines": [payload.lines[0].model_copy(update={"weight_delta_kg": Decimal("-100")})],
        }
    )
    with pytest.raises(HTTPException, match="weights outside the valid range"):
        add_epr_adjustment(invalid, report_session, 2026, 4)
    report_session.rollback()
    assert len(get_epr_management(report_session, 2026, 4).adjustments) == 2


def test_rejects_adjustment_before_submission(report_session: Session):
    payload = EprAdjustmentRequest.model_validate(
        {
            "actor_id": 1,
            "expected_latest_adjustment_id": None,
            "site_id": 1,
            "effective_date": "2026-11-19",
            "reason": "Correct weight",
            "lines": [{"metric": "landfilled", "weight_delta_kg": "1"}],
        }
    )
    with pytest.raises(HTTPException, match="Submit the quarter"):
        add_epr_adjustment(payload, report_session, 2026, 4)
