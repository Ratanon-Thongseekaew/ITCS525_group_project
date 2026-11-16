from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy import Enum as SAEnum
from sqlmodel import Field, SQLModel

from .schemas import UserRole


def utc_now() -> datetime:
    return datetime.now(UTC)


def enum_column(enum_type: type[StrEnum], *, length: int) -> Column:
    return Column(
        SAEnum(
            enum_type,
            values_callable=lambda values: [value.value for value in values],
            native_enum=False,
            length=length,
        ),
        nullable=False,
    )


class BinType(StrEnum):
    RESALE = "resale"
    RECYCLE = "recycle"
    REPAIR = "repair"


class BinStatus(StrEnum):
    ACTIVE = "active"
    READY = "ready"
    HANDED_OFF = "handed_off"
    CLOSED = "closed"


class GarmentOutcome(StrEnum):
    RESALE = "resale"
    RECYCLE = "recycle"
    REPAIR_UPCYCLE = "repair_upcycle"


class HandoffStatus(StrEnum):
    SCHEDULED = "scheduled"
    PICKED_UP = "picked_up"
    DISPUTED = "disputed"
    APPROVED = "approved"
    CLOSED = "closed"


class ReportStatus(StrEnum):
    UPLOADED = "uploaded"
    INVALID = "invalid"
    VALIDATED = "validated"
    IMPORTED = "imported"


class EvidenceStatus(StrEnum):
    CONTRACTOR_DECLARED = "contractor_declared"
    ESTIMATED = "estimated"
    PENDING = "pending"
    UNKNOWN = "unknown"
    VERIFIED = "verified"


class DispositionCategory(StrEnum):
    UPCYCLED = "upcycled"
    FIBRE_TO_FIBRE = "fibre_to_fibre"
    DOWNCYCLED = "downcycled"
    EXPORTED = "exported"
    LANDFILLED = "landfilled"
    INCINERATED_ENERGY_RECOVERY = "incinerated_energy_recovery"


class EprReportStatus(StrEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"


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


class TimestampMixin(SQLModel):
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={"nullable": False, "server_default": func.now()},
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={
            "nullable": False,
            "server_default": func.now(),
            "onupdate": func.now(),
        },
    )


class Site(TimestampMixin, table=True):
    __tablename__ = "sites"
    __table_args__ = (UniqueConstraint("code", name="uq_sites_code"),)

    id: int | None = Field(default=None, primary_key=True)
    code: str = Field(max_length=32, index=True)
    name: str = Field(max_length=120)
    timezone_name: str = Field(default="Asia/Bangkok", max_length=64)
    is_active: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, server_default="1"),
    )


class User(SQLModel, table=True):
    """Existing user model kept compatible with the merged /api/users routes."""

    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(max_length=254, unique=True, index=True)
    password_hash: str = Field(max_length=255, repr=False)
    role: UserRole = Field(sa_column=enum_column(UserRole, length=16))


class UserSite(SQLModel, table=True):
    __tablename__ = "user_sites"
    __table_args__ = (UniqueConstraint("user_id", "site_id", name="uq_user_sites_user_site"),)

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    site_id: int = Field(foreign_key="sites.id", ondelete="CASCADE", index=True)
    is_default: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default="0"),
    )


class Contractor(TimestampMixin, table=True):
    __tablename__ = "contractors"
    __table_args__ = (UniqueConstraint("name", name="uq_contractors_name"),)

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=160)
    contact_name: str | None = Field(default=None, max_length=120)
    contact_email: str | None = Field(default=None, max_length=255)
    is_active: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, server_default="1"),
    )


class Bin(TimestampMixin, table=True):
    __tablename__ = "bins"
    __table_args__ = (
        UniqueConstraint("site_id", "code", name="uq_bins_site_code"),
        CheckConstraint("item_count >= 0", name="ck_bins_item_count_nonnegative"),
        CheckConstraint("total_weight_kg >= 0", name="ck_bins_weight_nonnegative"),
        CheckConstraint("max_capacity > 0", name="ck_bins_capacity_positive"),
    )

    id: int | None = Field(default=None, primary_key=True)
    site_id: int = Field(foreign_key="sites.id", ondelete="RESTRICT", index=True)
    code: str = Field(max_length=64)
    bin_type: BinType = Field(sa_column=enum_column(BinType, length=16))
    status: BinStatus = Field(
        default=BinStatus.ACTIVE,
        sa_column=enum_column(BinStatus, length=16),
    )
    item_count: int = Field(default=0)
    total_weight_kg: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(Numeric(12, 3), nullable=False),
    )
    max_capacity: int = Field(default=50)
    estimated_value: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(12, 2), nullable=True),
    )
    actual_value: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(12, 2), nullable=True),
    )
    currency_code: str = Field(default="THB", max_length=3)
    notes: str | None = Field(default=None, sa_column=Column(String(500), nullable=True))
    ready_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    closed_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))


