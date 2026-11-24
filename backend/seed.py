"""Seed deterministic development data for the compliance dashboard and recycle bin handoff.

Run from the repository root after applying migrations:

    python backend/seed.py

The seed is additive and idempotent. It never deletes existing records. Dashboard
records use the ``DASH-`` prefix; recycle bin handoff records use ``HAND-``.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlmodel import Session, select

from app.database import get_engine
from app.models import (
    Bin,
    BinStatus,
    BinType,
    Contractor,
    ContractorReport,
    ContractorReportEntry,
    DispositionCategory,
    EprAdjustment,
    EprAdjustmentMetric,
    EprQuarterReport,
    EprQuarterSiteSnapshot,
    EprReportStatus,
    EvidenceStatus,
    GarmentOutcome,
    GarmentRecord,
    Handoff,
    HandoffStatus,
    ReportStatus,
    Site,
    User,
    UserSite,
)
from app.schemas import UserRole

SEED_YEAR = 2026
SEED_PASSWORD_HASH = "dashboard-seed-not-for-authentication"

SITE_DEFINITIONS = (
    ("DASH-BKK", "Bangkok Sorting Center"),
    ("DASH-CNX", "Chiang Mai Sorting Center"),
)

CONTRACTOR_DEFINITIONS = (
    ("Dashboard GreenLoop Recycling", "Narin Chai", "narin@example.invalid"),
    ("Dashboard Circular Fibre Co.", "Mali Arun", "mali@example.invalid"),
)

DISPOSITION_SHARES = (
    (DispositionCategory.UPCYCLED, Decimal("0.15")),
    (DispositionCategory.FIBRE_TO_FIBRE, Decimal("0.40")),
    (DispositionCategory.DOWNCYCLED, Decimal("0.20")),
    (DispositionCategory.EXPORTED, Decimal("0.08")),
    (DispositionCategory.LANDFILLED, Decimal("0.05")),
    (DispositionCategory.INCINERATED_ENERGY_RECOVERY, Decimal("0.12")),
)


def _disposition_weights(recycling_weight: Decimal) -> list[tuple[DispositionCategory, Decimal]]:
    weights: list[tuple[DispositionCategory, Decimal]] = []
    allocated = Decimal("0")
    for index, (category, share) in enumerate(DISPOSITION_SHARES):
        if index == len(DISPOSITION_SHARES) - 1:
            weight = recycling_weight - allocated
        else:
            weight = (recycling_weight * share).quantize(Decimal("0.001"))
            allocated += weight
        weights.append((category, weight))
    return weights


def _month_end(month: int) -> datetime:
    day = monthrange(SEED_YEAR, month)[1]
    return datetime(SEED_YEAR, month, day, 10, 0, tzinfo=UTC)


def _weights(month: int, site_index: int) -> tuple[Decimal, Decimal, Decimal]:
    """Return resale, repair, and recycling weights for one site-month."""

    site_offset = Decimal(site_index * 12)
    return (
        Decimal(88 + month * 3) + site_offset,
        Decimal(24 + month * 2) + site_offset / 3,
        Decimal(165 + month * 7) + site_offset,
    )


def _get_or_create_site(session: Session, code: str, name: str) -> Site:
    site = session.exec(select(Site).where(Site.code == code)).one_or_none()
    if site is None:
        site = Site(code=code, name=name)
        session.add(site)
        session.flush()
    return site


def _get_or_create_user(session: Session, username: str, role: UserRole) -> User:
    user = session.exec(select(User).where(User.username == username)).one_or_none()
    if user is None:
        user = User(username=username, password_hash=SEED_PASSWORD_HASH, role=role)
        session.add(user)
        session.flush()
    return user


def _ensure_membership(session: Session, user: User, site: Site, *, default: bool) -> None:
    membership = session.exec(
        select(UserSite).where(UserSite.user_id == user.id, UserSite.site_id == site.id)
    ).one_or_none()
    if membership is None:
        session.add(UserSite(user_id=user.id, site_id=site.id, is_default=default))


def _get_or_create_contractor(
    session: Session,
    name: str,
    contact_name: str,
    contact_email: str,
) -> Contractor:
    contractor = session.exec(select(Contractor).where(Contractor.name == name)).one_or_none()
    if contractor is None:
        contractor = Contractor(
            name=name,
            contact_name=contact_name,
            contact_email=contact_email,
        )
        session.add(contractor)
        session.flush()
    return contractor


def _get_or_create_bin(
    session: Session,
    *,
    site: Site,
    code: str,
    bin_type: BinType,
    weight: Decimal,
    item_count: int,
    closed_at: datetime,
) -> Bin:
    bin_record = session.exec(
        select(Bin).where(Bin.site_id == site.id, Bin.code == code)
    ).one_or_none()
    if bin_record is None:
        bin_record = Bin(
            site_id=site.id,
            code=code,
            bin_type=bin_type,
            status=BinStatus.CLOSED,
            item_count=item_count,
            total_weight_kg=weight,
            max_capacity=max(item_count, 50),
            estimated_value=weight * Decimal("85") if bin_type is BinType.RESALE else None,
            actual_value=weight * Decimal("82") if bin_type is BinType.RESALE else None,
            ready_at=closed_at,
            closed_at=closed_at,
            notes="Dashboard development seed data",
        )
        session.add(bin_record)
        session.flush()
    return bin_record


def _ensure_garment_record(
    session: Session,
    *,
    site: Site,
    user: User,
    bin_record: Bin,
    outcome: GarmentOutcome,
    weight: Decimal,
    received_at: datetime,
) -> None:
    external_reference = f"{bin_record.code}-SUMMARY"
    garment = session.exec(
        select(GarmentRecord).where(
            GarmentRecord.site_id == site.id,
            GarmentRecord.external_reference == external_reference,
        )
    ).one_or_none()
    if garment is None:
        session.add(
            GarmentRecord(
                site_id=site.id,
                recorded_by_user_id=user.id,
                bin_id=bin_record.id,
                external_reference=external_reference,
                category="Mixed textiles",
                outcome=outcome,
                weight_kg=weight,
                received_at=received_at,
                notes="Monthly aggregate record for dashboard development",
            )
        )


def _get_or_create_handoff(
    session: Session,
    *,
    site: Site,
    bin_record: Bin,
    contractor: Contractor,
    staff_user: User,
    month: int,
    staff_weight: Decimal,
    disputed: bool,
) -> Handoff:
    handoff = session.exec(select(Handoff).where(Handoff.bin_id == bin_record.id)).one_or_none()
    if handoff is not None:
        return handoff

    picked_up_at = _month_end(month)
    driver_weight = staff_weight * (Decimal("1.04") if disputed else Decimal("0.99"))
    handoff = Handoff(
        site_id=site.id,
        bin_id=bin_record.id,
        contractor_id=contractor.id,
        created_by_user_id=staff_user.id,
        scheduled_pickup_at=picked_up_at,
        picked_up_at=picked_up_at,
        scale_photo_url=f"https://example.invalid/dashboard-scales/{bin_record.code}.jpg",
        driver_name="Seed Driver",
        vehicle_plate_number=f"DASH-{site.code[-3:]}-{month:02d}",
    )
    handoff.record_pickup_weights(staff_weight, driver_weight.quantize(Decimal("0.001")))
    if not disputed:
        handoff.status = HandoffStatus.CLOSED
        handoff.closed_at = picked_up_at
    session.add(handoff)
    session.flush()
    return handoff


def _ensure_contractor_report(
    session: Session,
    *,
    site: Site,
    contractor: Contractor,
    manager: User,
    handoff: Handoff,
    month: int,
    recycling_weight: Decimal,
) -> None:
    report_month = date(SEED_YEAR, month, 1)
    report = session.exec(
        select(ContractorReport).where(
            ContractorReport.site_id == site.id,
            ContractorReport.contractor_id == contractor.id,
            ContractorReport.report_month == report_month,
        )
    ).one_or_none()
    if report is None:
        report = ContractorReport(
            site_id=site.id,
            contractor_id=contractor.id,
            uploaded_by_user_id=manager.id,
            report_month=report_month,
            source_filename=f"dashboard-{site.code.lower()}-{SEED_YEAR}-{month:02d}.csv",
            status=ReportStatus.IMPORTED,
            validated_at=_month_end(month),
        )
        session.add(report)
        session.flush()

    for index, (disposition, weight) in enumerate(_disposition_weights(recycling_weight)):
        entry = session.exec(
            select(ContractorReportEntry).where(
                ContractorReportEntry.contractor_report_id == report.id,
                ContractorReportEntry.handoff_id == handoff.id,
                ContractorReportEntry.disposition == disposition,
            )
        ).one_or_none()
        if entry is not None:
            continue

        evidence_status = EvidenceStatus.VERIFIED
        if disposition is DispositionCategory.EXPORTED and month % 3 == 0:
            evidence_status = EvidenceStatus.CONTRACTOR_DECLARED
        elif disposition is DispositionCategory.DOWNCYCLED and month % 4 == 0:
            evidence_status = EvidenceStatus.ESTIMATED

        session.add(
            ContractorReportEntry(
                contractor_report_id=report.id,
                handoff_id=handoff.id,
                disposition=disposition,
                weight_kg=weight,
                evidence_status=evidence_status,
                destination=f"Dashboard destination: {disposition.value}",
                evidence_reference=f"DASH-EVIDENCE-{site.code}-{month:02d}-{index + 1}",
            )
        )


def _quarter_totals(site_index: int, months: range) -> dict[str, Decimal]:
    totals = {
        "total": Decimal("0"),
        "resale": Decimal("0"),
        "repair": Decimal("0"),
        **{category.value: Decimal("0") for category, _ in DISPOSITION_SHARES},
    }
    for month in months:
        resale, repair, recycling = _weights(month, site_index)
        totals["total"] += resale + repair + recycling
        totals["resale"] += resale
        totals["repair"] += repair

        for category, disposition_weight in _disposition_weights(recycling):
            totals[category.value] += disposition_weight
    return totals


def _ensure_epr_data(session: Session, manager: User, sites: list[Site]) -> None:
    quarter_definitions = (
        (3, EprReportStatus.SUBMITTED, range(7, 10)),
        (4, EprReportStatus.DRAFT, range(10, 11)),
    )
    for quarter, status, months in quarter_definitions:
        report = session.exec(
            select(EprQuarterReport).where(
                EprQuarterReport.report_year == SEED_YEAR,
                EprQuarterReport.quarter == quarter,
            )
        ).one_or_none()
        if report is None:
            submitted_at = datetime(SEED_YEAR, 10, 15, 9, 0, tzinfo=UTC)
            report = EprQuarterReport(
                report_year=SEED_YEAR,
                quarter=quarter,
                status=status,
                submitted_by_user_id=manager.id if status is EprReportStatus.SUBMITTED else None,
                submitted_at=submitted_at if status is EprReportStatus.SUBMITTED else None,
                locked_at=submitted_at if status is EprReportStatus.SUBMITTED else None,
            )
            session.add(report)
            session.flush()

        for site_index, site in enumerate(sites):
            snapshot = session.exec(
                select(EprQuarterSiteSnapshot).where(
                    EprQuarterSiteSnapshot.epr_quarter_report_id == report.id,
                    EprQuarterSiteSnapshot.site_id == site.id,
                )
            ).one_or_none()
            if snapshot is not None:
                continue

            totals = _quarter_totals(site_index, months)
            snapshot = EprQuarterSiteSnapshot(
                epr_quarter_report_id=report.id,
                site_id=site.id,
                total_weight_received_kg=totals["total"],
                resold_weight_kg=totals["resale"],
                repaired_weight_kg=totals["repair"],
                upcycled_weight_kg=totals[DispositionCategory.UPCYCLED.value],
                fibre_to_fibre_weight_kg=totals[DispositionCategory.FIBRE_TO_FIBRE.value],
                downcycled_weight_kg=totals[DispositionCategory.DOWNCYCLED.value],
                exported_weight_kg=totals[DispositionCategory.EXPORTED.value],
                landfilled_weight_kg=totals[DispositionCategory.LANDFILLED.value],
                incinerated_energy_recovery_weight_kg=totals[
                    DispositionCategory.INCINERATED_ENERGY_RECOVERY.value
                ],
            )
            snapshot.recalculate_recovery_rate()
            session.add(snapshot)

        if quarter == 3 and report.status == EprReportStatus.SUBMITTED:
            _ensure_epr_adjustment(session, report, sites[0], manager)


def _ensure_epr_adjustment(
    session: Session,
    report: EprQuarterReport,
    site: Site,
    manager: User,
) -> None:
    reason = "Dashboard seed: late contractor fibre-to-fibre correction"
    adjustment = session.exec(
        select(EprAdjustment).where(
            EprAdjustment.epr_quarter_report_id == report.id,
            EprAdjustment.site_id == site.id,
            EprAdjustment.metric == EprAdjustmentMetric.FIBRE_TO_FIBRE,
            EprAdjustment.reason == reason,
        )
    ).one_or_none()
    if adjustment is None:
        session.add(
            EprAdjustment(
                epr_quarter_report_id=report.id,
                site_id=site.id,
                metric=EprAdjustmentMetric.FIBRE_TO_FIBRE,
                weight_delta_kg=Decimal("2.500"),
                reason=reason,
                effective_date=date(SEED_YEAR, 10, 20),
                created_by_user_id=manager.id,
            )
        )


def seed_dashboard_data(session: Session) -> None:
    """Insert dashboard development records into an existing migrated database."""

    sites = [_get_or_create_site(session, code, name) for code, name in SITE_DEFINITIONS]
    manager = _get_or_create_user(session, "dashboard.manager@example.invalid", UserRole.MANAGER)
    staff_users = [
        _get_or_create_user(
            session,
            f"dashboard.staff.{site.code[-3:].lower()}@example.invalid",
            UserRole.STAFF,
        )
        for site in sites
    ]

    for index, site in enumerate(sites):
        _ensure_membership(session, manager, site, default=index == 0)
        _ensure_membership(session, staff_users[index], site, default=True)

    contractors = [
        _get_or_create_contractor(session, name, contact_name, contact_email)
        for name, contact_name, contact_email in CONTRACTOR_DEFINITIONS
    ]

    outcome_by_bin_type = {
        BinType.RESALE: GarmentOutcome.RESALE,
        BinType.REPAIR: GarmentOutcome.REPAIR_UPCYCLE,
        BinType.RECYCLE: GarmentOutcome.RECYCLE,
    }
    for site_index, site in enumerate(sites):
        for month in range(1, 11):
            received_at = _month_end(month)
            resale_weight, repair_weight, recycling_weight = _weights(month, site_index)
            weights = {
                BinType.RESALE: resale_weight,
                BinType.REPAIR: repair_weight,
                BinType.RECYCLE: recycling_weight,
            }
            bins: dict[BinType, Bin] = {}
            for bin_type, weight in weights.items():
                code = f"DASH-{site.code[-3:]}-{SEED_YEAR}-{month:02d}-{bin_type.value.upper()}"
                bin_record = _get_or_create_bin(
                    session,
                    site=site,
                    code=code,
                    bin_type=bin_type,
                    weight=weight,
                    item_count=max(1, int(weight / Decimal("0.8"))),
                    closed_at=received_at,
                )
                bins[bin_type] = bin_record
                _ensure_garment_record(
                    session,
                    site=site,
                    user=staff_users[site_index],
                    bin_record=bin_record,
                    outcome=outcome_by_bin_type[bin_type],
                    weight=weight,
                    received_at=received_at,
                )

            contractor = contractors[(month + site_index) % len(contractors)]
            disputed = site_index == 0 and month == 10
            handoff = _get_or_create_handoff(
                session,
                site=site,
                bin_record=bins[BinType.RECYCLE],
                contractor=contractor,
                staff_user=staff_users[site_index],
                month=month,
                staff_weight=recycling_weight,
                disputed=disputed,
            )

            # Leave one October handoff without a report so the dashboard has a pending state.
            if not (site_index == 1 and month == 10):
                _ensure_contractor_report(
                    session,
                    site=site,
                    contractor=contractor,
                    manager=manager,
                    handoff=handoff,
                    month=month,
                    recycling_weight=recycling_weight,
                )

    _ensure_epr_data(session, manager, sites)
    session.commit()


# Recycle bin handoff demo data (HAND- prefix).
HANDOFF_READY_BINS_PER_SITE = 3
HANDOFF_READY_AT = datetime(2026, 11, 18, 9, 0, tzinfo=UTC)
HANDOFF_PICKED_UP_AT = datetime(2026, 11, 20, 4, 0, tzinfo=UTC)


def _handoff_prefix(site: Site) -> str:
    return f"HAND-{site.code[-3:]}"


def _get_or_create_ready_recycle_bin(
    session: Session,
    *,
    site: Site,
    code: str,
    weight: Decimal,
    item_count: int,
    ready_at: datetime,
) -> tuple[Bin, bool]:
    bin_record = session.exec(
        select(Bin).where(Bin.site_id == site.id, Bin.code == code)
    ).one_or_none()
    if bin_record is not None:
        return bin_record, False
    bin_record = Bin(
        site_id=site.id,
        code=code,
        bin_type=BinType.RECYCLE,
        status=BinStatus.READY,
        item_count=item_count,
        total_weight_kg=weight,
        max_capacity=max(item_count, 50),
        ready_at=ready_at,
        notes="Handoff development seed data",
    )
    session.add(bin_record)
    session.flush()
    return bin_record, True


def seed_handoff_data(session: Session) -> None:
    """Insert recycle bin handoff records. Run after ``seed_dashboard_data``.

    Adds ready recycling bins (for the New Bins for Handoff page) and one picked-up handoff per
    site, using the ``HAND-`` prefix. It adds no garment records, so EPR totals are unchanged.
    """

    site_codes = [code for code, _name in SITE_DEFINITIONS]
    sites = session.exec(select(Site).where(Site.code.in_(site_codes)).order_by(Site.code)).all()
    contractors = session.exec(
        select(Contractor).where(Contractor.name.startswith("Dashboard ")).order_by(Contractor.name)
    ).all()

    for site_index, site in enumerate(sites):
        prefix = _handoff_prefix(site)
        staff = session.exec(
            select(User).where(
                User.username == f"dashboard.staff.{site.code[-3:].lower()}@example.invalid"
            )
        ).one()

        for number in range(1, HANDOFF_READY_BINS_PER_SITE + 1):
            weight = Decimal(36 + number * 4 + site_index * 3)
            _get_or_create_ready_recycle_bin(
                session,
                site=site,
                code=f"{prefix}-READY-{number:02d}",
                weight=weight,
                item_count=int(weight * 2),
                ready_at=HANDOFF_READY_AT + timedelta(hours=number),
            )

        picked_bin, created = _get_or_create_ready_recycle_bin(
            session,
            site=site,
            code=f"{prefix}-PICKED-01",
            weight=Decimal("41.000"),
            item_count=88,
            ready_at=HANDOFF_READY_AT - timedelta(days=2),
        )
        if created:
            picked_bin.status = BinStatus.HANDED_OFF
            handoff = Handoff(
                site_id=site.id,
                bin_id=picked_bin.id,
                contractor_id=contractors[(site_index + 1) % len(contractors)].id,
                created_by_user_id=staff.id,
                scheduled_pickup_at=HANDOFF_PICKED_UP_AT,
                picked_up_at=HANDOFF_PICKED_UP_AT,
                scale_photo_url=f"https://example.invalid/handoff-scales/{picked_bin.code}.jpg",
                driver_name="Seed Driver",
                vehicle_plate_number=f"{prefix}-01",
            )
            # The first site's driver weight differs by more than 3%, so it starts Disputed.
            driver_weight = Decimal("42.800") if site_index == 0 else Decimal("40.600")
            handoff.record_pickup_weights(Decimal("41.000"), driver_weight)
            session.add_all([picked_bin, handoff])

    session.commit()


SORTING_ACTIVE_BIN_TYPES = (
    (BinType.RESALE, "RS"),
    (BinType.RECYCLE, "RC"),
    (BinType.REPAIR, "RP"),
)


def seed_sorting_data(session: Session) -> None:
    """Insert one empty open bin of each type per site for the garment sorting screen.

    Run after ``seed_dashboard_data``. Uses the ``SORT-`` prefix and adds no garment records,
    so EPR totals are unchanged.
    """

    site_codes = [code for code, _name in SITE_DEFINITIONS]
    sites = session.exec(select(Site).where(Site.code.in_(site_codes)).order_by(Site.code)).all()
    for site in sites:
        for bin_type, suffix in SORTING_ACTIVE_BIN_TYPES:
            code = f"SORT-{site.code[-3:]}-{suffix}-01"
            exists = session.exec(
                select(Bin.id).where(Bin.site_id == site.id, Bin.code == code)
            ).first()
            if exists is None:
                session.add(
                    Bin(
                        site_id=site.id,
                        code=code,
                        bin_type=bin_type,
                        status=BinStatus.ACTIVE,
                        notes="Sorting development seed data",
                    )
                )
    session.commit()


def seed_development_data(session: Session) -> None:
    """Insert all development records: dashboard, handoff, then sorting data."""

    seed_dashboard_data(session)
    seed_handoff_data(session)
    seed_sorting_data(session)


def main() -> None:
    with Session(get_engine()) as session:
        seed_development_data(session)
    print(
        "Seed data is ready: dashboard (2 sites, Jan-Oct 2026, EPR Q3-Q4) and recycle bin "
        f"handoff ({HANDOFF_READY_BINS_PER_SITE} ready bins and 1 picked-up handoff per site), "
        "sorting (one open bin of each type per site)."
    )


if __name__ == "__main__":
    main()
