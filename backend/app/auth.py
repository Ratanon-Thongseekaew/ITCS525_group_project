from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from .database import get_session
from .models import User
from .schemas import ChangePasswordRequest, LoginRequest, TokenResponse, UserRead, UserRole
from .security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from .user_stores import to_user_read

router = APIRouter(prefix="/api/auth", tags=["auth"])
SessionDependency = Annotated[Session, Depends(get_session)]
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    session: SessionDependency,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    unauthorized = HTTPException(
        status_code=401,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise unauthorized
    user = session.get(User, user_id)
    if user is None:
        raise unauthorized
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_admin(user: CurrentUser) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Administrator access required")
    if user.must_change_password:
        # A temporary password only unlocks the change-password screen.
        raise HTTPException(status_code=403, detail="Password change required")
    return user


AdminUser = Annotated[User, Depends(require_admin)]


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, session: SessionDependency) -> TokenResponse:
    username = payload.username.strip().lower()
    user = session.exec(select(User).where(User.username == username)).first()
    # Always run a password check so unknown usernames take as long as wrong passwords.
    password_ok = verify_password(
        payload.password, user.password_hash if user else DUMMY_PASSWORD_HASH
    )
    if user is None or not password_ok:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return TokenResponse(
        access_token=create_access_token(user.id),
        user=to_user_read(session, user),
    )


@router.get("/me", response_model=UserRead)
def read_current_user(user: CurrentUser, session: SessionDependency) -> UserRead:
    return to_user_read(session, user)


@router.post("/change-password", response_model=UserRead)
def change_password(
    payload: ChangePasswordRequest, user: CurrentUser, session: SessionDependency
) -> UserRead:
    # 400 rather than 401: the person is signed in, so the client must not treat this as an
    # expired session.
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if payload.new_password == payload.current_password:
        raise HTTPException(
            status_code=400, detail="New password must be different from the current one"
        )
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    session.add(user)
    session.commit()
    session.refresh(user)
    return to_user_read(session, user)
