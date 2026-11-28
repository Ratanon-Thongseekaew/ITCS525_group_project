"""Reset the local database and load demo data for presenting Textile Track.

Run from the repository root after applying migrations:

    python backend/seed.py            # asks before deleting
    python backend/seed.py --yes      # no prompt

Every run deletes all application rows first (the schema and Docker volume are kept), then
loads five stores, three contractors, eleven demo accounts, twelve months of history relative to
today, the current month in progress, and contractor report CSV files for the import demo in
``backend/demo_reports/``. Every demo account uses one shared password: ``DEMO_PASSWORD`` from the
environment, or ``TextileDemo2026!``. It is public, so only seed local databases.
"""

from __future__ import annotations

import argparse
import os
import random
import sys
from calendar import monthrange
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy import URL
from sqlmodel import Session, SQLModel, select

from app.database import REPOSITORY_ROOT, get_database_url, get_engine
from app.epr import add_epr_adjustment, quarter_bounds, submit_epr_quarter
from app.models import (
    Bin,
    BinStatus,
    BinType,
    Contractor,
    ContractorReport,
    ContractorReportEntry,
    DispositionCategory,
    EprQuarterReport,
    EvidenceStatus,
    GarmentOutcome,
    GarmentRecord,
    Handoff,
    HandoffStatus,
    ReportStatus,
    ResaleBinProcess,
    Site,
    User,
    UserSite,
)
from app.schemas import (
    EprAdjustmentLine,
    EprAdjustmentMetric,
    EprAdjustmentRequest,
    UserRole,
)
from app.security import hash_password
from app.sorting import add_bin

DEFAULT_DEMO_PASSWORD = "TextileDemo2026!"
DEMO_REPORTS_DIR = REPOSITORY_ROOT / "backend" / "demo_reports"
LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1", "mysql"})
LOCAL_TZ = ZoneInfo("Asia/Bangkok")
HISTORY_MONTHS = 12


@dataclass(frozen=True)
class StoreDefinition:
    code: str
    name: str
    volume: Decimal  # Scales every bin weight, so stores rank differently
    contractor: str  # Usual contractor (key into CONTRACTORS)
    manager: str
    staff: str


CONTRACTORS = {
    "greenloop": ("GreenLoop Recycling", "Narin Chaiyaporn", "narin@greenloop.example.com"),
    "circular": ("Circular Fibre Co.", "Mali Arunrat", "mali@circularfibre.example.com"),
    "reweave": ("ReWeave Textiles", "Anan Srisuk", "anan@reweave.example.com"),
}

# GreenLoop serves two stores whose last-month reports are left for the import demo.
STORES = (
    StoreDefinition(
        "BKK",
        "Bangkok Sorting Center",
        Decimal("1.6"),
        "greenloop",
        "Pimchanok Sae-Tang",
        "Somchai Prasert",
    ),
    StoreDefinition(
        "CNX",
        "Chiang Mai Sorting Center",
        Decimal("1.0"),
        "circular",
        "Kittipong Wongsa",
        "Ploy Chaiwong",
    ),
    StoreDefinition(
        "HKT",
        "Phuket Sorting Center",
        Decimal("0.9"),
        "reweave",
        "Arunee Thongdee",
        "Niran Kaewmanee",
    ),
    StoreDefinition(
        "KKC",
        "Khon Kaen Sorting Center",
        Decimal("0.7"),
        "greenloop",
        "Wichai Boonmee",
        "Siriporn Saengsri",
    ),
    StoreDefinition(
        "HDY",
        "Hat Yai Sorting Center",
        Decimal("0.8"),
        "circular",
        "Rattana Hassan",
        "Ahmad Yusoh",
    ),
)
UNREPORTED_LAST_MONTH = frozenset({"BKK", "KKC"})

