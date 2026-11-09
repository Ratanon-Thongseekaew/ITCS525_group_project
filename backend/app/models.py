from sqlalchemy import Column, Enum
from sqlmodel import Field, SQLModel

from .schemas import UserRole


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(max_length=254, unique=True, index=True)
    password_hash: str = Field(max_length=255, repr=False)
    role: UserRole = Field(
        sa_column=Column(
            Enum(UserRole, values_callable=lambda roles: [role.value for role in roles]),
            nullable=False,
        )
    )
