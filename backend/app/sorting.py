"""Garment sorting and bin records (Feature 2).

Staff sort each incoming garment into the active bin of the matching type at their own site.
Sealing a recycling bin makes it ``ready`` so it appears on the handoff page (Feature 4).

Until login is connected, requests name the acting user with ``actor_id`` (the same stopgap the
handoff and EPR endpoints use). Staff only reach their own site. A manager reaches the sites
they belong to, or every site when they have no site assigned; an administrator reaches every
site. Reads that leave out ``site_id`` return all of the actor's sites combined.
"""

import logging
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from .database import get_session
from .epr import lock_open_epr_quarter
from .models import Bin, BinStatus, BinType, GarmentOutcome, GarmentRecord, Site, User, UserSite
from .schemas import (
    ActiveBinsResponse,
    BinCloseRequest,
    BinCreateRequest,
    BinRecord,
    GarmentCondition,
    GarmentItem,
    GarmentSortRequest,
    SortGarmentResponse,
    SortingSite,
    SortingStatsResponse,
    UserRole,
)
from .schemas import BinStatus as ApiBinStatus
from .schemas import BinType as ApiBinType

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api", tags=["sorting"])
SessionDependency = Annotated[Session, Depends(get_session)]
ActorIdQuery = Annotated[int, Query(gt=0, description="Acting user (stands in for login)")]
SiteIdQuery = Annotated[
    int | None,
    Query(gt=0, description="One site; leave out for all sites the actor may read"),
]

OUTCOME_BY_CONDITION: dict[GarmentCondition, GarmentOutcome] = {
    GarmentCondition.GOOD_REUSABLE: GarmentOutcome.RESALE,
    GarmentCondition.WORN_RECYCLABLE: GarmentOutcome.RECYCLE,
    GarmentCondition.REPAIR_UPCYCLE: GarmentOutcome.REPAIR_UPCYCLE,
}
CONDITION_BY_OUTCOME = {outcome: condition for condition, outcome in OUTCOME_BY_CONDITION.items()}
BIN_TYPE_BY_CONDITION: dict[GarmentCondition, BinType] = {
    GarmentCondition.GOOD_REUSABLE: BinType.RESALE,
    GarmentCondition.WORN_RECYCLABLE: BinType.RECYCLE,
    GarmentCondition.REPAIR_UPCYCLE: BinType.REPAIR,
}
CONDITION_LABELS: dict[GarmentCondition, str] = {
    GarmentCondition.GOOD_REUSABLE: "Good/Reusable (Resale)",
    GarmentCondition.WORN_RECYCLABLE: "Worn/Recyclable (Recycle)",
    GarmentCondition.REPAIR_UPCYCLE: "Repair/Upcycle (Repair)",
}
BIN_CODE_PREFIXES: dict[BinType, str] = {
    BinType.RESALE: "RS",
    BinType.RECYCLE: "RC",
    BinType.REPAIR: "RP",
}
BIN_CODE_CONFLICT = "A bin with this code already exists."
MAX_NOTES_LENGTH = 500  # bins.notes is VARCHAR(500)
WEIGHT_PRECISION = Decimal("0.001")  # garment_records.weight_kg and bins.total_weight_kg


def utc_now() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime) -> datetime:
    """MySQL and SQLite return naive datetimes; everything is stored in UTC."""

    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def to_bin_record(bin_record: Bin, site_name: str) -> BinRecord:
    return BinRecord(
        id=bin_record.id,
        site_id=bin_record.site_id,
        site_name=site_name,
        bin_code=bin_record.code,
        bin_type=ApiBinType(bin_record.bin_type.value),
        status=ApiBinStatus(bin_record.status.value),
        item_count=bin_record.item_count,
        total_weight_kg=float(bin_record.total_weight_kg),
        max_capacity=bin_record.max_capacity,
        created_at=as_utc(bin_record.created_at),
        ready_at=as_utc(bin_record.ready_at) if bin_record.ready_at else None,
        closed_at=as_utc(bin_record.closed_at) if bin_record.closed_at else None,
        notes=bin_record.notes,
    )