DISPOSITION_SHARES = (
    (DispositionCategory.UPCYCLED, Decimal("0.15")),
    (DispositionCategory.FIBRE_TO_FIBRE, Decimal("0.40")),
    (DispositionCategory.DOWNCYCLED, Decimal("0.20")),
    (DispositionCategory.EXPORTED, Decimal("0.08")),
    (DispositionCategory.LANDFILLED, Decimal("0.05")),
    (DispositionCategory.INCINERATED_ENERGY_RECOVERY, Decimal("0.12")),
)
REPORT_COLUMNS = (
    "bin_id",
    "received_kg",
    "upcycled_kg",
    "fibre_to_fibre_kg",
    "downcycled_kg",
    "exported_kg",
    "landfilled_kg",
    "incinerated_energy_recovery_kg",
)
GARMENT_CATEGORIES = (
    "Tops",
    "Bottoms",
    "Dresses",
    "Outerwear",
    "Denim",
    "Knitwear",
    "Children's wear",
    "Home linens",
)
OUTCOME_BY_TYPE = {
    BinType.RESALE: GarmentOutcome.RESALE,
    BinType.RECYCLE: GarmentOutcome.RECYCLE,
    BinType.REPAIR: GarmentOutcome.REPAIR_UPCYCLE,
}
DRIVERS = ("Somsak K.", "Prasit W.", "Chaiwat N.", "Boonsong T.")
KG = Decimal("0.001")


@dataclass
class DemoData:
    """What the seed created, for printing and for tests."""

    today: date
    password: str
    accounts: list[tuple[str, str, str]] = field(default_factory=list)  # username, role, stores
    report_files: list[Path] = field(default_factory=list)


# --- Dates ----------------------------------------------------------------------------------


