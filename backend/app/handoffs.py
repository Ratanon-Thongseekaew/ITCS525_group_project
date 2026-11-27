"""Recycle bin handoffs: schedule a contractor pickup, record pickup evidence, approve, close.

Every route needs a signed-in user, read from the login token. Reads follow the sorting site
rules: staff see their own store, managers their assigned stores (or all stores when they have
none), and administrators every store. Pickups are recorded by staff of the bin's store; approve
and close are for managers and administrators of the handoff's store.
"""

import os
import uuid
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Annotated

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import AwareDatetime, StringConstraints
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from .auth import ActiveUser, ManagementUser
from .database import REPOSITORY_ROOT, get_session
from .models import (
    Bin,
    BinStatus,
    BinType,
    Contractor,
    ContractorReportEntry,
    DispositionCategory,
    Handoff,
    HandoffStatus,
    Site,
    User,
    UserSite,
)
from .schemas import (
    HandoffContractorOption,
    HandoffListResponse,
    HandoffOptionsResponse,
    HandoffOutcomes,
    HandoffReadyBin,
    HandoffReadyBinsResponse,
    HandoffRecord,
    HandoffRecordStatus,
    HandoffSiteOption,
    UserRole,
)
from .sorting import resolve_read_sites

router = APIRouter(prefix="/api/handoffs", tags=["handoffs"])
SessionDependency = Annotated[Session, Depends(get_session)]

MAX_SCALE_PHOTO_BYTES = 5 * 1024 * 1024
# Pickups record something that already happened; allow a little clock drift between devices.
PICKUP_CLOCK_TOLERANCE = timedelta(minutes=5)
SCALE_PHOTO_FOLDER = "handoff-scales"
# Content type -> (file extension, leading bytes check).
SCALE_PHOTO_TYPES = {
    "image/jpeg": (".jpg", lambda data: data.startswith(b"\xff\xd8\xff")),
    "image/png": (".png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/webp": (".webp", lambda data: data[:4] == b"RIFF" and data[8:12] == b"WEBP"),
}

WeightKg = Annotated[Decimal, Form(ge=0, max_digits=12, decimal_places=3)]
DriverName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120), Form()
]
PlateNumber = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32), Form()
]


def get_upload_dir() -> Path:
    """Folder for uploaded files. UPLOAD_DIR overrides it; relative paths start at the repo root."""

    load_dotenv(REPOSITORY_ROOT / ".env")
    folder = Path(os.getenv("UPLOAD_DIR") or "backend/uploads")
    return folder if folder.is_absolute() else REPOSITORY_ROOT / folder


def utc_now() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime | None) -> datetime | None:
    """MySQL and SQLite return naive datetimes; everything is stored in UTC."""

    if value is None:
        return None
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def to_float(value: Decimal | None) -> float | None:
    return None if value is None else float(value)


def require_site_staff(session: Session, actor_id: int, site_id: int) -> User:
    """Handoffs are recorded by store staff, and only for the site they work at."""

    actor = session.get(User, actor_id)
    if actor is None:
        raise HTTPException(status_code=422, detail="Select an existing user account.")
    if actor.role is not UserRole.STAFF:
        raise HTTPException(status_code=403, detail="Only store staff can record handoffs.")
    membership = session.exec(
        select(UserSite.id).where(UserSite.user_id == actor.id, UserSite.site_id == site_id)
    ).first()
    if membership is None:
        raise HTTPException(
            status_code=403, detail="Staff can only record handoffs for their own site."
        )
    return actor


def lock_handoff(session: Session, handoff_id: int) -> Handoff:
    handoff = session.exec(
        select(Handoff).where(Handoff.id == handoff_id).with_for_update()
    ).one_or_none()
    if handoff is None:
        raise HTTPException(status_code=404, detail="Handoff not found.")
    return handoff


def scale_photo_api_url(handoff: Handoff) -> str | None:
    if not handoff.scale_photo_url:
        return None
    if handoff.scale_photo_url.startswith(f"{SCALE_PHOTO_FOLDER}/"):
        return f"/api/handoffs/{handoff.id}/scale-photo"
    # Seeded or externally hosted references are returned unchanged.
    return handoff.scale_photo_url


