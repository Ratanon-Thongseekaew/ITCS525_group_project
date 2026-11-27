from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)


class UserRole(StrEnum):
    ADMIN = "admin"
    MANAGER = "manager"
    STAFF = "staff"


class SiteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str


def _clean_full_name(value: str | None) -> str | None:
    """Trim whitespace; a blank name means "no name"."""
    if value is None:
        return None
    return value.strip() or None


class UserCreate(BaseModel):
    username: EmailStr = Field(max_length=254)
    # Omit the password to have the server generate a temporary one (returned once).
    password: str | None = Field(default=None, min_length=8, max_length=128, repr=False)
    role: UserRole
    full_name: str | None = Field(default=None, max_length=120)
    # Staff need exactly one store, managers may have one, administrators have none.
    site_id: int | None = Field(default=None, ge=1)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.lower()

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str | None) -> str | None:
        return _clean_full_name(value)

    @model_validator(mode="after")
    def check_store_for_role(self) -> "UserCreate":
        if self.role == UserRole.STAFF and self.site_id is None:
            raise ValueError("Staff must be assigned to a store")
        if self.role == UserRole.ADMIN and self.site_id is not None:
            raise ValueError("Administrators are not assigned to a store")
        return self


class UserUpdate(BaseModel):
    """Partial update; omitted or null fields are left unchanged.

    Exceptions: sending ``full_name: null`` clears the name, and sending ``site_id: null``
    removes the store (not allowed for staff).
    """

    username: EmailStr | None = Field(default=None, max_length=254)
    password: str | None = Field(default=None, min_length=8, max_length=128, repr=False)
    role: UserRole | None = None
    full_name: str | None = Field(default=None, max_length=120)
    site_id: int | None = Field(default=None, ge=1)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str | None) -> str | None:
        return value.lower() if value is not None else None

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str | None) -> str | None:
        return _clean_full_name(value)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    # Not EmailStr: saved accounts, such as seeded ones, must always be readable.
    username: str
    role: UserRole
    full_name: str | None = None
    must_change_password: bool = False
    store: SiteRead | None = None


class UserWithTemporaryPassword(UserRead):
    """Returned once when the server generates a password; it is never stored or shown again."""

    temporary_password: str | None = None


def _clean_contact_text(value: object) -> object:
    """Trim text and treat blank text as "not set". Other types are left for Pydantic to reject."""
    if isinstance(value, str):
        return value.strip() or None
    return value


def _clean_contact_email(value: object) -> object:
    cleaned = _clean_contact_text(value)
    return cleaned.lower() if isinstance(cleaned, str) else cleaned


ContractorName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)
]


class ContractorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    contact_name: str | None = None
    # Not EmailStr: saved contractors, such as seeded ones, must always be readable.
    contact_email: str | None = None
    is_active: bool


class ContractorCreate(BaseModel):
    name: ContractorName
    contact_name: str | None = Field(default=None, max_length=120)
    contact_email: EmailStr | None = Field(default=None, max_length=255)

    @field_validator("contact_name", mode="before")
    @classmethod
    def normalize_contact_name(cls, value: object) -> object:
        return _clean_contact_text(value)

    @field_validator("contact_email", mode="before")
    @classmethod
    def normalize_contact_email(cls, value: object) -> object:
        return _clean_contact_email(value)


class ContractorUpdate(BaseModel):
    """Partial update; omitted fields are left unchanged.

    Sending ``contact_name: null`` or ``contact_email: null`` clears that field. ``name: null``
    and ``is_active: null`` are ignored.
    """

    name: ContractorName | None = None
    contact_name: str | None = Field(default=None, max_length=120)
    contact_email: EmailStr | None = Field(default=None, max_length=255)
    is_active: bool | None = None

    @field_validator("contact_name", mode="before")
    @classmethod
    def normalize_contact_name(cls, value: object) -> object:
        return _clean_contact_text(value)

    @field_validator("contact_email", mode="before")
    @classmethod
    def normalize_contact_email(cls, value: object) -> object:
        return _clean_contact_email(value)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128, repr=False)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128, repr=False)
    new_password: str = Field(min_length=8, max_length=128, repr=False)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class HealthCheck(BaseModel):
    status: str


