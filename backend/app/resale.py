from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlmodel import Session, select

from .database import get_session
from .models import Bin, BinType, Site
from .schemas import ResaleStoreSummary, ResaleStoreSummaryResponse

router = APIRouter(prefix="/api/resale-bins", tags=["resale bins"])
SessionDependency = Annotated[Session, Depends(get_session)]


@router.get("/summary", response_model=ResaleStoreSummaryResponse)
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