def load_records(
    session: Session,
    *,
    handoff_id: int | None = None,
    site_id: int | None = None,
    site_ids: list[int] | None = None,
    status: HandoffRecordStatus | None = None,
) -> list[HandoffRecord]:
    statement = (
        select(Handoff, Bin, Contractor, Site)
        .join(Bin, Handoff.bin_id == Bin.id)
        .join(Contractor, Handoff.contractor_id == Contractor.id)
        .join(Site, Handoff.site_id == Site.id)
    )
    if handoff_id is not None:
        statement = statement.where(Handoff.id == handoff_id)
    if site_id is not None:
        statement = statement.where(Handoff.site_id == site_id)
    if site_ids is not None:
        statement = statement.where(Handoff.site_id.in_(site_ids))
    if status is not None:
        statement = statement.where(Handoff.status == HandoffStatus(status.value))

    if status is HandoffRecordStatus.SCHEDULED:
        statement = statement.order_by(Handoff.scheduled_pickup_at, Handoff.id)
    else:
        happened_at = func.coalesce(
            Handoff.picked_up_at, Handoff.scheduled_pickup_at, Handoff.created_at
        )
        statement = statement.order_by(happened_at.desc(), Handoff.id.desc())

    rows = session.exec(statement).all()
    if not rows:
        return []

    handoff_ids = [handoff.id for handoff, *_ in rows]
    user_ids = {handoff.created_by_user_id for handoff, *_ in rows} | {
        handoff.approved_by_user_id for handoff, *_ in rows if handoff.approved_by_user_id
    }
    usernames = dict(
        session.exec(select(User.id, User.username).where(User.id.in_(user_ids))).all()
    )

    outcome_weights: dict[int, dict[DispositionCategory, Decimal]] = defaultdict(dict)
    for entry_handoff_id, disposition, weight in session.exec(
        select(
            ContractorReportEntry.handoff_id,
            ContractorReportEntry.disposition,
            func.sum(ContractorReportEntry.weight_kg),
        )
        .where(ContractorReportEntry.handoff_id.in_(handoff_ids))
        .group_by(ContractorReportEntry.handoff_id, ContractorReportEntry.disposition)
    ).all():
        outcome_weights[entry_handoff_id][disposition] = weight

    records = []
    for handoff, bin_record, contractor, site in rows:
        weights = outcome_weights.get(handoff.id)
        outcomes = (
            HandoffOutcomes(
                **{
                    f"{category.value}_weight_kg": float(weights.get(category, 0))
                    for category in DispositionCategory
                }
            )
            if weights
            else None
        )
        records.append(
            HandoffRecord(
                id=handoff.id,
                site_id=site.id,
                site_name=site.name,
                bin_id=bin_record.id,
                bin_code=bin_record.code,
                item_count=bin_record.item_count,
                bin_weight_kg=float(bin_record.total_weight_kg),
                contractor_id=contractor.id,
                contractor_name=contractor.name,
                status=HandoffRecordStatus(handoff.status.value),
                scheduled_pickup_at=as_utc(handoff.scheduled_pickup_at),
                picked_up_at=as_utc(handoff.picked_up_at),
                staff_weight_kg=to_float(handoff.staff_weight_kg),
                driver_weight_kg=to_float(handoff.driver_weight_kg),
                weight_variance_percent=to_float(handoff.weight_variance_percent),
                requires_manager_approval=handoff.requires_manager_approval,
                scale_photo_url=scale_photo_api_url(handoff),
                driver_name=handoff.driver_name,
                vehicle_plate_number=handoff.vehicle_plate_number,
                created_by=usernames.get(handoff.created_by_user_id, "Unknown user"),
                approved_by=usernames.get(handoff.approved_by_user_id)
                if handoff.approved_by_user_id
                else None,
                approved_at=as_utc(handoff.approved_at),
                closed_at=as_utc(handoff.closed_at),
                outcomes=outcomes,
            )
        )
    return records


def load_record(session: Session, handoff_id: int) -> HandoffRecord:
    return load_records(session, handoff_id=handoff_id)[0]


def read_scale_photo(upload: UploadFile) -> tuple[bytes, str]:
    content_type = (upload.content_type or "").split(";")[0].strip().lower()
    if content_type not in SCALE_PHOTO_TYPES:
        raise HTTPException(
            status_code=422, detail="The scale photo must be a JPEG, PNG, or WebP image."
        )
    data = upload.file.read(MAX_SCALE_PHOTO_BYTES + 1)
    if len(data) > MAX_SCALE_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="The scale photo must be 5 MB or smaller.")
    extension, matches = SCALE_PHOTO_TYPES[content_type]
    if not matches(data):
        raise HTTPException(
            status_code=422, detail="The scale photo file is not a valid JPEG, PNG, or WebP image."
        )
    return data, extension