class Greeting(BaseModel):
    message: str


class ResaleStoreSummary(BaseModel):
    id: int
    name: str
    actual_value: float = Field(ge=0)


class ResaleStoreSummaryResponse(BaseModel):
    stores: list[ResaleStoreSummary]


class BinType(StrEnum):
    RESALE = "resale"
    RECYCLE = "recycle"
    REPAIR = "repair"


class BinStatus(StrEnum):
    ACTIVE = "active"
    READY = "ready"
    HANDED_OFF = "handed_off"
    CLOSED = "closed"


class GarmentCondition(StrEnum):
    GOOD_REUSABLE = "good_reusable"
    WORN_RECYCLABLE = "worn_recyclable"
    REPAIR_UPCYCLE = "repair_upcycle"


ShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]


class GarmentSortRequest(BaseModel):
    actor_id: int = Field(gt=0)
    condition: GarmentCondition
    category: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)
    ] = "Tops"
    # A single garment never weighs this much; the cap catches a mistyped grams value.
    weight_kg: float | None = Field(default=None, ge=0.0, le=50.0)
    notes: ShortText | None = None
    bin_id: int | None = Field(default=None, gt=0)


class GarmentItem(BaseModel):
    id: int
    site_id: int
    site_name: str
    condition: GarmentCondition
    category: str
    bin_id: int
    bin_code: str
    weight_kg: float | None = None
    notes: str | None = None
    created_at: datetime


class BinRecord(BaseModel):
    id: int
    site_id: int
    site_name: str
    bin_code: str
    bin_type: BinType
    status: BinStatus
    item_count: int = 0
    total_weight_kg: float = 0.0
    max_capacity: int = 50
    created_at: datetime
    ready_at: datetime | None = None
    closed_at: datetime | None = None
    notes: str | None = None


class ResaleProcessRequest(BaseModel):
    actor_id: int = Field(gt=0)
    accepted_item_count: int = Field(ge=0)
    rejected_item_count: int = Field(ge=0)
    revenue: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    processed_at: date
    notes: ShortText | None = None


class ResaleBinRecord(BaseModel):
    id: int
    bin_code: str
    item_count: int
    total_weight_kg: float
    packed_at: datetime
    status: Literal["awaiting_process", "processed"]
    accepted_item_count: int | None = None
    rejected_item_count: int | None = None
    revenue: float | None = None
    processed_at: date | None = None
    notes: str | None = None


class BinCreateRequest(BaseModel):
    actor_id: int = Field(gt=0)
    bin_type: BinType
    bin_code: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)] | None
    ) = None
    max_capacity: int = Field(default=50, ge=1, le=500)
    notes: ShortText | None = None


class SortingSite(BaseModel):
    id: int
    code: str
    name: str


class BinCloseRequest(BaseModel):
    actor_id: int = Field(gt=0)
    notes: ShortText | None = None


class ActiveBinsResponse(BaseModel):
    resale_bin: BinRecord | None = None
    recycle_bin: BinRecord | None = None
    repair_bin: BinRecord | None = None


class SortingStatsResponse(BaseModel):
    total_sorted_today: int
    resale_count: int
    recycle_count: int
    repair_count: int
    resale_percentage: float
    active_resale_bin_code: str | None = None
    active_resale_bin_items: int = 0
    active_recycle_bin_code: str | None = None
    active_recycle_bin_items: int = 0
    active_repair_bin_code: str | None = None
    active_repair_bin_items: int = 0


class SortGarmentResponse(BaseModel):
    garment: GarmentItem
    bin: BinRecord
    message: str


# Weights are stored as NUMERIC(12, 3), so a report weight must stay below one billion kg.
MAX_REPORT_WEIGHT_KG = Decimal("1000000000")
ReportWeight = Annotated[Decimal, Field(ge=0, lt=MAX_REPORT_WEIGHT_KG)]


