import hashlib
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from .database import get_session
from .models import User
from .schemas import UserCreate, UserRead

router = APIRouter(prefix="/api/users", tags=["users"])
SessionDependency = Annotated[Session, Depends(get_session)]


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1)
    return f"scrypt$16384$8$1${salt.hex()}${digest.hex()}"


@router.post("", response_model=UserRead, status_code=201)
def create_user(payload: UserCreate, session: SessionDependency) -> User:
    user = User(
        username=str(payload.username),
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    session.add(user)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        existing = session.exec(select(User).where(User.username == payload.username)).first()
        if existing is not None:
            raise HTTPException(status_code=409, detail="Username already exists") from None
        raise
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
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user