@router.get("/options", response_model=HandoffOptionsResponse)
def get_handoff_options(user: ActiveUser, session: SessionDependency) -> HandoffOptionsResponse:
    sites = session.exec(select(Site).where(Site.is_active).order_by(Site.name)).all()
    contractors = session.exec(
        select(Contractor).where(Contractor.is_active).order_by(Contractor.name)
    ).all()

    return HandoffOptionsResponse(
        sites=[HandoffSiteOption(id=site.id, code=site.code, name=site.name) for site in sites],
        contractors=[
            HandoffContractorOption(id=contractor.id, name=contractor.name)
            for contractor in contractors
        ],
    )


@router.get("/bins", response_model=HandoffReadyBinsResponse)
def get_bins_ready_for_handoff(
    user: ActiveUser,
    session: SessionDependency,
    site_id: Annotated[int | None, Query(ge=1)] = None,
) -> HandoffReadyBinsResponse:
    sites = resolve_read_sites(session, user.id, site_id)
    statement = (
        select(Bin, Site)
        .join(Site, Bin.site_id == Site.id)
        .outerjoin(Handoff, Handoff.bin_id == Bin.id)
        .where(
            Bin.bin_type == BinType.RECYCLE,
            Bin.status == BinStatus.READY,
            Handoff.id.is_(None),
            Bin.site_id.in_(sites),
        )
        .order_by(Bin.ready_at, Bin.id)
    )

    return HandoffReadyBinsResponse(
        bins=[
            HandoffReadyBin(
                id=bin_record.id,
                site_id=site.id,
                site_name=site.name,
                code=bin_record.code,
                item_count=bin_record.item_count,
                total_weight_kg=float(bin_record.total_weight_kg),
                ready_at=as_utc(bin_record.ready_at),
            )
            for bin_record, site in session.exec(statement).all()
        ]
    )


@router.get("", response_model=HandoffListResponse)
def list_handoffs(
    user: ActiveUser,
    session: SessionDependency,
    site_id: Annotated[int | None, Query(ge=1)] = None,
    status: HandoffRecordStatus | None = None,
) -> HandoffListResponse:
    sites = resolve_read_sites(session, user.id, site_id)
    return HandoffListResponse(handoffs=load_records(session, site_ids=sites, status=status))


def lock_ready_bin(session: Session, bin_id: int) -> Bin:
    """Lock a recycling bin that is ready and has no handoff yet, or raise 404/409."""

    bin_record = session.exec(select(Bin).where(Bin.id == bin_id).with_for_update()).one_or_none()
    if bin_record is None:
        raise HTTPException(status_code=404, detail="Bin not found.")
    if bin_record.bin_type is not BinType.RECYCLE:
        raise HTTPException(status_code=409, detail="Only recycling bins can be handed off.")
    if bin_record.status is not BinStatus.READY:
        raise HTTPException(status_code=409, detail="This bin is not ready for handoff.")
    existing = session.exec(select(Handoff.id).where(Handoff.bin_id == bin_record.id)).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="This bin already has a handoff.")
    return bin_record


def require_active_contractor(session: Session, contractor_id: int) -> Contractor:
    contractor = session.get(Contractor, contractor_id)
    if contractor is None or not contractor.is_active:
        raise HTTPException(status_code=422, detail="Select an active contractor.")
    return contractor


def commit_handoff(session: Session) -> None:
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="This bin already has a handoff.") from None


def apply_pickup(
    session: Session,
    handoff: Handoff,
    bin_record: Bin,
    *,
    picked_up_at: datetime,
    staff_weight_kg: Decimal,
    driver_weight_kg: Decimal,
    driver_name: str,
    vehicle_plate_number: str,
    scale_photo: UploadFile,
) -> None:
    """Save the scale photo and pickup evidence, then commit; the photo is removed on failure."""

    photo, extension = read_scale_photo(scale_photo)
    relative_path = f"{SCALE_PHOTO_FOLDER}/{uuid.uuid4().hex}{extension}"
    photo_path = get_upload_dir() / relative_path
    photo_path.parent.mkdir(parents=True, exist_ok=True)
    photo_path.write_bytes(photo)
    try:
        handoff.picked_up_at = picked_up_at.astimezone(UTC)
        handoff.scale_photo_url = relative_path
        handoff.driver_name = driver_name
        handoff.vehicle_plate_number = vehicle_plate_number
        # Sets the variance, and Disputed with manager approval when it is above 3%.
        handoff.record_pickup_weights(staff_weight_kg, driver_weight_kg)
        bin_record.status = BinStatus.HANDED_OFF
        session.add_all([handoff, bin_record])
        commit_handoff(session)
    except BaseException:
        session.rollback()
        photo_path.unlink(missing_ok=True)
        raise