def to_garment_item(garment: GarmentRecord, bin_code: str, site_name: str) -> GarmentItem:
    return GarmentItem(
        id=garment.id,
        site_id=garment.site_id,
        site_name=site_name,
        condition=CONDITION_BY_OUTCOME[garment.outcome],
        category=garment.category,
        bin_id=garment.bin_id,
        bin_code=bin_code,
        weight_kg=None if garment.weight_kg is None else float(garment.weight_kg),
        notes=garment.notes,
        created_at=as_utc(garment.received_at),
    )


def require_staff_site(session: Session, actor_id: int) -> int:
    """Sorting is done by store staff, always at the site they work at. Returns that site id."""

    actor = session.get(User, actor_id)
    if actor is None:
        raise HTTPException(status_code=422, detail="Select an existing user account.")
    if actor.role is not UserRole.STAFF:
        raise HTTPException(status_code=403, detail="Only store staff can sort garments.")
    site_id = session.exec(
        select(UserSite.site_id).where(UserSite.user_id == actor.id).order_by(UserSite.site_id)
    ).first()
    if site_id is None:
        raise HTTPException(status_code=403, detail="This staff account isn't assigned to a site.")
    return site_id


def resolve_read_sites(session: Session, actor_id: int, site_id: int | None) -> list[int]:
    """The site ids this actor may read. A requested ``site_id`` must be one of them."""

    actor = session.get(User, actor_id)
    if actor is None:
        raise HTTPException(status_code=422, detail="Select an existing user account.")

    if actor.role is UserRole.STAFF:
        allowed = [require_staff_site(session, actor_id)]
    else:
        memberships = session.exec(
            select(UserSite.site_id).where(UserSite.user_id == actor.id).order_by(UserSite.site_id)
        ).all()
        # A manager with no site assigned works across sites, like an administrator.
        if actor.role is UserRole.MANAGER and memberships:
            allowed = list(memberships)
        else:
            allowed = list(session.exec(select(Site.id).order_by(Site.id)).all())

    if site_id is None:
        return allowed
    if site_id not in allowed:
        if session.get(Site, site_id) is None:
            raise HTTPException(status_code=404, detail="Site not found.")
        raise HTTPException(status_code=403, detail="You don't have access to this site.")
    return [site_id]


def require_single_site(sites: list[int]) -> int:
    if len(sites) != 1:
        raise HTTPException(status_code=422, detail="Choose one site.")
    return sites[0]


def site_name_of(session: Session, site_id: int) -> str:
    site = session.get(Site, site_id)
    return site.name if site is not None else ""


def find_active_bin(
    session: Session, site_id: int, bin_type: BinType, *, lock: bool = False
) -> Bin | None:
    """The oldest open bin of this type that still has room, or None."""

    statement = (
        select(Bin)
        .where(
            Bin.site_id == site_id,
            Bin.bin_type == bin_type,
            Bin.status == BinStatus.ACTIVE,
            Bin.item_count < Bin.max_capacity,
        )
        .order_by(Bin.created_at, Bin.id)
        .limit(1)
    )
    if lock:
        statement = statement.with_for_update()
    return session.exec(statement).first()


def next_bin_code(session: Session, site_id: int, bin_type: BinType) -> str:
    """BKK-RS-001 style code: the site's code, the bin type, and a per-site counter.

    Site codes are unique, so generated codes are unique across all sites. Numbers already
    taken, including custom codes, are skipped.
    """

    site_code = session.exec(select(Site.code).where(Site.id == site_id)).one()
    prefix = BIN_CODE_PREFIXES[bin_type]
    number = (
        session.exec(
            select(func.count())
            .select_from(Bin)
            .where(Bin.site_id == site_id, Bin.bin_type == bin_type)
        ).one()
        + 1
    )
    while True:
        code = f"{site_code}-{prefix}-{number:03d}"
        taken = session.exec(select(Bin.id).where(Bin.code == code)).first()
        if taken is None:
            return code
        number += 1


