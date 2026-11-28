from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from .auth import ActiveUser, require_management
from .database import get_session
from .epr import lock_open_epr_quarter
from .models import (
    Bin,
    BinStatus,
    BinType,
    GarmentRecord,
    ResaleBinProcess,
    Site,
    UserRole,
    UserSite,
)
from .schemas import (
    ResaleBinRecord,
    ResaleProcessRequest,
    ResaleStoreSummary,
    ResaleStoreSummaryResponse,
)
from .sorting import resolve_read_sites

router = APIRouter(prefix="/api/resale-bins", tags=["resale bins"])
SessionDependency = Annotated[Session, Depends(get_session)]
SiteIdQuery = Annotated[int, Query(gt=0)]


def to_resale_bin_record(bin_record: Bin, process: ResaleBinProcess | None) -> ResaleBinRecord:
    is_processed = process is not None or bin_record.actual_value is not None
    return ResaleBinRecord(
        id=bin_record.id,
        bin_code=bin_record.code,
        item_count=bin_record.item_count,
        total_weight_kg=float(bin_record.total_weight_kg),
        packed_at=bin_record.closed_at or bin_record.created_at,
        status="processed" if is_processed else "awaiting_process",
        accepted_item_count=process.accepted_item_count if process else None,
        rejected_item_count=process.rejected_item_count if process else None,
        revenue=(
            float(process.revenue)
            if process
            else float(bin_record.actual_value)
            if bin_record.actual_value is not None
            else None
        ),
        processed_at=(
            process.processed_at
            if process
            else bin_record.closed_at.date()
            if bin_record.actual_value is not None and bin_record.closed_at
            else None
        ),
        notes=process.notes if process else None,
    )


@router.get("", response_model=list[ResaleBinRecord])
def get_resale_bins(
    site_id: SiteIdQuery, user: ActiveUser, session: SessionDependency
) -> list[ResaleBinRecord]:
    # Staff read their own store; managers read their assigned stores, the same rule as sorting.
    resolve_read_sites(session, user.id, site_id)
    rows = session.exec(
        select(Bin, ResaleBinProcess)
        .outerjoin(ResaleBinProcess, ResaleBinProcess.bin_id == Bin.id)
        .where(
            Bin.site_id == site_id,
            Bin.bin_type == BinType.RESALE,
            Bin.status == BinStatus.CLOSED,
        )
        .order_by(Bin.closed_at.desc(), Bin.id.desc())
    ).all()
    return [to_resale_bin_record(bin_record, process) for bin_record, process in rows]


@router.post("/{bin_id}/process", response_model=ResaleBinRecord)
def process_resale_bin(
    bin_id: int, payload: ResaleProcessRequest, user: ActiveUser, session: SessionDependency
) -> ResaleBinRecord:
    bin_record = session.exec(select(Bin).where(Bin.id == bin_id).with_for_update()).one_or_none()
    if bin_record is None:
        raise HTTPException(status_code=404, detail="Resale bin not found.")
    if bin_record.bin_type is not BinType.RESALE or bin_record.status is not BinStatus.CLOSED:
        raise HTTPException(status_code=409, detail="Only closed resale bins can be processed.")
    if bin_record.actual_value is not None:
        raise HTTPException(
            status_code=409, detail="This resale bin already has a recorded sale value."
        )
    if payload.accepted_item_count + payload.rejected_item_count != bin_record.item_count:
        raise HTTPException(
            status_code=422,
            detail=f"Accepted and rejected counts must total {bin_record.item_count}.",
        )

    actor = user
    if actor.role is not UserRole.STAFF:
        raise HTTPException(status_code=403, detail="Only store staff can process resale bins.")
    membership = session.exec(
        select(UserSite.id).where(
            UserSite.user_id == actor.id,
            UserSite.site_id == bin_record.site_id,
        )
    ).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="Staff can only process bins at their site.")

    existing = session.exec(
        select(ResaleBinProcess).where(ResaleBinProcess.bin_id == bin_record.id)
    ).one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="This resale bin has already been processed.")

    received_at_values = session.exec(
        select(GarmentRecord.received_at).where(GarmentRecord.bin_id == bin_record.id)
    ).all()
    source_quarters = sorted(
        {(received_at.year, (received_at.month - 1) // 3 + 1) for received_at in received_at_values}
    )
    for year, quarter in source_quarters:
        lock_open_epr_quarter(session, date(year, (quarter - 1) * 3 + 1, 1))

    process = ResaleBinProcess(
        bin_id=bin_record.id,
        processed_by_user_id=actor.id,
        accepted_item_count=payload.accepted_item_count,
        rejected_item_count=payload.rejected_item_count,
        revenue=Decimal(payload.revenue),
        processed_at=payload.processed_at,
        notes=payload.notes,
    )
    bin_record.actual_value = Decimal(payload.revenue)
    session.add(process)
    session.add(bin_record)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=409, detail="This resale bin has already been processed."
        ) from None
    session.refresh(process)
    return to_resale_bin_record(bin_record, process)


@router.get(
    "/summary",
    response_model=ResaleStoreSummaryResponse,
    dependencies=[Depends(require_management)],
)
def get_resale_bin_summary(session: SessionDependency) -> ResaleStoreSummaryResponse:
    actual_value_total = func.sum(Bin.actual_value)
    statement = (
        select(Site.id, Site.name, actual_value_total.label("actual_value"))
        .join(Bin, Bin.site_id == Site.id)
        .where(Bin.bin_type == BinType.RESALE, Bin.actual_value.is_not(None))
        .group_by(Site.id, Site.name)
        .order_by(actual_value_total.desc(), Site.name)
        .limit(5)
    )

    stores = [
        ResaleStoreSummary(id=site_id, name=name, actual_value=float(actual_value))
        for site_id, name, actual_value in session.exec(statement).all()
    ]
    return ResaleStoreSummaryResponse(stores=stores)