@router.post("/pickups", response_model=HandoffRecord, status_code=201)
def record_handoff_at_pickup(
    user: ActiveUser,
    session: SessionDependency,
    bin_id: Annotated[int, Form(gt=0)],
    contractor_id: Annotated[int, Form(gt=0)],
    picked_up_at: Annotated[AwareDatetime, Form()],
    staff_weight_kg: WeightKg,
    driver_weight_kg: WeightKg,
    driver_name: DriverName,
    vehicle_plate_number: PlateNumber,
    scale_photo: Annotated[UploadFile, File(description="Photo of the scale reading")],
) -> HandoffRecord:
    """Create a handoff and its pickup evidence in one transaction, when the driver arrives."""

    if picked_up_at > utc_now() + PICKUP_CLOCK_TOLERANCE:
        raise HTTPException(status_code=422, detail="The pickup time can't be in the future.")
    bin_record = lock_ready_bin(session, bin_id)
    contractor = require_active_contractor(session, contractor_id)
    actor = require_site_staff(session, user.id, bin_record.site_id)

    handoff = Handoff(
        site_id=bin_record.site_id,
        bin_id=bin_record.id,
        contractor_id=contractor.id,
        created_by_user_id=actor.id,
        scheduled_pickup_at=picked_up_at.astimezone(UTC),
    )
    session.add(handoff)
    apply_pickup(
        session,
        handoff,
        bin_record,
        picked_up_at=picked_up_at,
        staff_weight_kg=staff_weight_kg,
        driver_weight_kg=driver_weight_kg,
        driver_name=driver_name,
        vehicle_plate_number=vehicle_plate_number,
        scale_photo=scale_photo,
    )
    return load_record(session, handoff.id)


@router.get("/{handoff_id}/scale-photo", response_class=FileResponse)
def get_scale_photo(handoff_id: int, user: ActiveUser, session: SessionDependency) -> FileResponse:
    handoff = session.get(Handoff, handoff_id)
    if handoff is not None:
        # The photo is part of the handoff record, so it follows the same site rules.
        resolve_read_sites(session, user.id, handoff.site_id)
    stored = handoff.scale_photo_url if handoff else None
    if not stored or not stored.startswith(f"{SCALE_PHOTO_FOLDER}/"):
        raise HTTPException(status_code=404, detail="No uploaded scale photo for this handoff.")
    folder = (get_upload_dir() / SCALE_PHOTO_FOLDER).resolve()
    photo_path = (get_upload_dir() / stored).resolve()
    if photo_path.parent != folder or not photo_path.is_file():
        raise HTTPException(status_code=404, detail="No uploaded scale photo for this handoff.")
    return FileResponse(photo_path)


@router.post("/{handoff_id}/approve", response_model=HandoffRecord)
def approve_disputed_handoff(
    handoff_id: int, user: ManagementUser, session: SessionDependency
) -> HandoffRecord:
    handoff = lock_handoff(session, handoff_id)
    resolve_read_sites(session, user.id, handoff.site_id)
    if handoff.status is not HandoffStatus.DISPUTED:
        raise HTTPException(status_code=409, detail="Only disputed handoffs need approval.")

    handoff.approved_by_user_id = user.id
    handoff.approved_at = utc_now()
    handoff.status = HandoffStatus.APPROVED
    session.add(handoff)
    session.commit()
    return load_record(session, handoff.id)


@router.post("/{handoff_id}/close", response_model=HandoffRecord)
def close_handoff(
    handoff_id: int, user: ManagementUser, session: SessionDependency
) -> HandoffRecord:
    handoff = lock_handoff(session, handoff_id)
    resolve_read_sites(session, user.id, handoff.site_id)
    if handoff.status is HandoffStatus.DISPUTED:
        raise HTTPException(
            status_code=409, detail="A manager must approve this disputed handoff before closing."
        )
    if handoff.status not in (HandoffStatus.PICKED_UP, HandoffStatus.APPROVED):
        raise HTTPException(
            status_code=409, detail="Only picked-up or approved handoffs can be closed."
        )

    # Same rule as the dashboard's "pending": a handoff is reported once its contractor's
    # outcome report has an entry for it.
    has_outcome_report = session.exec(
        select(ContractorReportEntry.id).where(ContractorReportEntry.handoff_id == handoff.id)
    ).first()
    if has_outcome_report is None:
        raise HTTPException(
            status_code=409,
            detail="The contractor's outcome report for this handoff is still pending.",
        )

    closed_at = utc_now()
    bin_record = session.get(Bin, handoff.bin_id)
    handoff.status = HandoffStatus.CLOSED
    handoff.closed_at = closed_at
    bin_record.status = BinStatus.CLOSED
    bin_record.closed_at = closed_at
    session.add_all([handoff, bin_record])
    session.commit()
    return load_record(session, handoff.id)