def add_bin(
    session: Session,
    site_id: int,
    bin_type: BinType,
    *,
    code: str | None = None,
    max_capacity: int = 50,
    notes: str | None = None,
) -> Bin:
    if code is not None:
        duplicate = session.exec(select(Bin.id).where(Bin.code == code))
        if duplicate.first() is not None:
            raise HTTPException(status_code=409, detail=BIN_CODE_CONFLICT)
    bin_record = Bin(
        site_id=site_id,
        code=code or next_bin_code(session, site_id, bin_type),
        bin_type=bin_type,
        status=BinStatus.ACTIVE,
        max_capacity=max_capacity,
        notes=notes,
    )
    session.add(bin_record)
    session.flush()
    return bin_record


def commit_or_conflict(session: Session) -> None:
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail=BIN_CODE_CONFLICT) from None


@router.get("/sorting/sites", response_model=list[SortingSite])
def get_sorting_sites(actor_id: ActorIdQuery, session: SessionDependency) -> list[SortingSite]:
    """The sites this actor may read, for a site switcher. Staff get their own site only."""

    allowed = resolve_read_sites(session, actor_id, None)
    sites = session.exec(select(Site).where(Site.id.in_(allowed)).order_by(Site.name)).all()
    return [SortingSite(id=site.id, code=site.code, name=site.name) for site in sites]


@router.get("/bins", response_model=list[BinRecord])
def get_bins(
    actor_id: ActorIdQuery,
    session: SessionDependency,
    site_id: SiteIdQuery = None,
    bin_type: Annotated[ApiBinType | None, Query(description="Filter by bin type")] = None,
    status: Annotated[ApiBinStatus | None, Query(description="Filter by status")] = None,
) -> list[BinRecord]:
    sites = resolve_read_sites(session, actor_id, site_id)
    statement = (
        select(Bin, Site.name).join(Site, Bin.site_id == Site.id).where(Bin.site_id.in_(sites))
    )
    if bin_type is not None:
        statement = statement.where(Bin.bin_type == BinType(bin_type.value))
    if status is not None:
        statement = statement.where(Bin.status == BinStatus(status.value))
    rows = session.exec(statement.order_by(Bin.created_at.desc(), Bin.id.desc())).all()
    return [to_bin_record(bin_record, site_name) for bin_record, site_name in rows]


@router.get("/bins/active", response_model=ActiveBinsResponse)
def get_active_bins(
    actor_id: ActorIdQuery, session: SessionDependency, site_id: SiteIdQuery = None
) -> ActiveBinsResponse:
    """The open bins of one site. Managers must choose the site."""

    site_id = require_single_site(resolve_read_sites(session, actor_id, site_id))
    site_name = site_name_of(session, site_id)

    def active(bin_type: BinType) -> BinRecord | None:
        found = find_active_bin(session, site_id, bin_type)
        return None if found is None else to_bin_record(found, site_name)

    return ActiveBinsResponse(
        resale_bin=active(BinType.RESALE),
        recycle_bin=active(BinType.RECYCLE),
        repair_bin=active(BinType.REPAIR),
    )


@router.post("/bins", response_model=BinRecord, status_code=201)
def create_bin(request: BinCreateRequest, session: SessionDependency) -> BinRecord:
    site_id = require_staff_site(session, request.actor_id)
    bin_record = add_bin(
        session,
        site_id,
        BinType(request.bin_type.value),
        code=request.bin_code,
        max_capacity=request.max_capacity,
        notes=request.notes,
    )
    commit_or_conflict(session)
    session.refresh(bin_record)
    return to_bin_record(bin_record, site_name_of(session, site_id))


