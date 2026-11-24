"""Garment sorting and bin records (Feature 2).

Staff sort each incoming garment into the active bin of the matching type at their own site.
Sealing a recycling bin makes it ``ready`` so it appears on the handoff page (Feature 4).

Until login is connected, write requests name the acting user with ``actor_id`` (the same
stopgap the handoff and EPR endpoints use).
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
    SortingStatsResponse,
    UserRole,
)
from .schemas import BinStatus as ApiBinStatus
from .schemas import BinType as ApiBinType

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api", tags=["sorting"])
SessionDependency = Annotated[Session, Depends(get_session)]
SiteIdQuery = Annotated[int, Query(gt=0, description="Site whose bins and garments to read")]

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
MAX_NOTES_LENGTH = 500  # bins.notes is VARCHAR(500)
WEIGHT_PRECISION = Decimal("0.001")  # garment_records.weight_kg and bins.total_weight_kg


def utc_now() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime) -> datetime:
    """MySQL and SQLite return naive datetimes; everything is stored in UTC."""

    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def to_bin_record(bin_record: Bin) -> BinRecord:
    return BinRecord(
        id=bin_record.id,
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


def to_garment_item(garment: GarmentRecord, bin_code: str) -> GarmentItem:
    return GarmentItem(
        id=garment.id,
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
    """BIN-RS-001 style code; skips numbers already taken, including custom codes."""

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
        code = f"BIN-{prefix}-{number:03d}"
        taken = session.exec(select(Bin.id).where(Bin.site_id == site_id, Bin.code == code)).first()
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
        duplicate = session.exec(select(Bin.id).where(Bin.site_id == site_id, Bin.code == code))
        if duplicate.first() is not None:
            raise HTTPException(
                status_code=409, detail="A bin with this code already exists at your site."
            )
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
        raise HTTPException(
            status_code=409, detail="A bin with this code already exists at your site."
        ) from None


@router.get("/bins", response_model=list[BinRecord])
def get_bins(
    site_id: SiteIdQuery,
    session: SessionDependency,
    bin_type: Annotated[ApiBinType | None, Query(description="Filter by bin type")] = None,
    status: Annotated[ApiBinStatus | None, Query(description="Filter by status")] = None,
) -> list[BinRecord]:
    statement = select(Bin).where(Bin.site_id == site_id)
    if bin_type is not None:
        statement = statement.where(Bin.bin_type == BinType(bin_type.value))
    if status is not None:
        statement = statement.where(Bin.status == BinStatus(status.value))
    bins = session.exec(statement.order_by(Bin.created_at.desc(), Bin.id.desc())).all()
    return [to_bin_record(bin_record) for bin_record in bins]


@router.get("/bins/active", response_model=ActiveBinsResponse)
def get_active_bins(site_id: SiteIdQuery, session: SessionDependency) -> ActiveBinsResponse:
    def active(bin_type: BinType) -> BinRecord | None:
        found = find_active_bin(session, site_id, bin_type)
        return None if found is None else to_bin_record(found)

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
    return to_bin_record(bin_record)


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
    return to_bin_record(bin_record)


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
    return SortGarmentResponse(
        garment=to_garment_item(garment, target.code),
        bin=to_bin_record(target),
        message=message,
    )


@router.get("/garments/recent", response_model=list[GarmentItem])
def get_recent_garments(
    site_id: SiteIdQuery,
    session: SessionDependency,
    limit: Annotated[int, Query(ge=1, le=100, description="Max items to return")] = 15,
) -> list[GarmentItem]:
    rows = session.exec(
        select(GarmentRecord, Bin.code)
        .join(Bin, GarmentRecord.bin_id == Bin.id)
        .where(GarmentRecord.site_id == site_id)
        .order_by(GarmentRecord.received_at.desc(), GarmentRecord.id.desc())
        .limit(limit)
    ).all()
    return [to_garment_item(garment, bin_code) for garment, bin_code in rows]


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
def get_sorting_stats(site_id: SiteIdQuery, session: SessionDependency) -> SortingStatsResponse:
    start, end = today_bounds_utc(session.get(Site, site_id))
    counts = dict(
        session.exec(
            select(GarmentRecord.outcome, func.count())
            .where(
                GarmentRecord.site_id == site_id,
                GarmentRecord.received_at >= start,
                GarmentRecord.received_at < end,
            )
            .group_by(GarmentRecord.outcome)
        ).all()
    )
    resale = counts.get(GarmentOutcome.RESALE, 0)
    recycle = counts.get(GarmentOutcome.RECYCLE, 0)
    repair = counts.get(GarmentOutcome.REPAIR_UPCYCLE, 0)
    total = resale + recycle + repair

    resale_bin = find_active_bin(session, site_id, BinType.RESALE)
    recycle_bin = find_active_bin(session, site_id, BinType.RECYCLE)
    repair_bin = find_active_bin(session, site_id, BinType.REPAIR)
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
