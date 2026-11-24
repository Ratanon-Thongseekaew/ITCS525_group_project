"""Helpers that connect users to their store (the `user_sites` link) for the API."""

from collections.abc import Iterable

from fastapi import HTTPException
from sqlmodel import Session, select

from .models import Site, User, UserSite
from .schemas import SiteRead, UserRead, UserRole, UserWithTemporaryPassword


def stores_by_user(session: Session, user_ids: Iterable[int]) -> dict[int, SiteRead]:
    """Return each user's store: their default membership, otherwise the lowest site id."""
    ids = list(user_ids)
    if not ids:
        return {}
    rows = session.exec(
        select(UserSite, Site)
        .join(Site, Site.id == UserSite.site_id)
        .where(UserSite.user_id.in_(ids))
        .order_by(UserSite.user_id, UserSite.is_default.desc(), UserSite.site_id)
    ).all()
    stores: dict[int, SiteRead] = {}
    for membership, site in rows:
        stores.setdefault(membership.user_id, SiteRead.model_validate(site))
    return stores


def to_user_read(session: Session, user: User) -> UserRead:
    store = stores_by_user(session, [user.id]).get(user.id)
    return UserRead.model_validate(user).model_copy(update={"store": store})


def to_user_read_list(session: Session, users: list[User]) -> list[UserRead]:
    stores = stores_by_user(session, [user.id for user in users])
    return [
        UserRead.model_validate(user).model_copy(update={"store": stores.get(user.id)})
        for user in users
    ]


def with_temporary_password(
    session: Session, user: User, temporary_password: str | None
) -> UserWithTemporaryPassword:
    return UserWithTemporaryPassword(
        **to_user_read(session, user).model_dump(), temporary_password=temporary_password
    )


def require_active_site(session: Session, site_id: int) -> Site:
    site = session.get(Site, site_id)
    if site is None or not site.is_active:
        raise HTTPException(status_code=422, detail="Selected store does not exist")
    return site


def membership_site_ids(session: Session, user_id: int) -> list[int]:
    return list(session.exec(select(UserSite.site_id).where(UserSite.user_id == user_id)).all())


def assign_store(session: Session, user_id: int, site_id: int | None) -> None:
    """Make `site_id` the user's only store (or remove all stores when it is None).

    Existing memberships for other sites are removed; the caller commits.
    """
    memberships = session.exec(select(UserSite).where(UserSite.user_id == user_id)).all()
    keep: UserSite | None = None
    for membership in memberships:
        if site_id is not None and membership.site_id == site_id and keep is None:
            keep = membership
        else:
            session.delete(membership)
    if site_id is None:
        return
    if keep is None:
        session.add(UserSite(user_id=user_id, site_id=site_id, is_default=True))
    elif not keep.is_default:
        keep.is_default = True
        session.add(keep)


def validate_store_for_role(role: UserRole, site_id: int | None) -> None:
    if role == UserRole.STAFF and site_id is None:
        raise HTTPException(status_code=422, detail="Staff must be assigned to exactly one store")
    if role == UserRole.ADMIN and site_id is not None:
        raise HTTPException(status_code=422, detail="Administrators are not assigned to a store")
