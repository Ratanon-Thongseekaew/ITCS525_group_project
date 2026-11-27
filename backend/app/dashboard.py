from __future__ import annotations

from calendar import month_abbr, month_name
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from .database import get_session
from .models import (
    Bin,
    Contractor,
    ContractorReport,
    ContractorReportEntry,
    DispositionCategory,
    GarmentRecord,
    Handoff,
    HandoffStatus,
    Site,
)
from .schemas import (
    DashboardContractorOption,
    DashboardException,
    DashboardExceptionStatus,
    DashboardFilterOptions,
    DashboardFrequency,
    DashboardMonthlyOutcome,
    DashboardOutcome,
    DashboardResponse,
    DashboardSiteOption,
    DashboardSummary,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])
SessionDependency = Annotated[Session, Depends(get_session)]

DISPOSITIONS = tuple(DispositionCategory)


def _next_month(year: int, month: int) -> tuple[int, int]:
    return (year + 1, 1) if month == 12 else (year, month + 1)


def _period_bounds(
    frequency: DashboardFrequency,
    year: int,
    month: int | None,
    quarter: int | None,
) -> tuple[datetime, datetime, int | None, int | None, str]:
    if frequency is DashboardFrequency.MONTHLY:
        selected_month = month or date.today().month
        next_year, next_month = _next_month(year, selected_month)
        return (
            datetime(year, selected_month, 1),
            datetime(next_year, next_month, 1),
            selected_month,
            None,
            f"{month_name[selected_month]} {year}",
        )

    if frequency is DashboardFrequency.QUARTERLY:
        selected_quarter = quarter or ((date.today().month - 1) // 3 + 1)
        start_month = (selected_quarter - 1) * 3 + 1
        end_year, end_month = year, start_month + 3
        if end_month > 12:
            end_year, end_month = year + 1, end_month - 12
        return (
            datetime(year, start_month, 1),
            datetime(end_year, end_month, 1),
            None,
            selected_quarter,
            f"Q{selected_quarter} {year}",
        )

    return (
        datetime(year, 1, 1),
        datetime(year + 1, 1, 1),
        None,
        None,
        str(year),
    )


def _to_float(value: Decimal | int | float | None) -> float:
    return round(float(value or 0), 3)


def _filter_options(session: Session, selected_year: int) -> DashboardFilterOptions:
    sites = session.exec(select(Site).where(Site.is_active).order_by(Site.name)).all()
    # Inactive contractors stay listed (after the active ones) so their history can be filtered.
    contractors = session.exec(
        select(Contractor).order_by(Contractor.is_active.desc(), Contractor.name)
    ).all()

    years = {selected_year}
    for report_month in session.exec(select(ContractorReport.report_month)).all():
        years.add(report_month.year)
    for received_at in session.exec(select(GarmentRecord.received_at)).all():
        years.add(received_at.year)

    return DashboardFilterOptions(
        sites=[DashboardSiteOption(id=site.id, code=site.code, name=site.name) for site in sites],
        contractors=[
            DashboardContractorOption(
                id=contractor.id, name=contractor.name, is_active=contractor.is_active
            )
            for contractor in contractors
        ],
        available_years=sorted(years, reverse=True),
    )


def build_dashboard(
    session: Session,
    *,
    frequency: DashboardFrequency,
    year: int,
    month: int | None,
    quarter: int | None,
    site_id: int | None,
    contractor_id: int | None,
) -> DashboardResponse:
    if site_id is not None and session.get(Site, site_id) is None:
        raise HTTPException(status_code=404, detail="Site not found")
    if contractor_id is not None and session.get(Contractor, contractor_id) is None:
        raise HTTPException(status_code=404, detail="Contractor not found")

    start, end, selected_month, selected_quarter, period_label = _period_bounds(
        frequency, year, month, quarter
    )

    handoff_statement = (
        select(Handoff, Bin, Contractor)
        .join(Bin, Handoff.bin_id == Bin.id)
        .join(Contractor, Handoff.contractor_id == Contractor.id)
        .where(Handoff.picked_up_at >= start, Handoff.picked_up_at < end)
    )
    if site_id is not None:
        handoff_statement = handoff_statement.where(Handoff.site_id == site_id)
    if contractor_id is not None:
        handoff_statement = handoff_statement.where(Handoff.contractor_id == contractor_id)
    handoff_rows = session.exec(handoff_statement.order_by(Handoff.picked_up_at.desc())).all()

    report_start = start.date()
    report_end = end.date()
    entry_statement = (
        select(ContractorReportEntry, ContractorReport)
        .join(
            ContractorReport,
            ContractorReportEntry.contractor_report_id == ContractorReport.id,
        )
        .where(
            ContractorReport.report_month >= report_start,
            ContractorReport.report_month < report_end,
        )
    )
    if site_id is not None:
        entry_statement = entry_statement.where(ContractorReport.site_id == site_id)
    if contractor_id is not None:
        entry_statement = entry_statement.where(ContractorReport.contractor_id == contractor_id)
    entry_rows = session.exec(entry_statement).all()

    outcome_weights = {category: Decimal("0") for category in DISPOSITIONS}
    reported_handoff_ids: set[int] = set()
    for entry, _report in entry_rows:
        outcome_weights[entry.disposition] += entry.weight_kg
        reported_handoff_ids.add(entry.handoff_id)

    selected_handoff_ids = {handoff.id for handoff, _bin, _contractor in handoff_rows}
    reported_selected_ids = selected_handoff_ids & reported_handoff_ids
    recorded_weight = sum(
        (handoff.staff_weight_kg or Decimal("0") for handoff, _bin, _contractor in handoff_rows),
        start=Decimal("0"),
    )
    reported_weight = sum(outcome_weights.values(), start=Decimal("0"))
    landfilled_weight = outcome_weights[DispositionCategory.LANDFILLED]
    diverted_weight = max(Decimal("0"), reported_weight - landfilled_weight)
    recovery_rate = (
        diverted_weight / reported_weight * Decimal("100") if reported_weight else Decimal("0")
    )

    outcomes = [
        DashboardOutcome(
            category=category.value,
            weight_kg=_to_float(outcome_weights[category]),
            percentage=_to_float(
                outcome_weights[category] / reported_weight * Decimal("100")
                if reported_weight
                else Decimal("0")
            ),
        )
        for category in DISPOSITIONS
    ]

    trend_start = date(year, 1, 1)
    trend_end = date(year + 1, 1, 1)
    trend_statement = (
        select(ContractorReportEntry, ContractorReport)
        .join(
            ContractorReport,
            ContractorReportEntry.contractor_report_id == ContractorReport.id,
        )
        .where(
            ContractorReport.report_month >= trend_start,
            ContractorReport.report_month < trend_end,
        )
    )
    if site_id is not None:
        trend_statement = trend_statement.where(ContractorReport.site_id == site_id)
    if contractor_id is not None:
        trend_statement = trend_statement.where(ContractorReport.contractor_id == contractor_id)

    monthly_weights: dict[int, dict[DispositionCategory, Decimal]] = defaultdict(
        lambda: {category: Decimal("0") for category in DISPOSITIONS}
    )
    for entry, report in session.exec(trend_statement).all():
        monthly_weights[report.report_month.month][entry.disposition] += entry.weight_kg

    monthly_outcomes = [
        DashboardMonthlyOutcome(
            month=month_number,
            month_label=month_abbr[month_number],
            upcycled=_to_float(weights[DispositionCategory.UPCYCLED]),
            fibre_to_fibre=_to_float(weights[DispositionCategory.FIBRE_TO_FIBRE]),
            downcycled=_to_float(weights[DispositionCategory.DOWNCYCLED]),
            exported=_to_float(weights[DispositionCategory.EXPORTED]),
            landfilled=_to_float(weights[DispositionCategory.LANDFILLED]),
            incinerated_energy_recovery=_to_float(
                weights[DispositionCategory.INCINERATED_ENERGY_RECOVERY]
            ),
        )
        for month_number, weights in sorted(monthly_weights.items())
    ]

    exceptions = []
    for handoff, bin_record, contractor in handoff_rows:
        is_disputed = handoff.status is HandoffStatus.DISPUTED
        has_report = handoff.id in reported_handoff_ids
        if not is_disputed and has_report:
            continue
        exceptions.append(
            DashboardException(
                handoff_id=handoff.id,
                bin_code=bin_record.code,
                contractor_name=contractor.name,
                handoff_date=handoff.picked_up_at,
                item_count=bin_record.item_count,
                staff_weight_kg=_to_float(handoff.staff_weight_kg),
                driver_weight_kg=_to_float(handoff.driver_weight_kg),
                variance_percent=_to_float(handoff.weight_variance_percent),
                has_contractor_report=has_report,
                status=(
                    DashboardExceptionStatus.DISPUTED
                    if is_disputed
                    else DashboardExceptionStatus.PENDING
                ),
            )
        )

    return DashboardResponse(
        frequency=frequency,
        year=year,
        month=selected_month,
        quarter=selected_quarter,
        period_label=period_label,
        summary=DashboardSummary(
            recycling_bins_collected=len(handoff_rows),
            recycling_bins_reported=len(reported_selected_ids),
            pending_bins=len(selected_handoff_ids - reported_selected_ids),
            disputed_handoffs=sum(
                handoff.status is HandoffStatus.DISPUTED
                for handoff, _bin, _contractor in handoff_rows
            ),
            recovery_rate=_to_float(recovery_rate),
            diverted_weight_kg=_to_float(diverted_weight),
            total_recorded_weight_kg=_to_float(recorded_weight),
            total_reported_weight_kg=_to_float(reported_weight),
            weight_variance_kg=_to_float(reported_weight - recorded_weight),
        ),
        outcomes=outcomes,
        monthly_outcomes=monthly_outcomes,
        exceptions=exceptions,
        filters=_filter_options(session, year),
    )


@router.get("", response_model=DashboardResponse)
def get_dashboard(
    session: SessionDependency,
    frequency: DashboardFrequency = Query(default=DashboardFrequency.MONTHLY),
    year: int = Query(default_factory=lambda: date.today().year, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    quarter: int | None = Query(default=None, ge=1, le=4),
    site_id: int | None = Query(default=None, ge=1),
    contractor_id: int | None = Query(default=None, ge=1),
) -> DashboardResponse:
    return build_dashboard(
        session,
        frequency=frequency,
        year=year,
        month=month,
        quarter=quarter,
        site_id=site_id,
        contractor_id=contractor_id,
    )
