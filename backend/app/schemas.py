from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserRole(StrEnum):
    ADMIN = "admin"
    MANAGER = "manager"
    STAFF = "staff"


class UserCreate(BaseModel):
    username: EmailStr = Field(max_length=254)
    password: str = Field(min_length=8, max_length=128, repr=False)
    role: UserRole

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.lower()


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: EmailStr
    role: UserRole


class HealthCheck(BaseModel):
    status: str


class Greeting(BaseModel):
    message: str


class BinType(StrEnum):
    RESALE = "resale"
    RECYCLE = "recycle"


class BinStatus(StrEnum):
    ACTIVE = "active"
    CLOSED = "closed"


class GarmentCondition(StrEnum):
    GOOD_REUSABLE = "good_reusable"
    WORN_RECYCLABLE = "worn_recyclable"


class GarmentSortRequest(BaseModel):
    condition: GarmentCondition
    category: str = "Tops"
    weight_kg: float | None = Field(default=None, ge=0.0)
    notes: str | None = None
    bin_id: str | None = None


class GarmentItem(BaseModel):
    id: str
    condition: GarmentCondition
    category: str
    bin_id: str
    bin_code: str
    weight_kg: float | None = None
    notes: str | None = None
    created_at: datetime


class BinRecord(BaseModel):
    id: str
    bin_code: str
    bin_type: BinType
    status: BinStatus
    item_count: int = 0
    total_weight_kg: float = 0.0
    max_capacity: int = 50
    created_at: datetime
    closed_at: datetime | None = None
    notes: str | None = None


class BinCreateRequest(BaseModel):
    bin_type: BinType
    bin_code: str | None = None
    max_capacity: int = 50
    notes: str | None = None


class BinCloseRequest(BaseModel):
    notes: str | None = None


class ActiveBinsResponse(BaseModel):
    resale_bin: BinRecord | None = None
    recycle_bin: BinRecord | None = None


class SortingStatsResponse(BaseModel):
    total_sorted_today: int
    resale_count: int
    recycle_count: int
    resale_percentage: float
    active_resale_bin_code: str | None = None
    active_resale_bin_items: int = 0
    active_recycle_bin_code: str | None = None
    active_recycle_bin_items: int = 0


class SortGarmentResponse(BaseModel):
    garment: GarmentItem
    bin: BinRecord
    message: str