class ContractorDispositionWeights(BaseModel):
    """The six mutually exclusive contractor disposition categories."""

    upcycled_kg: ReportWeight
    fibre_to_fibre_kg: ReportWeight
    downcycled_kg: ReportWeight
    exported_kg: ReportWeight
    landfilled_kg: ReportWeight
    incinerated_energy_recovery_kg: ReportWeight


class EprQuarterReportResponse(BaseModel):
    year: int
    quarter: int
    source: Literal["live_records", "submitted_snapshot"]
    total_weight_received_kg: float
    resold_weight_kg: float
    repaired_weight_kg: float
    upcycled_weight_kg: float
    fibre_to_fibre_weight_kg: float
    downcycled_weight_kg: float
    exported_weight_kg: float
    landfilled_weight_kg: float
    incinerated_energy_recovery_weight_kg: float
    uncategorized_weight_kg: float
    excess_weight_kg: float
    recovery_rate_percent: float
    garments_missing_weight: int | None


class EprAdjustmentMetric(StrEnum):
    TOTAL_RECEIVED = "total_received"
    RESOLD = "resold"
    REPAIRED = "repaired"
    UPCYCLED = "upcycled"
    FIBRE_TO_FIBRE = "fibre_to_fibre"
    DOWNCYCLED = "downcycled"
    EXPORTED = "exported"
    LANDFILLED = "landfilled"
    INCINERATED_ENERGY_RECOVERY = "incinerated_energy_recovery"


class EprSubmitRequest(BaseModel):
    actor_id: int = Field(gt=0)


class EprAdjustmentLine(BaseModel):
    metric: EprAdjustmentMetric
    weight_delta_kg: Decimal = Field(max_digits=14, decimal_places=3)

    @field_validator("weight_delta_kg")
    @classmethod
    def require_nonzero_weight(cls, value: Decimal) -> Decimal:
        if not value:
            raise ValueError("Adjustment weight must be nonzero")
        return value


class EprAdjustmentRequest(EprSubmitRequest):
    site_id: int = Field(gt=0)
    expected_latest_adjustment_id: int | None = Field(ge=1)
    effective_date: date
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
    lines: list[EprAdjustmentLine] = Field(min_length=1, max_length=len(EprAdjustmentMetric))

    @field_validator("lines")
    @classmethod
    def require_distinct_metrics(cls, lines: list[EprAdjustmentLine]) -> list[EprAdjustmentLine]:
        if len({line.metric for line in lines}) != len(lines):
            raise ValueError("Choose a different metric for each adjustment line")
        return lines


class EprManagementOption(BaseModel):
    id: int
    label: str


class EprAdjustmentResponse(BaseModel):
    id: int
    site_id: int
    metric: EprAdjustmentMetric
    weight_delta_kg: float
    effective_date: date
    reason: str
    created_at: datetime
    recorded_by: str


class EprManagementResponse(BaseModel):
    report: EprQuarterReportResponse
    status: Literal["draft", "submitted"]
    submitted_at: datetime | None
    submitted_by: str | None
    adjusted_report: EprQuarterReportResponse | None
    adjustments: list[EprAdjustmentResponse]
    sites: list[EprManagementOption]
    actors: list[EprManagementOption]


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
    # Inactive contractors stay in the filter so their past data can still be viewed.
    is_active: bool


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


class ContractorReportOptionItem(BaseModel):
    id: int
    name: str


class ContractorReportOptionsResponse(BaseModel):
    contractors: list[ContractorReportOptionItem]


ReportMonth = Annotated[str, StringConstraints(pattern=r"^\d{4}-\d{2}(-\d{2})?$")]


class ContractorReportFileParseRequest(BaseModel):
    actor_id: int = Field(gt=0)  # A manager or admin, until the API reads the login token
    filename: str = Field(min_length=1, max_length=255)
    content_base64: str = Field(min_length=1)
    # When given, rows not picked up in this month, or by this contractor, are rejected.
    report_month: ReportMonth | None = None
    contractor_id: int | None = Field(default=None, gt=0)


