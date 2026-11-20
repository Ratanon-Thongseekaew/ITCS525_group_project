from datetime import UTC, date, datetime, time
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlmodel import Session, select

from .database import get_session
from .models import (
    Bin,
    ContractorReport,
    ContractorReportEntry,
    DispositionCategory,
    EprAdjustment,
    EprQuarterReport,
    EprQuarterSiteSnapshot,
    EprReportStatus,
    GarmentOutcome,
    GarmentRecord,
    ReportStatus,
    Site,
    User,
    utc_now,
)
from .schemas import (
    EprAdjustmentMetric,
    EprAdjustmentRequest,
    EprAdjustmentResponse,
    EprManagementOption,
    EprManagementResponse,
    EprQuarterReportResponse,
    EprSubmitRequest,
    UserRole,
)

router = APIRouter(prefix="/api/epr", tags=["EPR"])
ZERO = Decimal("0")
DISPOSITION_FIELDS = {category: f"{category.value}_weight_kg" for category in DispositionCategory}
METRIC_FIELDS = {
    EprAdjustmentMetric.TOTAL_RECEIVED: "total_weight_received_kg",
    **{
        metric: f"{metric.value}_weight_kg"
        for metric in EprAdjustmentMetric
        if metric is not EprAdjustmentMetric.TOTAL_RECEIVED
    },
}
WEIGHT_FIELDS = tuple(METRIC_FIELDS.values())
MANAGEMENT_ROLES = (UserRole.ADMIN, UserRole.MANAGER)
SessionDependency = Annotated[Session, Depends(get_session)]
ReportYear = Annotated[int, Query(ge=1900, le=9998)]
ReportQuarter = Annotated[int, Query(ge=1, le=4)]


def quarter_bounds(year: int, quarter: int) -> tuple[date, date]:
    return date(year, (quarter - 1) * 3 + 1, 1), date(
        year + (quarter == 4), quarter * 3 % 12 + 1, 1
    )


def get_live_site_weights(
    session: Session, year: int, quarter: int
) -> tuple[dict[int, dict[str, Decimal]], int]:
    start, end = quarter_bounds(year, quarter)
    weight = GarmentRecord.weight_kg
    garments = session.exec(
        select(
            GarmentRecord.site_id,
            func.sum(weight),
            func.sum(
                case(
                    (
                        (GarmentRecord.outcome == GarmentOutcome.RESALE)
                        & Bin.actual_value.is_not(None),
                        weight,
                    )
                )
            ),
            func.sum(case((GarmentRecord.outcome == GarmentOutcome.REPAIR_UPCYCLE, weight))),
            func.count(),
            func.count(weight),
        )
        .select_from(GarmentRecord)
        .join(Bin, Bin.id == GarmentRecord.bin_id)
        .where(
            GarmentRecord.received_at >= datetime.combine(start, time.min),
            GarmentRecord.received_at < datetime.combine(end, time.min),
        )
        .group_by(GarmentRecord.site_id)
    ).all()

    entries = session.exec(
        select(
            ContractorReport.site_id,
            ContractorReportEntry.disposition,
            func.sum(ContractorReportEntry.weight_kg),
        )
        .join(ContractorReport, ContractorReport.id == ContractorReportEntry.contractor_report_id)
        .where(
            ContractorReport.report_month >= start,
            ContractorReport.report_month < end,
            ContractorReport.status == ReportStatus.IMPORTED,
        )
        .group_by(ContractorReport.site_id, ContractorReportEntry.disposition)
    ).all()
    sites: dict[int, dict[str, Decimal]] = {}
    missing_count = 0
    for site_id, received, resold, repaired, garment_count, weighed_count in garments:
        sites[site_id] = {
            **dict.fromkeys(WEIGHT_FIELDS, ZERO),
            "total_weight_received_kg": received or ZERO,
            "resold_weight_kg": resold or ZERO,
            "repaired_weight_kg": repaired or ZERO,
        }
        missing_count += garment_count - weighed_count
    for site_id, category, total in entries:
        sites.setdefault(site_id, dict.fromkeys(WEIGHT_FIELDS, ZERO))[
            DISPOSITION_FIELDS[category]
        ] = total
    return sites, missing_count


def quarter_statement(year: int, quarter: int):
    return select(EprQuarterReport).where(
        EprQuarterReport.report_year == year, EprQuarterReport.quarter == quarter
    )


def get_submitted_weights(session: Session, report_id: int) -> dict[int, dict[str, Decimal]]:
    snapshots = session.exec(
        select(EprQuarterSiteSnapshot).where(
            EprQuarterSiteSnapshot.epr_quarter_report_id == report_id
        )
    ).all()
    if not snapshots:
        raise HTTPException(status_code=409, detail="Submitted quarter has no saved totals")
    return {
        snapshot.site_id: {field: getattr(snapshot, field) for field in WEIGHT_FIELDS}
        for snapshot in snapshots
    }


