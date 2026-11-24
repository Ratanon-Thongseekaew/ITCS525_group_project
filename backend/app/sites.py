from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from .auth import require_admin
from .database import get_session
from .models import Site
from .schemas import SiteRead

# Used by the administrator's user form to choose a store.
router = APIRouter(
    prefix="/api/sites",
    tags=["sites"],
    dependencies=[Depends(require_admin)],
)
SessionDependency = Annotated[Session, Depends(get_session)]


@router.get("", response_model=list[SiteRead])
def list_sites(session: SessionDependency) -> list[Site]:
    return list(session.exec(select(Site).where(Site.is_active).order_by(Site.name, Site.id)).all())