def month_start(today: date, offset: int) -> date:
    """First day of the month ``offset`` months from today's month."""

    index = today.year * 12 + today.month - 1 + offset
    return date(index // 12, index % 12 + 1, 1)


def _local(day: date, hour: int, minute: int = 0) -> datetime:
    return datetime.combine(day, time(hour, minute), tzinfo=LOCAL_TZ).astimezone(UTC)


def _day(month: date, day: int) -> date:
    return month.replace(day=min(day, monthrange(month.year, month.month)[1]))


# --- Reset and safety -----------------------------------------------------------------------


def reset_database(session: Session) -> None:
    """Delete every application row, children first. The schema and alembic_version stay."""

    for table in reversed(SQLModel.metadata.sorted_tables):
        session.execute(table.delete())
    session.commit()


def check_database_target(url: URL, *, allow_remote: bool) -> None:
    """Refuse to wipe a database that isn't local unless explicitly allowed."""

    if url.get_backend_name() == "sqlite" or allow_remote:
        return
    if (url.host or "") not in LOCAL_HOSTS:
        raise SystemExit(
            f"Refusing to reset the database on '{url.host}'. The demo seed deletes all data "
            "and uses a public password; pass --allow-remote only for a disposable database."
        )


# --- Seeding --------------------------------------------------------------------------------


class _Seeder:
    def __init__(self, session: Session, today: date, password: str) -> None:
        self.session = session
        self.today = today
        self.now = _local(today, 17)
        self.password = password
        self.rng = random.Random(2026)
        self.data = DemoData(today=today, password=password)
        self.sites: dict[str, Site] = {}
        self.contractors: dict[str, Contractor] = {}
        self.managers: dict[str, User] = {}
        self.staff: dict[str, User] = {}
        self.admin: User | None = None

    # People and places

    def _user(self, username: str, role: UserRole, full_name: str, stores: list[Site]) -> User:
        user = User(
            username=username,
            password_hash=hash_password(self.password),
            role=role,
            full_name=full_name,
            must_change_password=False,
        )
        self.session.add(user)
        self.session.flush()
        for index, site in enumerate(stores):
            self.session.add(UserSite(user_id=user.id, site_id=site.id, is_default=index == 0))
        store_label = ", ".join(site.code for site in stores) or "all stores"
        self.data.accounts.append((username, role.value, store_label))
        return user

    def people_and_places(self) -> None:
        for key, (name, contact, email) in CONTRACTORS.items():
            contractor = Contractor(name=name, contact_name=contact, contact_email=email)
            self.session.add(contractor)
            self.contractors[key] = contractor
        for store in STORES:
            site = Site(code=store.code, name=store.name, timezone_name="Asia/Bangkok")
            self.session.add(site)
            self.sites[store.code] = site
        self.session.flush()

        self.admin = self._user("admin@example.com", UserRole.ADMIN, "Demo Administrator", [])
        for store in STORES:
            site = self.sites[store.code]
            code = store.code.lower()
            self.managers[store.code] = self._user(
                f"manager.{code}@example.com", UserRole.MANAGER, store.manager, [site]
            )
        for store in STORES:
            site = self.sites[store.code]
            self.staff[store.code] = self._user(
                f"staff.{store.code.lower()}@example.com", UserRole.STAFF, store.staff, [site]
            )

    # Bins and garments

    def _bin(self, store: StoreDefinition, bin_type: BinType, *, max_capacity: int = 50) -> Bin:
        # add_bin gives the next per-store code, e.g. BKK-RC-007.
        return add_bin(
            self.session,
            self.sites[store.code].id,
            bin_type,
            max_capacity=max_capacity,
            notes="Demo seed data",
        )

    def _split(self, total: Decimal, parts: int) -> list[Decimal]:
        weights = [Decimal(str(self.rng.uniform(0.7, 1.3))) for _ in range(parts)]
        scale = total / sum(weights)
        values = [(weight * scale).quantize(KG) for weight in weights[:-1]]
        return [*values, total - sum(values)]

    def _fill(
        self,
        store: StoreDefinition,
        bin_record: Bin,
        *,
        weight: Decimal,
        item_count: int,
        first_day: date,
        last_day: date,
        records: int,
    ) -> None:
        """Add ``records`` garment records totalling ``weight`` between the two days."""

        span = max(0, (last_day - first_day).days)
        for index, part in enumerate(self._split(weight, records)):
            day = first_day + timedelta(days=round(span * (index + 1) / records))
            self.session.add(
                GarmentRecord(
                    site_id=bin_record.site_id,
                    recorded_by_user_id=self.staff[store.code].id,
                    bin_id=bin_record.id,
                    category=self.rng.choice(GARMENT_CATEGORIES),
                    outcome=OUTCOME_BY_TYPE[bin_record.bin_type],
                    weight_kg=part,
                    received_at=min(_local(day, 9 + index % 8, 5 * index % 60), self.now),
                )
            )
        bin_record.item_count = item_count
        bin_record.total_weight_kg = weight
        bin_record.max_capacity = max(bin_record.max_capacity, item_count)

    def _weight(self, store: StoreDefinition, low: float, high: float) -> Decimal:
        return (Decimal(str(self.rng.uniform(low, high))) * store.volume).quantize(KG)

    def _closed_bin(
        self,
        store: StoreDefinition,
        bin_type: BinType,
        month: date,
        close_day: int,
        weight: Decimal,
        *,
        status: BinStatus = BinStatus.CLOSED,
    ) -> Bin:
        avg_item = {BinType.RESALE: 0.55, BinType.REPAIR: 0.7, BinType.RECYCLE: 0.8}[bin_type]
        bin_record = self._bin(store, bin_type)
        closed_on = _day(month, close_day)
        if month == month_start(self.today, 0):
            closed_on = min(closed_on, self.today)
        self._fill(
            store,
            bin_record,
            weight=weight,
            item_count=max(1, int(weight / Decimal(str(avg_item)))),
            first_day=max(month, closed_on - timedelta(days=12)),
            last_day=closed_on,
            records=4,
        )
        bin_record.status = status
        if bin_type is BinType.RECYCLE:
            bin_record.ready_at = min(_local(closed_on, 16), self.now)
        else:
            bin_record.closed_at = min(_local(closed_on, 16), self.now)
        return bin_record

    def _process_resale(self, store: StoreDefinition, bin_record: Bin) -> None:
        rejected = round(bin_record.item_count * self.rng.uniform(0.05, 0.15))
        accepted = bin_record.item_count - rejected
        revenue = (Decimal(accepted) * Decimal(str(self.rng.uniform(55, 95)))).quantize(
            Decimal("0.01")
        )
        processed_on = min((bin_record.closed_at + timedelta(days=2)).date(), self.today)
        self.session.add(
            ResaleBinProcess(
                bin_id=bin_record.id,
                processed_by_user_id=self.staff[store.code].id,
                accepted_item_count=accepted,
                rejected_item_count=rejected,
                revenue=revenue,
                processed_at=processed_on,
                notes="Demo seed: sold through the store",
            )
        )
        bin_record.estimated_value = (Decimal(bin_record.item_count) * 80).quantize(Decimal("0.01"))
        bin_record.actual_value = revenue

    # Handoffs and reports

    def _handoff(
        self,
        store: StoreDefinition,
        bin_record: Bin,
        picked_up_at: datetime,
        *,
        driver_factor: Decimal | None = None,
    ) -> Handoff:
        factor = driver_factor or Decimal(str(1 + self.rng.uniform(-0.02, 0.015)))
        handoff = Handoff(
            site_id=bin_record.site_id,
            bin_id=bin_record.id,
            contractor_id=self.contractors[store.contractor].id,
            created_by_user_id=self.staff[store.code].id,
            scheduled_pickup_at=picked_up_at,
            picked_up_at=picked_up_at,
            scale_photo_url=f"https://example.invalid/scales/{bin_record.code}.jpg",
            driver_name=self.rng.choice(DRIVERS),
            vehicle_plate_number=f"{store.code}-{self.rng.randint(1000, 9999)}",
        )
        handoff.record_pickup_weights(
            bin_record.total_weight_kg, (bin_record.total_weight_kg * factor).quantize(KG)
        )
        bin_record.status = BinStatus.HANDED_OFF
        self.session.add(handoff)
        return handoff

    def _approve(self, store: StoreDefinition, handoff: Handoff, at: datetime) -> None:
        handoff.status = HandoffStatus.APPROVED
        handoff.approved_by_user_id = self.managers[store.code].id
        handoff.approved_at = min(at, self.now)

    def _report(
        self,
        store: StoreDefinition,
        month: date,
        handoffs: list[tuple[Handoff, Bin]],
    ) -> None:
        contractor = self.contractors[store.contractor]
        validated_at = min(_local(_day(month_start(month, 1), 5), 10), self.now)
        report = ContractorReport(
            site_id=self.sites[store.code].id,
            contractor_id=contractor.id,
            uploaded_by_user_id=self.managers[store.code].id,
            report_month=month,
            source_filename=f"{_slug(contractor.name)}-{month:%Y-%m}.csv",
            status=ReportStatus.IMPORTED,
            validated_at=validated_at,
        )
        self.session.add(report)
        self.session.flush()
        for handoff, bin_record in handoffs:
            received = handoff.driver_weight_kg
            # EPR checks categorized weight against what the store weighed, so stay within both.
            ceiling = min(received, handoff.staff_weight_kg)
            categorized = (ceiling * Decimal(str(1 - self.rng.uniform(0, 0.01)))).quantize(KG)
            for category, weight in _disposition_weights(categorized):
                evidence = EvidenceStatus.VERIFIED
                if category is DispositionCategory.EXPORTED and month.month % 3 == 0:
                    evidence = EvidenceStatus.CONTRACTOR_DECLARED
                elif category is DispositionCategory.DOWNCYCLED and month.month % 4 == 0:
                    evidence = EvidenceStatus.ESTIMATED
                self.session.add(
                    ContractorReportEntry(
                        contractor_report_id=report.id,
                        handoff_id=handoff.id,
                        disposition=category,
                        weight_kg=weight,
                        evidence_status=evidence,
                        destination=f"{contractor.name}: {category.value.replace('_', ' ')}",
                    )
                )
            handoff.contractor_received_kg = received
            handoff.status = HandoffStatus.CLOSED
            handoff.closed_at = validated_at
            bin_record.status = BinStatus.CLOSED
            bin_record.closed_at = validated_at

    # Timeline

    def history(self) -> None:
        last_month = month_start(self.today, -1)
        for offset in range(-HISTORY_MONTHS, 0):
            month = month_start(self.today, offset)
            for store in STORES:
                for close_day in (10, 24):
                    resale = self._closed_bin(
                        store, BinType.RESALE, month, close_day, self._weight(store, 18, 26)
                    )
                    self.session.flush()
                    self._process_resale(store, resale)
                self._closed_bin(store, BinType.REPAIR, month, 18, self._weight(store, 8, 12))

                pickups: list[tuple[Handoff, Bin]] = []
                for ready_day, pickup_day in ((12, 14), (26, 27)):
                    recycle = self._closed_bin(
                        store,
                        BinType.RECYCLE,
                        month,
                        ready_day,
                        self._weight(store, 32, 42),
                        status=BinStatus.READY,
                    )
                    self.session.flush()
                    disputed = store.code == "CNX" and offset == -5 and ready_day == 12
                    handoff = self._handoff(
                        store,
                        recycle,
                        _local(_day(month, pickup_day), 10),
                        driver_factor=Decimal("1.045") if disputed else None,
                    )
                    self.session.flush()
                    if disputed:
                        self._approve(store, handoff, handoff.picked_up_at + timedelta(days=1))
                    pickups.append((handoff, recycle))

                if not (month == last_month and store.code in UNREPORTED_LAST_MONTH):
                    self._report(store, month, pickups)
            self.session.flush()

    def current_month(self) -> None:
        month = month_start(self.today, 0)
        stores = {store.code: store for store in STORES}
        last = self.today.day

        def day(target: int) -> date:
            return _day(month, max(1, min(target, last)))

        # Direct resale: closed resale bins waiting to be processed.
        for code, count in (("BKK", 2), ("CNX", 1), ("HKT", 1)):
            for number in range(count):
                store = stores[code]
                self._closed_bin(
                    store, BinType.RESALE, month, last - 2 + number, self._weight(store, 18, 26)
                )

        # Handoff page: sealed recycle bins waiting for pickup.
        for code in ("BKK", "CNX", "HKT"):
            store = stores[code]
            ready = self._closed_bin(
                store,
                BinType.RECYCLE,
                month,
                last - 1,
                self._weight(store, 32, 40),
                status=BinStatus.READY,
            )
            ready.item_count = max(ready.item_count, ready.max_capacity)

        # Handoff records this month: picked up, disputed (awaiting approval), and approved.
        for code, factor in (("HDY", None), ("BKK", Decimal("1.05")), ("KKC", Decimal("1.04"))):
            store = stores[code]
            picked = self._closed_bin(
                store,
                BinType.RECYCLE,
                month,
                last - 4,
                self._weight(store, 32, 40),
                status=BinStatus.READY,
            )
            self.session.flush()
            handoff = self._handoff(
                store,
                picked,
                min(_local(day(last - 3), 10), self.now),
                driver_factor=factor,
            )
            if code == "KKC":
                self._approve(store, handoff, handoff.picked_up_at + timedelta(hours=5))
        self.session.flush()

        # Sorting: one active bin of each type per store, partly filled; BKK recycle nearly full.
        for store in STORES:
            for bin_type, (low, high) in (
                (BinType.RESALE, (14, 26)),
                (BinType.RECYCLE, (20, 34)),
                (BinType.REPAIR, (4, 9)),
            ):
                items = 47 if (store.code, bin_type) == ("BKK", BinType.RECYCLE) else None
                items = items or self.rng.randint(low, high)
                active = self._bin(store, bin_type)
                self._fill(
                    store,
                    active,
                    weight=(Decimal(str(self.rng.uniform(0.45, 0.85))) * items).quantize(KG),
                    item_count=items,
                    first_day=month,
                    last_day=self.today,
                    records=min(items, 12),
                )
        self.session.flush()

    def epr(self) -> None:
        """Submit every quarter before the one holding last month, plus one adjustment."""

        assert self.admin is not None
        last_month = month_start(self.today, -1)
        open_quarter = (last_month.year, (last_month.month - 1) // 3 + 1)
        first = month_start(self.today, -HISTORY_MONTHS)
        year, quarter = first.year, (first.month - 1) // 3 + 1
        submitted: list[tuple[int, int]] = []
        while (year, quarter) < open_quarter:
            submit_epr_quarter(self.admin, self.session, year, quarter)
            submitted.append((year, quarter))
            year, quarter = (year + 1, 1) if quarter == 4 else (year, quarter + 1)

        for year, quarter in submitted:
            report = self.session.exec(
                select(EprQuarterReport).where(
                    EprQuarterReport.report_year == year, EprQuarterReport.quarter == quarter
                )
            ).one()
            submitted_at = min(
                _local(quarter_bounds(year, quarter)[1] + timedelta(days=14), 10), self.now
            )
            report.submitted_at = report.locked_at = submitted_at
        self.session.commit()

        if submitted:
            year, quarter = submitted[-1]
            add_epr_adjustment(
                EprAdjustmentRequest(
                    site_id=self.sites["BKK"].id,
                    expected_latest_adjustment_id=None,
                    effective_date=quarter_bounds(year, quarter)[1] + timedelta(days=20),
                    reason="Late contractor correction: fibre-to-fibre weight confirmed",
                    lines=[
                        EprAdjustmentLine(
                            metric=EprAdjustmentMetric.FIBRE_TO_FIBRE,
                            weight_delta_kg=Decimal("2.500"),
                        )
                    ],
                ),
                self.admin,
                self.session,
                year,
                quarter,
            )


def _slug(name: str) -> str:
    return "".join(ch if ch.isalnum() else "-" for ch in name.lower()).strip("-").replace("--", "-")


def _disposition_weights(total: Decimal) -> list[tuple[DispositionCategory, Decimal]]:
    weights: list[tuple[DispositionCategory, Decimal]] = []
    allocated = Decimal("0")
    for index, (category, share) in enumerate(DISPOSITION_SHARES):
        weight = total - allocated if index == len(DISPOSITION_SHARES) - 1 else (total * share)
        weight = weight.quantize(KG)
        allocated += weight
        weights.append((category, weight))
    return weights


def seed_demo_data(session: Session, today: date, *, password: str | None = None) -> DemoData:
    """Delete all application rows, then load the demo data relative to ``today``."""

    reset_database(session)
    seeder = _Seeder(
        session, today, password or os.getenv("DEMO_PASSWORD") or DEFAULT_DEMO_PASSWORD
    )
    seeder.people_and_places()
    seeder.history()
    seeder.current_month()
    session.commit()
    seeder.epr()
    session.commit()
    return seeder.data


# --- Demo contractor report files -----------------------------------------------------------


def _last_month_handoffs(
    session: Session, today: date, contractor_name: str
) -> list[tuple[Bin, Handoff]]:
    month = month_start(today, -1)
    start, end = _local(month, 0), _local(month_start(today, 0), 0)
    rows = session.exec(
        select(Bin, Handoff)
        .join(Handoff, Handoff.bin_id == Bin.id)
        .join(Contractor, Contractor.id == Handoff.contractor_id)
        .where(Contractor.name == contractor_name)
        .where(Handoff.picked_up_at >= start, Handoff.picked_up_at < end)
        .order_by(Bin.code)
    ).all()
    return list(rows)


def _row(bin_code: str, received: Decimal | str, categorized: Decimal | None = None) -> list[str]:
    if categorized is None:
        categorized = received if isinstance(received, Decimal) else Decimal("10")
    return [bin_code, str(received), *(str(w) for _c, w in _disposition_weights(categorized))]


def write_demo_reports(
    session: Session, today: date, directory: Path = DEMO_REPORTS_DIR
) -> list[Path]:
    """Write contractor report CSVs for last month that show every import outcome."""

    directory.mkdir(parents=True, exist_ok=True)
    for old in directory.glob("*.csv"):
        old.unlink()
    month = month_start(today, -1)
    files: list[Path] = []

    # GreenLoop's last-month bins (BKK, KKC) aren't reported yet: verified, flagged, rejected.
    greenloop = CONTRACTORS["greenloop"][0]
    unreported = _last_month_handoffs(session, today, greenloop)
    circular = _last_month_handoffs(session, today, CONTRACTORS["circular"][0])
    (bkk_1, h_bkk_1), (bkk_2, h_bkk_2), (kkc_1, h_kkc_1), (kkc_2, h_kkc_2) = sorted(
        unreported, key=lambda pair: pair[0].code
    )[:4]
    off_by_five = (h_kkc_1.staff_weight_kg * Decimal("0.95")).quantize(KG)
    rows = [
        _row(bkk_1.code, h_bkk_1.driver_weight_kg),  # Verified
        _row(bkk_2.code, h_bkk_2.driver_weight_kg, h_bkk_2.driver_weight_kg - Decimal("1.5")),
        _row(kkc_1.code, off_by_five),  # More than 3% off the staff weight
        _row(kkc_2.code, h_kkc_2.driver_weight_kg),  # Verified
        _row(bkk_1.code, h_bkk_1.driver_weight_kg),  # Repeated bin
        _row(f"{bkk_1.code.rsplit('-', 1)[0]}-999", Decimal("20.000")),  # Unknown bin
        _row(circular[0][0].code, circular[0][1].driver_weight_kg),  # Another contractor's bin
        _row(kkc_2.code.replace("KKC", "HKT", 1), "abc"),  # Not a number
    ]
    files.append(_write_csv(directory / f"{_slug(greenloop)}-{month:%Y-%m}.csv", rows))

    # Circular Fibre's last-month bins are already reported: re-importing flags and replaces.
    circular_name = CONTRACTORS["circular"][0]
    rows = [_row(bin_record.code, handoff.driver_weight_kg) for bin_record, handoff in circular]
    files.append(_write_csv(directory / f"{_slug(circular_name)}-{month:%Y-%m}.csv", rows))
    return files


def _write_csv(path: Path, rows: list[list[str]]) -> Path:
    path.write_text("\n".join([",".join(REPORT_COLUMNS), *(",".join(row) for row in rows)]) + "\n")
    return path


# --- Command line ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Reset the local database and load demo data.")
    parser.add_argument("--yes", action="store_true", help="don't ask before deleting data")
    parser.add_argument(
        "--allow-remote", action="store_true", help="allow a database that isn't local"
    )
    args = parser.parse_args(argv)

    url = get_database_url()
    check_database_target(url, allow_remote=args.allow_remote)
    target = f"{url.host or 'local file'}/{url.database}"
    if not args.yes:
        answer = input(f"This deletes ALL data in {target} and loads demo data. Type 'yes': ")
        if answer.strip().lower() != "yes":
            sys.exit("Cancelled; nothing was changed.")

    today = date.today()
    with Session(get_engine()) as session:
        data = seed_demo_data(session, today)
        files = write_demo_reports(session, today)

    print(f"Demo data loaded into {target} (12 months to {month_start(today, -1):%B %Y}).")
    print(f"\nDemo accounts (password: {data.password}):")
    for username, role, stores in data.accounts:
        print(f"  {username:<28} {role:<8} {stores}")
    print("\nContractor report files for the import demo:")
    for path in files:
        print(f"  {path.relative_to(REPOSITORY_ROOT)}")


if __name__ == "__main__":
    main()