@router.post("/bins/{bin_id}/close", response_model=BinRecord)
def close_bin(bin_id: int, request: BinCloseRequest, session: SessionDependency) -> BinRecord:
    """Seal a bin. Recycling bins become ``ready`` for a contractor handoff; others ``closed``."""

    site_id = require_staff_site(session, request.actor_id)
    bin_record = session.exec(select(Bin).where(Bin.id == bin_id).with_for_update()).one_or_none()
    if bin_record is None:
        raise HTTPException(status_code=404, detail=f"Bin with ID '{bin_id}' not found.")
    if bin_record.site_id != site_id:
        raise HTTPException(status_code=403, detail="Staff can only seal bins at their own site.")
    if bin_record.status is not BinStatus.ACTIVE:
        raise HTTPException(status_code=409, detail="This bin is already sealed.")
    if bin_record.item_count == 0:
        raise HTTPException(status_code=409, detail="An empty bin can't be sealed.")

    if request.notes:
        combined = f"{bin_record.notes}; {request.notes}" if bin_record.notes else request.notes
        if len(combined) > MAX_NOTES_LENGTH:
            raise HTTPException(status_code=422, detail="The bin notes are too long.")
        bin_record.notes = combined

    now = utc_now()
    if bin_record.bin_type is BinType.RECYCLE:
        bin_record.status = BinStatus.READY
        bin_record.ready_at = now
    else:
        bin_record.status = BinStatus.CLOSED
        bin_record.closed_at = now
    session.add(bin_record)
    session.commit()
    session.refresh(bin_record)
    return to_bin_record(bin_record, site_name_of(session, site_id))


@router.post("/garments/sort", response_model=SortGarmentResponse)
def sort_garment(request: GarmentSortRequest, session: SessionDependency) -> SortGarmentResponse:
    site_id = require_staff_site(session, request.actor_id)
    bin_type = BIN_TYPE_BY_CONDITION[request.condition]
    received_at = utc_now()
    # Garment weights are EPR report inputs, so a submitted quarter must refuse new garments.
    lock_open_epr_quarter(session, received_at.date())

    target: Bin | None = None
    if request.bin_id is not None:
        candidate = session.exec(
            select(Bin).where(Bin.id == request.bin_id).with_for_update()
        ).one_or_none()
        if candidate is not None and candidate.site_id != site_id:
            raise HTTPException(status_code=403, detail="Staff can only use bins at their site.")
        if (
            candidate is not None
            and candidate.status is BinStatus.ACTIVE
            and candidate.bin_type is bin_type
            and candidate.item_count < candidate.max_capacity
        ):
            target = candidate
    if target is None:
        target = find_active_bin(session, site_id, bin_type, lock=True)
    if target is None:
        target = add_bin(
            session,
            site_id,
            bin_type,
            notes="Auto-created when incoming garment was sorted",
        )

    garment = GarmentRecord(
        site_id=site_id,
        recorded_by_user_id=request.actor_id,
        bin_id=target.id,
        category=request.category,
        outcome=OUTCOME_BY_CONDITION[request.condition],
        weight_kg=(
            None
            if request.weight_kg is None
            else Decimal(str(request.weight_kg)).quantize(WEIGHT_PRECISION)
        ),
        received_at=received_at,
        notes=request.notes,
    )
    target.item_count += 1
    if garment.weight_kg is not None:
        target.total_weight_kg = Decimal(target.total_weight_kg) + garment.weight_kg
    session.add_all([garment, target])
    commit_or_conflict(session)
    session.refresh(garment)
    session.refresh(target)

    message = (
        f"Item successfully sorted as {CONDITION_LABELS[request.condition]} into {target.code} "
        f"({target.item_count}/{target.max_capacity} items)."
    )
    site_name = site_name_of(session, site_id)
    return SortGarmentResponse(
        garment=to_garment_item(garment, target.code, site_name),
        bin=to_bin_record(target, site_name),
        message=message,
    )