def summarize_report(
    year: int, quarter: int, sites: dict[int, dict[str, Decimal]], missing_count: int | None
) -> EprQuarterReportResponse:
    weights = {
        field: sum((weights[field] for weights in sites.values()), start=ZERO)
        for field in WEIGHT_FIELDS
    }
    received = weights["total_weight_received_kg"]
    categorized = sum((weights[field] for field in WEIGHT_FIELDS[1:]), start=ZERO)
    recovered = categorized - weights["landfilled_weight_kg"]
    return EprQuarterReportResponse(
        year=year,
        quarter=quarter,
        source="live_records" if missing_count is not None else "submitted_snapshot",
        **weights,
        uncategorized_weight_kg=max(received - categorized, ZERO),
        excess_weight_kg=max(categorized - received, ZERO),
        recovery_rate_percent=round(recovered / received * 100, 4) if received else ZERO,
        garments_missing_weight=missing_count,
    )


@router.get("/quarterly-report", response_model=EprQuarterReportResponse)
def get_quarterly_report(
    session: SessionDependency, year: ReportYear, quarter: ReportQuarter
) -> EprQuarterReportResponse:
    report = session.exec(quarter_statement(year, quarter)).one_or_none()
    if report and report.status == EprReportStatus.SUBMITTED:
        return summarize_report(year, quarter, get_submitted_weights(session, report.id), None)
    sites, missing_count = get_live_site_weights(session, year, quarter)
    return summarize_report(year, quarter, sites, missing_count)


def lock_open_epr_quarter(session: Session, report_date: date) -> EprQuarterReport:
    """Call before changing quarter inputs, in the same transaction as the write."""
    year, quarter = report_date.year, (report_date.month - 1) // 3 + 1
    table = EprQuarterReport.__table__
    now = utc_now()
    values = {
        "report_year": year,
        "quarter": quarter,
        "status": EprReportStatus.DRAFT,
        "created_at": now,
        "updated_at": now,
    }
    if session.get_bind().dialect.name == "sqlite":
        insert = sqlite_insert(table).values(**values)
        session.execute(insert.on_conflict_do_nothing(index_elements=["report_year", "quarter"]))
    else:
        insert = mysql_insert(table).values(**values)
        session.execute(insert.on_duplicate_key_update(id=table.c.id))
    report = session.exec(
        quarter_statement(year, quarter).with_for_update().execution_options(populate_existing=True)
    ).one()
    if report.status == EprReportStatus.SUBMITTED or report.locked_at is not None:
        raise HTTPException(status_code=409, detail="This quarter is locked. Add an adjustment.")
    return report


def require_management_actor(session: Session, actor_id: int) -> None:
    actor = session.get(User, actor_id)
    if actor is None or actor.role not in MANAGEMENT_ROLES:
        raise HTTPException(status_code=422, detail="Select an existing manager or admin account.")


def validate_site_weights(weights: dict[str, Decimal], site_name: str) -> None:
    received, *categorized = (weights[field] for field in WEIGHT_FIELDS)
    if any(value < ZERO or value >= Decimal("100000000000") for value in weights.values()):
        raise HTTPException(
            status_code=409, detail=f"{site_name} has weights outside the valid range."
        )
    if sum(categorized, start=ZERO) > received:
        raise HTTPException(
            status_code=409, detail=f"{site_name} has categorized weight above received weight."
        )


