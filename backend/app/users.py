from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, select

from .auth import AdminUser, require_admin
from .database import get_session
from .models import User, UserSite
from .schemas import UserCreate, UserRead, UserRole, UserUpdate, UserWithTemporaryPassword
from .security import generate_temporary_password, hash_password
from .user_stores import (
    assign_store,
    membership_site_ids,
    require_active_site,
    to_user_read,
    to_user_read_list,
    validate_store_for_role,
    with_temporary_password,
)

# Every user-management route is administrator-only.
router = APIRouter(
    prefix="/api/users",
    tags=["users"],
    dependencies=[Depends(require_admin)],
)
SessionDependency = Annotated[Session, Depends(get_session)]


def get_user_or_404(session: Session, user_id: int) -> User:
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def ensure_another_admin_exists(session: Session, user: User) -> None:
    other_admins = session.exec(
        select(func.count())
        .select_from(User)
        .where(User.role == UserRole.ADMIN, User.id != user.id)
    ).one()
    if other_admins == 0:
        raise HTTPException(status_code=400, detail="Cannot remove the last administrator")


def commit_or_conflict(
    session: Session, username: str, user_id: int | None, *, flush_only: bool = False
) -> None:
    """Commit (or just flush), turning a duplicate-username integrity error into a 409."""
    try:
        if flush_only:
            session.flush()
        else:
            session.commit()
    except IntegrityError:
        session.rollback()
        clash = session.exec(select(User).where(User.username == username)).first()
        if clash is not None and clash.id != user_id:
            raise HTTPException(status_code=409, detail="Username already exists") from None
        raise


@router.post("", response_model=UserWithTemporaryPassword, status_code=201)
def create_user(
    payload: UserCreate, session: SessionDependency, response: Response
) -> UserWithTemporaryPassword:
    if payload.site_id is not None:
        require_active_site(session, payload.site_id)

    # Without a password the server generates a temporary one; the person must replace it
    # at first login. It is returned in this response only and is never stored in plain text.
    temporary_password: str | None = None
    password = payload.password
    if password is None:
        password = temporary_password = generate_temporary_password()

    user = User(
        username=str(payload.username),
        password_hash=hash_password(password),
        role=payload.role,
        full_name=payload.full_name,
        must_change_password=temporary_password is not None,
    )
    session.add(user)
    commit_or_conflict(session, user.username, None, flush_only=True)
    if payload.site_id is not None:
        session.add(UserSite(user_id=user.id, site_id=payload.site_id, is_default=True))
    session.commit()
    session.refresh(user)

    if temporary_password is not None:
        response.headers["Cache-Control"] = "no-store"
    return with_temporary_password(session, user, temporary_password)


@router.get("", response_model=list[UserRead])
def list_users(
    session: SessionDependency,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
) -> list[UserRead]:
    users = list(session.exec(select(User).order_by(User.id).offset(offset).limit(limit)).all())
    return to_user_read_list(session, users)


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int, session: SessionDependency) -> UserRead:
    return to_user_read(session, get_user_or_404(session, user_id))


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int, payload: UserUpdate, session: SessionDependency, current_user: AdminUser
) -> UserRead:
    user = get_user_or_404(session, user_id)
    changes = payload.model_dump(exclude_none=True)
    sent = payload.model_fields_set

    new_role = changes.get("role")
    if new_role is not None and user.role == UserRole.ADMIN and new_role != UserRole.ADMIN:
        ensure_another_admin_exists(session, user)

    # Work out the store change first so nothing is modified if a rule is broken.
    final_role = new_role if new_role is not None else user.role
    role_changed = new_role is not None and new_role != user.role
    store_changes = False
    new_site_id: int | None = None
    if "site_id" in sent or role_changed:
        existing_sites = membership_site_ids(session, user.id)
        if final_role == UserRole.ADMIN:
            validate_store_for_role(final_role, payload.site_id if "site_id" in sent else None)
            store_changes = bool(existing_sites)
        elif "site_id" in sent:
            validate_store_for_role(final_role, payload.site_id)
            if payload.site_id is not None:
                require_active_site(session, payload.site_id)
            store_changes = True
            new_site_id = payload.site_id
        elif final_role == UserRole.STAFF and len(existing_sites) != 1:
            raise HTTPException(
                status_code=422, detail="Staff must be assigned to exactly one store"
            )

    if "username" in changes:
        user.username = str(changes["username"])
    if "password" in changes:
        user.password_hash = hash_password(changes["password"])
        # The admin now knows this password, so the person must replace it at next login.
        # Administrators changing their own password are not forced to.
        if user.id != current_user.id:
            user.must_change_password = True
    if "full_name" in sent:
        user.full_name = payload.full_name
    if new_role is not None:
        user.role = new_role

    session.add(user)
    commit_or_conflict(session, user.username, user.id, flush_only=True)
    if store_changes:
        assign_store(session, user.id, new_site_id)
    session.commit()
    session.refresh(user)
    return to_user_read(session, user)


@router.post("/{user_id}/reset-password", response_model=UserWithTemporaryPassword)
def reset_password(
    user_id: int, session: SessionDependency, current_user: AdminUser, response: Response
) -> UserWithTemporaryPassword:
    user = get_user_or_404(session, user_id)
    if user.id == current_user.id:
        raise HTTPException(
            status_code=400, detail="Use change password to update your own account"
        )
    temporary_password = generate_temporary_password()
    user.password_hash = hash_password(temporary_password)
    user.must_change_password = True
    session.add(user)
    session.commit()
    session.refresh(user)
    response.headers["Cache-Control"] = "no-store"
    return with_temporary_password(session, user, temporary_password)


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, session: SessionDependency, current_user: AdminUser) -> Response:
    user = get_user_or_404(session, user_id)
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    session.delete(user)
    try:
        session.commit()
    except IntegrityError:
        # Bins, garment records, handoffs and reports reference users with ON DELETE RESTRICT.
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail="User has recorded activity and cannot be deleted",
        ) from None
    return Response(status_code=204)
