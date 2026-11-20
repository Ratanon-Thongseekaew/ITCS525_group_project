from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, select

from .auth import AdminUser, require_admin
from .database import get_session
from .models import User
from .schemas import UserCreate, UserRead, UserRole, UserUpdate
from .security import hash_password

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


def commit_or_conflict(session: Session, username: str, user_id: int | None) -> None:
    """Commit, turning a duplicate-username integrity error into a 409."""
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        clash = session.exec(select(User).where(User.username == username)).first()
        if clash is not None and clash.id != user_id:
            raise HTTPException(status_code=409, detail="Username already exists") from None
        raise


@router.post("", response_model=UserRead, status_code=201)
def create_user(payload: UserCreate, session: SessionDependency) -> User:
    user = User(
        username=str(payload.username),
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    session.add(user)
    commit_or_conflict(session, user.username, None)
    session.refresh(user)
    return user


@router.get("", response_model=list[UserRead])
def list_users(
    session: SessionDependency,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
) -> list[User]:
    return list(session.exec(select(User).order_by(User.id).offset(offset).limit(limit)).all())


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int, session: SessionDependency) -> User:
    return get_user_or_404(session, user_id)


@router.patch("/{user_id}", response_model=UserRead)
def update_user(user_id: int, payload: UserUpdate, session: SessionDependency) -> User:
    user = get_user_or_404(session, user_id)
    changes = payload.model_dump(exclude_none=True)

    new_role = changes.get("role")
    if new_role is not None and user.role == UserRole.ADMIN and new_role != UserRole.ADMIN:
        ensure_another_admin_exists(session, user)

    if "username" in changes:
        user.username = str(changes["username"])
    if "password" in changes:
        user.password_hash = hash_password(changes["password"])
    if new_role is not None:
        user.role = new_role

    session.add(user)
    commit_or_conflict(session, user.username, user.id)
    session.refresh(user)
    return user


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