class GarmentRecord(TimestampMixin, table=True):
    __tablename__ = "garment_records"
    __table_args__ = (
        UniqueConstraint(
            "site_id",
            "external_reference",
            name="uq_garment_records_site_reference",
        ),
        CheckConstraint(
            "weight_kg IS NULL OR weight_kg >= 0",
            name="ck_garment_records_weight_nonnegative",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    site_id: int = Field(foreign_key="sites.id", ondelete="RESTRICT", index=True)
    recorded_by_user_id: int = Field(foreign_key="users.id", ondelete="RESTRICT", index=True)
    bin_id: int = Field(foreign_key="bins.id", ondelete="RESTRICT", index=True)
    external_reference: str | None = Field(default=None, max_length=80)
    category: str = Field(default="Tops", max_length=80)
    outcome: GarmentOutcome = Field(sa_column=enum_column(GarmentOutcome, length=24))
    weight_kg: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(10, 3), nullable=True),
    )
    received_at: datetime = Field(sa_type=DateTime(timezone=True), index=True)
    notes: str | None = Field(default=None, sa_column=Column(String(500), nullable=True))


class Handoff(TimestampMixin, table=True):
    __tablename__ = "handoffs"
    __table_args__ = (
        UniqueConstraint("bin_id", name="uq_handoffs_bin"),
        CheckConstraint(
            "staff_weight_kg IS NULL OR staff_weight_kg >= 0",
            name="ck_handoffs_staff_weight_nonnegative",
        ),
        CheckConstraint(
            "driver_weight_kg IS NULL OR driver_weight_kg >= 0",
            name="ck_handoffs_driver_weight_nonnegative",
        ),
        CheckConstraint(
            "weight_variance_percent IS NULL OR weight_variance_percent >= 0",
            name="ck_handoffs_variance_nonnegative",
        ),
        CheckConstraint(
            "status <> 'closed' OR NOT requires_manager_approval "
            "OR approved_by_user_id IS NOT NULL",
            name="ck_handoffs_dispute_approval_before_close",
        ),
        CheckConstraint(
            "status = 'scheduled' OR (picked_up_at IS NOT NULL "
            "AND staff_weight_kg IS NOT NULL AND driver_weight_kg IS NOT NULL "
            "AND scale_photo_url IS NOT NULL AND scale_photo_url <> '' "
            "AND driver_name IS NOT NULL AND driver_name <> '' "
            "AND vehicle_plate_number IS NOT NULL AND vehicle_plate_number <> '')",
            name="ck_handoffs_pickup_evidence_required",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    site_id: int = Field(foreign_key="sites.id", ondelete="RESTRICT", index=True)
    bin_id: int = Field(foreign_key="bins.id", ondelete="RESTRICT", index=True)
    contractor_id: int = Field(foreign_key="contractors.id", ondelete="RESTRICT", index=True)
    created_by_user_id: int = Field(foreign_key="users.id", ondelete="RESTRICT", index=True)
    scheduled_pickup_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    picked_up_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    staff_weight_kg: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(12, 3), nullable=True),
    )
    driver_weight_kg: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(12, 3), nullable=True),
    )
    weight_variance_percent: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(7, 4), nullable=True),
    )
    scale_photo_url: str | None = Field(default=None, max_length=500)
    driver_name: str | None = Field(default=None, max_length=120)
    vehicle_plate_number: str | None = Field(default=None, max_length=32)
    status: HandoffStatus = Field(
        default=HandoffStatus.SCHEDULED,
        sa_column=enum_column(HandoffStatus, length=16),
    )
    requires_manager_approval: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default="0"),
    )
    approved_by_user_id: int | None = Field(
        default=None, foreign_key="users.id", ondelete="RESTRICT"
    )
    approved_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    closed_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))

    def record_pickup_weights(self, staff_weight_kg: Decimal, driver_weight_kg: Decimal) -> None:
        if staff_weight_kg < 0 or driver_weight_kg < 0:
            raise ValueError("Pickup weights cannot be negative")

        self.staff_weight_kg = staff_weight_kg
        self.driver_weight_kg = driver_weight_kg
        variance = Decimal("0")
        if staff_weight_kg:
            variance = abs(staff_weight_kg - driver_weight_kg) / staff_weight_kg * Decimal("100")
        elif driver_weight_kg:
            variance = Decimal("100")

        self.weight_variance_percent = variance.quantize(Decimal("0.0001"))
        self.requires_manager_approval = variance > Decimal("3")
        self.status = (
            HandoffStatus.DISPUTED if self.requires_manager_approval else HandoffStatus.PICKED_UP
        )


