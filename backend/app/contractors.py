"""Administrator management of the recycling contractors that collect recycle bins.

Contractors are deactivated rather than deleted once they have history: handoffs and contractor
reports reference them with ON DELETE RESTRICT. Delete only succeeds for a contractor nothing
refers to, such as one added by mistake.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, select

from .auth import require_admin
from .database import get_session
from .models import Contractor, ContractorReport, Handoff
from .schemas import ContractorCreate, ContractorRead, ContractorUpdate

router = APIRouter(
    prefix="/api/contractors",
    tags=["contractors"],
    dependencies=[Depends(require_admin)],
)
SessionDependency = Annotated[Session, Depends(get_session)]

DUPLICATE_NAME = "A contractor with this name already exists"
HAS_HISTORY = "Contractor has handoffs or reports and cannot be deleted. Deactivate it instead."


def get_contractor_or_404(session: Session, contractor_id: int) -> Contractor:
    contractor = session.get(Contractor, contractor_id)
    if contractor is None:
        raise HTTPException(status_code=404, detail="Contractor not found")
    return contractor


def ensure_name_available(session: Session, name: str, contractor_id: int | None) -> None:
    # Case-insensitive, matching MySQL's default collation so SQLite tests behave the same.
    statement = select(Contractor.id).where(func.lower(Contractor.name) == name.lower())
    if contractor_id is not None:
        statement = statement.where(Contractor.id != contractor_id)
    if session.exec(statement).first() is not None:
        raise HTTPException(status_code=409, detail=DUPLICATE_NAME)


def commit_or_conflict(session: Session) -> None:
    """Commit, turning a race on the unique name constraint into a 409."""
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail=DUPLICATE_NAME) from None


@router.get("", response_model=list[ContractorRead])
def list_contractors(session: SessionDependency) -> list[Contractor]:
    return list(session.exec(select(Contractor).order_by(Contractor.name, Contractor.id)).all())


@router.get("/{contractor_id}", response_model=ContractorRead)
def get_contractor(contractor_id: int, session: SessionDependency) -> Contractor:
    return get_contractor_or_404(session, contractor_id)


@router.post("", response_model=ContractorRead, status_code=201)
def create_contractor(payload: ContractorCreate, session: SessionDependency) -> Contractor:
    ensure_name_available(session, payload.name, None)
    contractor = Contractor(
        name=payload.name,
        contact_name=payload.contact_name,
        contact_email=payload.contact_email,
    )
    session.add(contractor)
    commit_or_conflict(session)
    session.refresh(contractor)
    return contractor


@router.patch("/{contractor_id}", response_model=ContractorRead)
def update_contractor(
    contractor_id: int, payload: ContractorUpdate, session: SessionDependency
) -> Contractor:
    contractor = get_contractor_or_404(session, contractor_id)
    sent = payload.model_fields_set

    if payload.name is not None and payload.name != contractor.name:
        ensure_name_available(session, payload.name, contractor.id)
        contractor.name = payload.name
    # Sending null clears the contact details.
    if "contact_name" in sent:
        contractor.contact_name = payload.contact_name
    if "contact_email" in sent:
        contractor.contact_email = payload.contact_email
    if payload.is_active is not None:
        contractor.is_active = payload.is_active

    session.add(contractor)
    commit_or_conflict(session)
    session.refresh(contractor)
    return contractor


@router.delete("/{contractor_id}", status_code=204)
def delete_contractor(contractor_id: int, session: SessionDependency) -> Response:
    contractor = get_contractor_or_404(session, contractor_id)
    has_handoff = session.exec(
        select(Handoff.id).where(Handoff.contractor_id == contractor.id)
    ).first()
    has_report = session.exec(
        select(ContractorReport.id).where(ContractorReport.contractor_id == contractor.id)
    ).first()
    if has_handoff is not None or has_report is not None:
        raise HTTPException(status_code=409, detail=HAS_HISTORY)

    session.delete(contractor)
    try:
        session.commit()
    except IntegrityError:
        # A handoff or report was added after the check above; the foreign key refuses the delete.
        session.rollback()
        raise HTTPException(status_code=409, detail=HAS_HISTORY) from None
    return Response(status_code=204)
