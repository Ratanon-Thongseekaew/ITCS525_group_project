from datetime import datetime
from decimal import Decimal
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


class UserUpdate(BaseModel):
    """Partial update; omitted or null fields are left unchanged."""

    username: EmailStr | None = Field(default=None, max_length=254)
    password: str | None = Field(default=None, min_length=8, max_length=128, repr=False)
    role: UserRole | None = None

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str | None) -> str | None:
        return value.lower() if value is not None else None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: EmailStr
    role: UserRole


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128, repr=False)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


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


class ContractorDispositionWeights(BaseModel):
    """The six mutually exclusive contractor disposition categories."""

    upcycled_kg: Decimal = Field(ge=0)
    fibre_to_fibre_kg: Decimal = Field(ge=0)
    downcycled_kg: Decimal = Field(ge=0)
    exported_kg: Decimal = Field(ge=0)
    landfilled_kg: Decimal = Field(ge=0)
    incinerated_energy_recovery_kg: Decimal = Field(ge=0)


class ContractorReportValidationRowRequest(BaseModel):
    row: int = Field(ge=1)
    received_kg: Decimal = Field(ge=0)
    dispositions: ContractorDispositionWeights


class ContractorReportValidationRequest(BaseModel):
    rows: list[ContractorReportValidationRowRequest] = Field(min_length=1)


class ContractorReportValidationRowResult(BaseModel):
    row: int
    categorized_weight_kg: float = Field(ge=0)
    uncategorized_weight_kg: float = Field(ge=0)
    is_valid: bool
    errors: list[str]


class ContractorReportValidationResponse(BaseModel):
    rows: list[ContractorReportValidationRowResult]


class DashboardFrequency(StrEnum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUAL = "annual"


class DashboardExceptionStatus(StrEnum):
    PENDING = "pending"
    DISPUTED = "disputed"


class DashboardSiteOption(BaseModel):
    id: int
    code: str
    name: str


class DashboardContractorOption(BaseModel):
    id: int
    name: str


class DashboardFilterOptions(BaseModel):
    sites: list[DashboardSiteOption]
    contractors: list[DashboardContractorOption]
    available_years: list[int]


class DashboardSummary(BaseModel):
    recycling_bins_collected: int = Field(ge=0)
    recycling_bins_reported: int = Field(ge=0)
    pending_bins: int = Field(ge=0)
    disputed_handoffs: int = Field(ge=0)
    recovery_rate: float = Field(ge=0, le=100)
    diverted_weight_kg: float = Field(ge=0)
    total_recorded_weight_kg: float = Field(ge=0)
    total_reported_weight_kg: float = Field(ge=0)
    weight_variance_kg: float


class DashboardOutcome(BaseModel):
    category: str
    weight_kg: float = Field(ge=0)
    percentage: float = Field(ge=0, le=100)


class DashboardMonthlyOutcome(BaseModel):
    month: int = Field(ge=1, le=12)
    month_label: str
    upcycled: float = Field(ge=0)
    fibre_to_fibre: float = Field(ge=0)
    downcycled: float = Field(ge=0)
    exported: float = Field(ge=0)
    landfilled: float = Field(ge=0)
    incinerated_energy_recovery: float = Field(ge=0)


class DashboardException(BaseModel):
    handoff_id: int
    bin_code: str
    contractor_name: str
    handoff_date: datetime
    item_count: int = Field(ge=0)
    staff_weight_kg: float
    driver_weight_kg: float
    variance_percent: float
    has_contractor_report: bool
    status: DashboardExceptionStatus


class DashboardResponse(BaseModel):
    frequency: DashboardFrequency
    year: int
    month: int | None = None
    quarter: int | None = None
    period_label: str
    summary: DashboardSummary
    outcomes: list[DashboardOutcome]
    monthly_outcomes: list[DashboardMonthlyOutcome]
    exceptions: list[DashboardException]
    filters: DashboardFilterOptions