class ContractorReport(TimestampMixin, table=True):
    __tablename__ = "contractor_reports"
    __table_args__ = (
        UniqueConstraint(
            "site_id",
            "contractor_id",
            "report_month",
            name="uq_contractor_reports_site_contractor_month",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    site_id: int = Field(foreign_key="sites.id", ondelete="RESTRICT", index=True)
    contractor_id: int = Field(foreign_key="contractors.id", ondelete="RESTRICT", index=True)
    uploaded_by_user_id: int = Field(foreign_key="users.id", ondelete="RESTRICT", index=True)
    report_month: date = Field(index=True)
    source_filename: str = Field(max_length=255)
    status: ReportStatus = Field(
        default=ReportStatus.UPLOADED,
        sa_column=enum_column(ReportStatus, length=16),
    )
    validation_errors: str | None = Field(default=None, sa_column=Column(String(2000)))
    validated_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))


class ContractorReportEntry(TimestampMixin, table=True):
    __tablename__ = "contractor_report_entries"
    __table_args__ = (
        UniqueConstraint(
            "contractor_report_id",
            "handoff_id",
            "disposition",
            name="uq_contractor_report_entries_handoff_disposition",
        ),
        CheckConstraint("weight_kg >= 0", name="ck_contractor_report_entries_weight_nonnegative"),
    )

    id: int | None = Field(default=None, primary_key=True)
    contractor_report_id: int = Field(
        foreign_key="contractor_reports.id", ondelete="CASCADE", index=True
    )
    handoff_id: int = Field(foreign_key="handoffs.id", ondelete="RESTRICT", index=True)
    disposition: DispositionCategory = Field(sa_column=enum_column(DispositionCategory, length=40))
    weight_kg: Decimal = Field(sa_column=Column(Numeric(12, 3), nullable=False))
    evidence_status: EvidenceStatus = Field(
        default=EvidenceStatus.CONTRACTOR_DECLARED,
        sa_column=enum_column(EvidenceStatus, length=24),
    )
    destination: str | None = Field(default=None, max_length=255)
    evidence_reference: str | None = Field(default=None, max_length=500)


class EprQuarterReport(TimestampMixin, table=True):
    __tablename__ = "epr_quarter_reports"
    __table_args__ = (
        UniqueConstraint("report_year", "quarter", name="uq_epr_quarter_reports_period"),
        CheckConstraint("quarter BETWEEN 1 AND 4", name="ck_epr_quarter_reports_quarter"),
    )

    id: int | None = Field(default=None, primary_key=True)
    report_year: int = Field(index=True)
    quarter: int
    status: EprReportStatus = Field(
        default=EprReportStatus.DRAFT,
        sa_column=enum_column(EprReportStatus, length=16),
    )
    submitted_by_user_id: int | None = Field(
        default=None, foreign_key="users.id", ondelete="RESTRICT"
    )
    submitted_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    locked_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))