def utc_timestamp(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


@router.get("/quarterly-report/management", response_model=EprManagementResponse)
def get_epr_management(
    session: SessionDependency, year: ReportYear, quarter: ReportQuarter
) -> EprManagementResponse:
    quarter_report = session.exec(quarter_statement(year, quarter)).one_or_none()
    actors = [
        EprManagementOption(id=actor_id, label=username)
        for actor_id, username in session.exec(
            select(User.id, User.username)
            .where(User.role.in_(MANAGEMENT_ROLES))
            .order_by(User.username)
        ).all()
    ]
    if quarter_report is None or quarter_report.status != EprReportStatus.SUBMITTED:
        sites, missing_count = get_live_site_weights(session, year, quarter)
        return EprManagementResponse(
            report=summarize_report(year, quarter, sites, missing_count),
            status="draft",
            submitted_at=None,
            submitted_by=None,
            adjusted_report=None,
            adjustments=[],
            sites=[],
            actors=actors,
        )

    weights = get_submitted_weights(session, quarter_report.id)
    original = summarize_report(year, quarter, weights, None)
    adjustments = []
    rows = session.exec(
        select(EprAdjustment, User.username)
        .join(User, User.id == EprAdjustment.created_by_user_id)
        .where(EprAdjustment.epr_quarter_report_id == quarter_report.id)
        .order_by(EprAdjustment.id)
    ).all()
    for row, username in rows:
        # Older data may contain an adjustment for a site without a snapshot.
        weights.setdefault(row.site_id, dict.fromkeys(WEIGHT_FIELDS, ZERO))[
            METRIC_FIELDS[row.metric]
        ] += row.weight_delta_kg
        adjustments.append(
            EprAdjustmentResponse(
                id=row.id,
                site_id=row.site_id,
                metric=row.metric,
                weight_delta_kg=row.weight_delta_kg,
                effective_date=row.effective_date,
                reason=row.reason,
                created_at=utc_timestamp(row.created_at),
                recorded_by=username,
            )
        )
    sites = [
        EprManagementOption(id=site_id, label=name)
        for site_id, name in session.exec(
            select(Site.id, Site.name).where(Site.id.in_(weights)).order_by(Site.name)
        ).all()
    ]
    submitter = (
        session.get(User, quarter_report.submitted_by_user_id)
        if quarter_report.submitted_by_user_id
        else None
    )
    return EprManagementResponse(
        report=original,
        status="submitted",
        submitted_at=utc_timestamp(quarter_report.submitted_at)
        if quarter_report.submitted_at
        else None,
        submitted_by=submitter.username if submitter else None,
        adjusted_report=summarize_report(year, quarter, weights, None) if adjustments else None,
        adjustments=adjustments,
        sites=sites,
        actors=actors,
    )


@router.post("/quarterly-report/submit", response_model=EprManagementResponse)
def submit_epr_quarter(
    payload: EprSubmitRequest, session: SessionDependency, year: ReportYear, quarter: ReportQuarter
) -> EprManagementResponse:
    report = lock_open_epr_quarter(session, quarter_bounds(year, quarter)[0])
    require_management_actor(session, payload.actor_id)
    sites = session.exec(select(Site)).all()
    if not sites:
        raise HTTPException(status_code=409, detail="Set up a site before submitting a report.")

    live_weights, _ = get_live_site_weights(session, year, quarter)
    snapshots = []
    for site in sites:
        weights = live_weights.get(site.id, dict.fromkeys(WEIGHT_FIELDS, ZERO))
        validate_site_weights(weights, site.name)
        snapshot = EprQuarterSiteSnapshot(
            epr_quarter_report_id=report.id, site_id=site.id, **weights
        )
        snapshot.recalculate_recovery_rate()
        snapshots.append(snapshot)

    # Replace any legacy draft snapshots while holding the quarter lock.
    for previous in session.exec(
        select(EprQuarterSiteSnapshot).where(
            EprQuarterSiteSnapshot.epr_quarter_report_id == report.id
        )
    ).all():
        session.delete(previous)
    session.flush()
    session.add_all(snapshots)
    report.status = EprReportStatus.SUBMITTED
    report.submitted_by_user_id = payload.actor_id
    report.submitted_at = report.locked_at = utc_now()
    session.commit()
    return get_epr_management(session, year, quarter)


@router.post("/quarterly-report/adjustments", response_model=EprManagementResponse, status_code=201)
def add_epr_adjustment(
    payload: EprAdjustmentRequest,
    session: SessionDependency,
    year: ReportYear,
    quarter: ReportQuarter,
) -> EprManagementResponse:
    report = session.exec(quarter_statement(year, quarter).with_for_update()).one_or_none()
    if not report or report.status != EprReportStatus.SUBMITTED:
        raise HTTPException(status_code=409, detail="Submit the quarter before adding adjustments.")
    require_management_actor(session, payload.actor_id)
    latest_id = session.exec(
        select(func.max(EprAdjustment.id)).where(EprAdjustment.epr_quarter_report_id == report.id)
    ).one()
    if latest_id != payload.expected_latest_adjustment_id:
        raise HTTPException(
            status_code=409,
            detail="The adjustment history changed. Reopen the report and review it.",
        )
    site = session.get(Site, payload.site_id)
    site_weights = get_submitted_weights(session, report.id).get(payload.site_id)
    if site is None or site_weights is None:
        raise HTTPException(
            status_code=422, detail="Select a site included in the submitted quarter."
        )

    existing = session.exec(
        select(EprAdjustment).where(
            EprAdjustment.epr_quarter_report_id == report.id, EprAdjustment.site_id == site.id
        )
    ).all()
    for adjustment in existing:
        site_weights[METRIC_FIELDS[adjustment.metric]] += adjustment.weight_delta_kg
    for line in payload.lines:
        site_weights[METRIC_FIELDS[line.metric]] += line.weight_delta_kg
    validate_site_weights(site_weights, site.name)

    created_at = utc_now()
    session.add_all(
        [
            EprAdjustment(
                epr_quarter_report_id=report.id,
                site_id=site.id,
                metric=line.metric,
                weight_delta_kg=line.weight_delta_kg,
                reason=payload.reason,
                effective_date=payload.effective_date,
                created_by_user_id=payload.actor_id,
                created_at=created_at,
            )
            for line in payload.lines
        ]
    )
    session.commit()
    return get_epr_management(session, year, quarter)