@router.get("/garments/recent", response_model=list[GarmentItem])
def get_recent_garments(
    actor_id: ActorIdQuery,
    session: SessionDependency,
    site_id: SiteIdQuery = None,
    limit: Annotated[int, Query(ge=1, le=100, description="Max items to return")] = 15,
) -> list[GarmentItem]:
    sites = resolve_read_sites(session, actor_id, site_id)
    rows = session.exec(
        select(GarmentRecord, Bin.code, Site.name)
        .join(Bin, GarmentRecord.bin_id == Bin.id)
        .join(Site, GarmentRecord.site_id == Site.id)
        .where(GarmentRecord.site_id.in_(sites))
        .order_by(GarmentRecord.received_at.desc(), GarmentRecord.id.desc())
        .limit(limit)
    ).all()
    return [to_garment_item(garment, code, name) for garment, code, name in rows]


def today_bounds_utc(site: Site | None) -> tuple[datetime, datetime]:
    """Start and end of the current day at the site, as UTC datetimes."""

    try:
        zone = ZoneInfo(site.timezone_name) if site is not None else UTC
    except ZoneInfoNotFoundError:
        logger.warning("Unknown timezone %r for site %s; using UTC.", site.timezone_name, site.id)
        zone = UTC
    local_midnight = datetime.now(zone).replace(hour=0, minute=0, second=0, microsecond=0)
    # Same-zone arithmetic is wall-clock, so this stays correct across daylight-saving changes.
    next_midnight = local_midnight + timedelta(days=1)
    return local_midnight.astimezone(UTC), next_midnight.astimezone(UTC)


@router.get("/sorting/stats", response_model=SortingStatsResponse)
def get_sorting_stats(
    actor_id: ActorIdQuery, session: SessionDependency, site_id: SiteIdQuery = None
) -> SortingStatsResponse:
    """Today's intake. Each site's day follows its own timezone; sites are summed together."""

    sites = resolve_read_sites(session, actor_id, site_id)
    counts: dict[GarmentOutcome, int] = {}
    for current_site_id in sites:
        start, end = today_bounds_utc(session.get(Site, current_site_id))
        rows = session.exec(
            select(GarmentRecord.outcome, func.count())
            .where(
                GarmentRecord.site_id == current_site_id,
                GarmentRecord.received_at >= start,
                GarmentRecord.received_at < end,
            )
            .group_by(GarmentRecord.outcome)
        ).all()
        for outcome, count in rows:
            counts[outcome] = counts.get(outcome, 0) + count
    resale = counts.get(GarmentOutcome.RESALE, 0)
    recycle = counts.get(GarmentOutcome.RECYCLE, 0)
    repair = counts.get(GarmentOutcome.REPAIR_UPCYCLE, 0)
    total = resale + recycle + repair

    # Open bins belong to one site, so they are only reported for a single-site request.
    single_site = sites[0] if len(sites) == 1 else None

    def active(bin_type: BinType) -> Bin | None:
        return None if single_site is None else find_active_bin(session, single_site, bin_type)

    resale_bin, recycle_bin, repair_bin = (
        active(BinType.RESALE),
        active(BinType.RECYCLE),
        active(BinType.REPAIR),
    )
    return SortingStatsResponse(
        total_sorted_today=total,
        resale_count=resale,
        recycle_count=recycle,
        repair_count=repair,
        resale_percentage=round(resale / total * 100, 1) if total else 0.0,
        active_resale_bin_code=resale_bin.code if resale_bin else None,
        active_resale_bin_items=resale_bin.item_count if resale_bin else 0,
        active_recycle_bin_code=recycle_bin.code if recycle_bin else None,
        active_recycle_bin_items=recycle_bin.item_count if recycle_bin else 0,
        active_repair_bin_code=repair_bin.code if repair_bin else None,
        active_repair_bin_items=repair_bin.item_count if repair_bin else 0,
    )