class EprQuarterSiteSnapshot(TimestampMixin, table=True):
    __tablename__ = "epr_quarter_site_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "epr_quarter_report_id",
            "site_id",
            name="uq_epr_quarter_site_snapshots_report_site",
        ),
        CheckConstraint(
            "recovery_rate >= 0 AND recovery_rate <= 1",
            name="ck_epr_quarter_site_snapshots_recovery_rate",
        ),
        CheckConstraint(
            "total_weight_received_kg >= 0 AND resold_weight_kg >= 0 "
            "AND repaired_weight_kg >= 0 AND upcycled_weight_kg >= 0 "
            "AND fibre_to_fibre_weight_kg >= 0 AND downcycled_weight_kg >= 0 "
            "AND exported_weight_kg >= 0 AND landfilled_weight_kg >= 0 "
            "AND incinerated_energy_recovery_weight_kg >= 0",
            name="ck_epr_quarter_site_snapshots_weights_nonnegative",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    epr_quarter_report_id: int = Field(
        foreign_key="epr_quarter_reports.id", ondelete="CASCADE", index=True
    )
    site_id: int = Field(foreign_key="sites.id", ondelete="RESTRICT", index=True)
    total_weight_received_kg: Decimal = Field(
        default=Decimal("0"), sa_column=Column(Numeric(14, 3), nullable=False)
    )
    resold_weight_kg: Decimal = Field(
        default=Decimal("0"), sa_column=Column(Numeric(14, 3), nullable=False)
    )
    repaired_weight_kg: Decimal = Field(
        default=Decimal("0"), sa_column=Column(Numeric(14, 3), nullable=False)
    )
    upcycled_weight_kg: Decimal = Field(
        default=Decimal("0"), sa_column=Column(Numeric(14, 3), nullable=False)
    )
    fibre_to_fibre_weight_kg: Decimal = Field(
        default=Decimal("0"), sa_column=Column(Numeric(14, 3), nullable=False)
    )
    downcycled_weight_kg: Decimal = Field(
        default=Decimal("0"), sa_column=Column(Numeric(14, 3), nullable=False)
    )
    exported_weight_kg: Decimal = Field(
        default=Decimal("0"), sa_column=Column(Numeric(14, 3), nullable=False)
    )
    landfilled_weight_kg: Decimal = Field(
        default=Decimal("0"), sa_column=Column(Numeric(14, 3), nullable=False)
    )
    incinerated_energy_recovery_weight_kg: Decimal = Field(
        default=Decimal("0"), sa_column=Column(Numeric(14, 3), nullable=False)
    )
    recovery_rate: Decimal = Field(
        default=Decimal("0"), sa_column=Column(Numeric(8, 7), nullable=False)
    )

    def recalculate_recovery_rate(self) -> None:
        recovered_weight = sum(
            (
                self.resold_weight_kg,
                self.repaired_weight_kg,
                self.upcycled_weight_kg,
                self.fibre_to_fibre_weight_kg,
                self.downcycled_weight_kg,
                self.exported_weight_kg,
                self.incinerated_energy_recovery_weight_kg,
            ),
            start=Decimal("0"),
        )
        if self.total_weight_received_kg < 0 or recovered_weight < 0:
            raise ValueError("EPR weights cannot be negative")
        if recovered_weight > self.total_weight_received_kg:
            raise ValueError("Recovered weight cannot exceed total received weight")
        if not self.total_weight_received_kg:
            self.recovery_rate = Decimal("0")
            return

        self.recovery_rate = (recovered_weight / self.total_weight_received_kg).quantize(
            Decimal("0.0000001")
        )


class EprAdjustment(SQLModel, table=True):
    """Append-only correction for a submitted EPR quarter."""

    __tablename__ = "epr_adjustments"
    __table_args__ = (
        CheckConstraint("weight_delta_kg <> 0", name="ck_epr_adjustments_nonzero_delta"),
    )

    id: int | None = Field(default=None, primary_key=True)
    epr_quarter_report_id: int = Field(
        foreign_key="epr_quarter_reports.id", ondelete="RESTRICT", index=True
    )
    site_id: int = Field(foreign_key="sites.id", ondelete="RESTRICT", index=True)
    metric: EprAdjustmentMetric = Field(sa_column=enum_column(EprAdjustmentMetric, length=40))
    weight_delta_kg: Decimal = Field(sa_column=Column(Numeric(14, 3), nullable=False))
    reason: str = Field(sa_column=Column(String(500), nullable=False))
    effective_date: date
    created_by_user_id: int = Field(foreign_key="users.id", ondelete="RESTRICT", index=True)
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False, server_default=func.now()),
    )