class ContractorReportParsedRow(BaseModel):
    row: int = Field(ge=1)  # The spreadsheet line number (the header is line 1)
    bin_id: str
    site_name: str | None = None  # The bin's sorting center; None when the bin wasn't found.
    staff_weight_kg: float | None = None  # Weighed by store staff at pickup, from the handoff
    received_kg: float = Field(ge=0)
    dispositions: ContractorDispositionWeights
    categorized_weight_kg: float = Field(ge=0)
    uncategorized_weight_kg: float = Field(ge=0)
    status: Literal["Verified", "Warning", "Error"]
    errors: list[str]  # Why the row is rejected; empty unless status is "Error"
    warnings: list[str]  # What to check before saving; the row can still be saved


class ContractorReportFileParseResponse(BaseModel):
    filename: str
    rows: list[ContractorReportParsedRow]


class ContractorReportImportRowRequest(BaseModel):
    row: int = Field(ge=1)
    bin_id: str = Field(min_length=1, max_length=64)
    received_kg: ReportWeight
    dispositions: ContractorDispositionWeights


class ContractorReportImportRequest(BaseModel):
    actor_id: int = Field(gt=0)  # A manager or admin, recorded as the uploader
    contractor_id: int = Field(gt=0)
    report_month: ReportMonth
    source_filename: str = Field(min_length=1, max_length=255)
    rows: list[ContractorReportImportRowRequest] = Field(min_length=1)


class ContractorReportImportSiteResult(BaseModel):
    report_id: int
    site_id: int
    site_name: str
    imported_rows: int


class ContractorReportImportResponse(BaseModel):
    reports: list[ContractorReportImportSiteResult]  # One per sorting center in the file.
    contractor_name: str
    report_month: date
    imported_rows: int
    total_received_kg: float
    total_categorized_weight_kg: float
    message: str


# -------------------------------------------------------------------------
# Recycle bin handoff
# -------------------------------------------------------------------------


class HandoffRecordStatus(StrEnum):
    """Mirrors ``models.HandoffStatus``; models imports from this module, not the reverse."""

    SCHEDULED = "scheduled"
    PICKED_UP = "picked_up"
    DISPUTED = "disputed"
    APPROVED = "approved"
    CLOSED = "closed"


class HandoffSiteOption(BaseModel):
    id: int
    code: str
    name: str


class HandoffContractorOption(BaseModel):
    id: int
    name: str


class HandoffActorOption(BaseModel):
    id: int
    username: str
    role: UserRole
    site_ids: list[int]


class HandoffOptionsResponse(BaseModel):
    sites: list[HandoffSiteOption]
    contractors: list[HandoffContractorOption]
    actors: list[HandoffActorOption]


class HandoffReadyBin(BaseModel):
    id: int
    site_id: int
    site_name: str
    code: str
    item_count: int = Field(ge=0)
    total_weight_kg: float = Field(ge=0)
    ready_at: datetime | None


class HandoffReadyBinsResponse(BaseModel):
    bins: list[HandoffReadyBin]


class HandoffActorRequest(BaseModel):
    actor_id: int = Field(gt=0)


class HandoffOutcomes(BaseModel):
    upcycled_weight_kg: float
    fibre_to_fibre_weight_kg: float
    downcycled_weight_kg: float
    exported_weight_kg: float
    landfilled_weight_kg: float
    incinerated_energy_recovery_weight_kg: float


class HandoffRecord(BaseModel):
    id: int
    site_id: int
    site_name: str
    bin_id: int
    bin_code: str
    item_count: int = Field(ge=0)
    bin_weight_kg: float = Field(ge=0)
    contractor_id: int
    contractor_name: str
    status: HandoffRecordStatus
    scheduled_pickup_at: datetime | None
    picked_up_at: datetime | None
    staff_weight_kg: float | None
    driver_weight_kg: float | None
    weight_variance_percent: float | None
    requires_manager_approval: bool
    scale_photo_url: str | None
    driver_name: str | None
    vehicle_plate_number: str | None
    created_by: str
    approved_by: str | None
    approved_at: datetime | None
    closed_at: datetime | None
    outcomes: HandoffOutcomes | None


class HandoffListResponse(BaseModel):
    handoffs: list[HandoffRecord]
