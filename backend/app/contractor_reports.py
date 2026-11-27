"""Contractor monthly outcome report import.

A report file comes from one contractor and covers one month. Each row names a bin and says how
much the contractor received and what happened to it, in six disposition categories. A row is
saved only when its bin exists, was picked up in the report month by that contractor, and its
weights add up. Bin codes are unique across sites, so each bin decides its row's sorting center
and a file may cover several centers (one saved report per center).

Until the API reads the login token, requests name the acting manager or admin with
``actor_id``, the same stopgap the handoff and EPR endpoints use.
"""

import base64
import binascii
import csv
import io
import re
import zipfile
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, date
from decimal import Decimal, InvalidOperation
from typing import Annotated
from xml.etree import ElementTree as ET
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from .database import get_session
from .epr import lock_open_epr_quarter, require_management_actor
from .models import (
    Bin,
    Contractor,
    ContractorReport,
    ContractorReportEntry,
    DispositionCategory,
    EvidenceStatus,
    Handoff,
    ReportStatus,
    Site,
    utc_now,
)
from .schemas import (
    MAX_REPORT_WEIGHT_KG,
    ContractorDispositionWeights,
    ContractorReportFileParseRequest,
    ContractorReportFileParseResponse,
    ContractorReportImportRequest,
    ContractorReportImportResponse,
    ContractorReportImportRowRequest,
    ContractorReportImportSiteResult,
    ContractorReportOptionItem,
    ContractorReportOptionsResponse,
    ContractorReportParsedRow,
)

router = APIRouter(prefix="/api/contractor-reports", tags=["contractor reports"])
SessionDependency = Annotated[Session, Depends(get_session)]
ZERO = Decimal("0")

MAX_FILE_BYTES = 5 * 1024 * 1024  # Uploaded file, after base64 decoding
MAX_XLSX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024  # Guards against zip bombs
MAX_DATA_ROWS = 2000
STAFF_WEIGHT_VARIANCE = Decimal("0.03")  # Received weight more than 3% off the staff weight

# Report columns in template order; each maps to its disposition category, if any.
CATEGORY_COLUMNS: dict[str, DispositionCategory] = {
    "upcycled_kg": DispositionCategory.UPCYCLED,
    "fibre_to_fibre_kg": DispositionCategory.FIBRE_TO_FIBRE,
    "downcycled_kg": DispositionCategory.DOWNCYCLED,
    "exported_kg": DispositionCategory.EXPORTED,
    "landfilled_kg": DispositionCategory.LANDFILLED,
    "incinerated_energy_recovery_kg": DispositionCategory.INCINERATED_ENERGY_RECOVERY,
}
REQUIRED_COLUMNS = ("bin_id", "received_kg", *CATEGORY_COLUMNS)

# Other header spellings accepted for each column. Columns not listed (such as the old
# contractor and store_weight_kg columns) are ignored.
HEADER_ALIASES: dict[str, tuple[str, ...]] = {
    "bin_id": ("bin_id", "bin_code", "bin", "binid"),
    "received_kg": ("received_kg", "reported_wt", "reported_weight_kg", "reported_weight"),
    "upcycled_kg": ("upcycled_kg", "upcycled", "resold_kg", "resold"),
    "fibre_to_fibre_kg": ("fibre_to_fibre_kg", "fibre_to_fibre", "recycled_fiber_kg"),
    "downcycled_kg": ("downcycled_kg", "downcycled"),
    "exported_kg": ("exported_kg", "exported"),
    "landfilled_kg": ("landfilled_kg", "landfilled"),
    "incinerated_energy_recovery_kg": (
        "incinerated_energy_recovery_kg",
        "incinerated_with_energy_recovery",
        "incinerated_energy_recovery",
        "energy_recovery_kg",
    ),
}

XLSX_NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
CELL_COLUMN = re.compile(r"^([A-Z]+)")


@dataclass
class ReportRecord:
    """One data row of an uploaded file, keyed by canonical column name."""

    line: int  # Spreadsheet line number; the header is line 1
    values: dict[str, str]


# --- Reading files --------------------------------------------------------------------------


def _normalize_header(raw: str) -> str:
    cleaned = raw.strip().lower().replace("-", "_").replace(" ", "_")
    for canonical, aliases in HEADER_ALIASES.items():
        if cleaned in aliases:
            return canonical
    return cleaned


def _require_columns(headers: Iterable[str]) -> None:
    missing = [column for column in REQUIRED_COLUMNS if column not in set(headers)]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"The file is missing required columns: {', '.join(missing)}.",
        )


def _require_row_limit(row_count: int) -> None:
    if row_count > MAX_DATA_ROWS:
        raise HTTPException(
            status_code=422,
            detail=f"The file has {row_count} rows; a report can have at most {MAX_DATA_ROWS}.",
        )


def _read_csv_records(raw_bytes: bytes) -> list[ReportRecord]:
    text = raw_bytes.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    headers = [_normalize_header(name) for name in (reader.fieldnames or [])]
    _require_columns(headers)
    records: list[ReportRecord] = []
    for raw_row in reader:
        values = [(value or "").strip() for value in raw_row.values() if isinstance(value, str)]
        if not any(values):
            continue
        records.append(
            ReportRecord(
                line=reader.line_num,
                values={
                    _normalize_header(name): (value or "").strip()
                    for name, value in raw_row.items()
                    if name is not None and isinstance(value, str)
                },
            )
        )
        _require_row_limit(len(records))
    return records


def _column_index(cell_ref: str) -> int | None:
    """Zero-based column index from a cell reference such as ``D12``."""

    match = CELL_COLUMN.match(cell_ref.upper())
    if match is None:
        return None
    index = 0
    for letter in match.group(1):
        index = index * 26 + (ord(letter) - ord("A") + 1)
    return index - 1


def _read_xlsx_records(raw_bytes: bytes) -> list[ReportRecord]:
    try:
        zf = zipfile.ZipFile(io.BytesIO(raw_bytes))
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=422, detail="Invalid XLSX spreadsheet file.") from exc

    with zf:
        if sum(info.file_size for info in zf.infolist()) > MAX_XLSX_UNCOMPRESSED_BYTES:
            raise HTTPException(status_code=413, detail="The spreadsheet is too large to read.")
        sheet_name = "xl/worksheets/sheet1.xml"
        if sheet_name not in zf.namelist():
            raise HTTPException(status_code=422, detail="No worksheet found in XLSX file.")
        try:
            shared_strings: list[str] = []
            if "xl/sharedStrings.xml" in zf.namelist():
                ss_root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
                for si in ss_root.findall("s:si", XLSX_NS):
                    shared_strings.append(
                        "".join(t.text or "" for t in si.findall(".//s:t", XLSX_NS))
                    )
            sheet_root = ET.fromstring(zf.read(sheet_name))
        except ET.ParseError as exc:
            raise HTTPException(status_code=422, detail="Invalid XLSX spreadsheet file.") from exc

    # Excel leaves empty cells out of the file, so each value is placed by its cell reference.
    lines: list[tuple[int, list[str]]] = []
    for position, row_el in enumerate(sheet_root.findall(".//s:sheetData/s:row", XLSX_NS), 1):
        line = int(row_el.attrib.get("r", position))
        row_vals: list[str] = []
        for cell_position, cell in enumerate(row_el.findall("s:c", XLSX_NS)):
            column = _column_index(cell.attrib.get("r", "")) if "r" in cell.attrib else None
            column = cell_position if column is None else column
            while len(row_vals) < column:
                row_vals.append("")
            row_vals.append(_xlsx_cell_text(cell, shared_strings))
        if any(row_vals):
            lines.append((line, row_vals))

    if not lines:
        _require_columns([])
    _header_line, header_cells = lines[0]
    headers = [_normalize_header(h) for h in header_cells]
    _require_columns(headers)
    _require_row_limit(len(lines) - 1)
    records: list[ReportRecord] = []
    for line, data_row in lines[1:]:
        values = {
            header: data_row[idx].strip() if idx < len(data_row) else ""
            for idx, header in enumerate(headers)
            if header
        }
        records.append(ReportRecord(line=line, values=values))
    return records


def _xlsx_cell_text(cell: ET.Element, shared_strings: list[str]) -> str:
    inline_el = cell.find("s:is/s:t", XLSX_NS)
    if inline_el is not None and inline_el.text is not None:
        return inline_el.text.strip()
    val_el = cell.find("s:v", XLSX_NS)
    if val_el is None or val_el.text is None:
        return ""
    raw_text = val_el.text.strip()
    if cell.attrib.get("t", "") == "s" and raw_text.isdigit():
        idx = int(raw_text)
        return shared_strings[idx].strip() if idx < len(shared_strings) else ""
    return raw_text


def _decode_upload(content_base64: str) -> bytes:
    # Base64 is a third larger than the bytes it holds; reject oversized uploads before decoding.
    if len(content_base64) > (MAX_FILE_BYTES * 4) // 3 + 4:
        raise HTTPException(status_code=413, detail="The file is larger than 5 MB.")
    try:
        raw_bytes = base64.b64decode(content_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Invalid base64 file content.") from exc
    if len(raw_bytes) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="The file is larger than 5 MB.")
    return raw_bytes


# --- Weights --------------------------------------------------------------------------------


def _parse_weight(raw: str | None, column: str, *, required: bool) -> tuple[Decimal, str | None]:
    """A cell's weight in kg, or 0 and the reason it can't be used."""

    cleaned = (raw or "").strip()
    if cleaned.lower().endswith("kg"):
        cleaned = cleaned[:-2].strip()
    if not cleaned:
        return ZERO, (f"{column} is missing." if required else None)
    try:
        value = Decimal(cleaned)
    except InvalidOperation:
        return ZERO, f"{column}: '{raw}' is not a number."
    if not value.is_finite():
        return ZERO, f"{column}: '{raw}' is not a number."
    if value < ZERO:
        return ZERO, f"{column} can't be negative."
    if value >= MAX_REPORT_WEIGHT_KG:
        return ZERO, f"{column} is too large."
    return value, None


def _weight_totals(
    received_kg: Decimal, dispositions: ContractorDispositionWeights
) -> tuple[Decimal, Decimal, list[str]]:
    """Categorized and uncategorized weight, and an error if the categories exceed receipt."""

    categorized = sum((weight for _category, weight in _disposition_weights(dispositions)), ZERO)
    errors: list[str] = []
    if categorized > received_kg:
        excess = (categorized - received_kg).quantize(Decimal("0.001"))
        errors.append(f"Disposition weights exceed received weight by {excess} kg.")
    return categorized, max(ZERO, received_kg - categorized), errors


def _disposition_weights(
    dispositions: ContractorDispositionWeights,
) -> list[tuple[DispositionCategory, Decimal]]:
    return [
        (category, getattr(dispositions, column)) for column, category in CATEGORY_COLUMNS.items()
    ]


# --- Bins -----------------------------------------------------------------------------------


@dataclass
class ReportBins:
    """The bins a report names, with their handoffs, sites, handoff contractors, and outcomes."""

    by_code: dict[str, tuple[Bin, Handoff | None]]  # Keyed by the upper-cased bin code
    sites: dict[int, Site]
    contractors: dict[int, Contractor]
    # Outcomes already saved for these handoffs, one entry per handoff and category.
    entries: dict[tuple[int, DispositionCategory], ContractorReportEntry]

    def site_of(self, bin_record: Bin) -> Site | None:
        return self.sites.get(bin_record.site_id)

    def reported_kg(self, handoff: Handoff) -> Decimal | None:
        """The outcome weight already saved for this handoff, or None if it has none."""

        weights = [
            entry.weight_kg
            for (handoff_id, _category), entry in self.entries.items()
            if handoff_id == handoff.id
        ]
        return sum(weights, start=ZERO) if weights else None


def _load_report_bins(session: Session, bin_codes: Iterable[str]) -> ReportBins:
    """Load everything the row checks need in at most five queries, however many rows.

    Rows are looked up by upper-cased code, matching the database's case-insensitive codes.
    The maps also keep the loaded rows alive: the session only holds weak references, so a
    later ``session.get`` could otherwise query the database again for every row.
    """

    codes = {code.strip() for code in bin_codes if code and code.strip()}
    bins = session.exec(select(Bin).where(Bin.code.in_(codes))).all() if codes else []
    bin_ids = [bin_record.id for bin_record in bins]
    handoffs = (
        session.exec(select(Handoff).where(Handoff.bin_id.in_(bin_ids))).all() if bins else []
    )
    site_ids = {bin_record.site_id for bin_record in bins}
    contractor_ids = {handoff.contractor_id for handoff in handoffs}
    handoff_ids = [handoff.id for handoff in handoffs]
    sites = session.exec(select(Site).where(Site.id.in_(site_ids))).all() if site_ids else []
    contractors = (
        session.exec(select(Contractor).where(Contractor.id.in_(contractor_ids))).all()
        if contractor_ids
        else []
    )
    entries = (
        session.exec(
            select(ContractorReportEntry).where(ContractorReportEntry.handoff_id.in_(handoff_ids))
        ).all()
        if handoff_ids
        else []
    )
    handoff_by_bin = {handoff.bin_id: handoff for handoff in handoffs}
    return ReportBins(
        by_code={
            bin_record.code.upper(): (bin_record, handoff_by_bin.get(bin_record.id))
            for bin_record in bins
        },
        sites={site.id: site for site in sites},
        contractors={contractor.id: contractor for contractor in contractors},
        entries={(entry.handoff_id, entry.disposition): entry for entry in entries},
    )


def _check_report_bin(
    report_bins: ReportBins,
    bin_code: str,
    *,
    month_start: date | None,
    contractor: Contractor | None,
) -> tuple[Bin | None, Handoff | None, list[str]]:
    """Find a report row's bin and handoff, and the reasons the row can't be saved.

    A report covers one month and one contractor, so the bin must have been picked up in that
    month by that contractor. Either check is skipped when its value is None.
    """

    found = report_bins.by_code.get(bin_code.upper())
    if found is None:
        return None, None, [f"Bin '{bin_code}' was not found."]
    bin_record, handoff = found
    if handoff is None:
        return bin_record, None, [f"Bin '{bin_code}' has no handoff to a contractor."]

    errors: list[str] = []
    if month_start is not None:
        site = report_bins.site_of(bin_record)
        pickup_month = _pickup_month(handoff, site) if site is not None else None
        if pickup_month is None:
            errors.append(f"Bin '{bin_code}' has not been picked up yet.")
        elif pickup_month != month_start:
            errors.append(
                f"Bin '{bin_code}' was picked up in {pickup_month:%Y-%m}, "
                f"not in the report month {month_start:%Y-%m}."
            )
    if contractor is not None and handoff.contractor_id != contractor.id:
        handoff_contractor = report_bins.contractors.get(handoff.contractor_id)
        collected_by = handoff_contractor.name if handoff_contractor else "another contractor"
        errors.append(f"Bin '{bin_code}' was handed off to {collected_by}, not {contractor.name}.")
    return bin_record, handoff, errors


def _pickup_month(handoff: Handoff, site: Site) -> date | None:
    picked_up_at = handoff.picked_up_at
    if picked_up_at is None:
        return None
    if picked_up_at.tzinfo is None:  # SQLite returns naive UTC values
        picked_up_at = picked_up_at.replace(tzinfo=UTC)
    try:
        local = picked_up_at.astimezone(ZoneInfo(site.timezone_name))
    except ZoneInfoNotFoundError:
        local = picked_up_at
    return local.date().replace(day=1)


def _duplicate_bin_error(bin_code: str, first_line: int) -> str:
    return f"Bin '{bin_code}' already appears in row {first_line}."


# --- Shared request checks ------------------------------------------------------------------


def _parse_report_month(report_month: str) -> date:
    year, month = (int(part) for part in report_month.split("-")[:2])
    if not 1 <= month <= 12:
        raise HTTPException(status_code=422, detail="Choose a valid report month.")
    return date(year, month, 1)


def _require_contractor(session: Session, contractor_id: int) -> Contractor:
    contractor = session.get(Contractor, contractor_id)
    if contractor is None or not contractor.is_active:
        raise HTTPException(status_code=422, detail="Select an active contractor.")
    return contractor


# --- Endpoints ------------------------------------------------------------------------------


@router.get("/options", response_model=ContractorReportOptionsResponse)
def get_import_options(session: SessionDependency) -> ContractorReportOptionsResponse:
    contractors = session.exec(
        select(Contractor).where(Contractor.is_active).order_by(Contractor.name)
    ).all()
    return ContractorReportOptionsResponse(
        contractors=[ContractorReportOptionItem(id=c.id, name=c.name) for c in contractors],
    )


@router.post("/parse-and-validate", response_model=ContractorReportFileParseResponse)
def parse_and_validate_file(
    request: ContractorReportFileParseRequest,
    session: SessionDependency,
) -> ContractorReportFileParseResponse:
    """Read an uploaded CSV or XLSX report and check every row, without saving anything."""

    require_management_actor(session, request.actor_id)
    contractor = (
        _require_contractor(session, request.contractor_id) if request.contractor_id else None
    )
    month_start = _parse_report_month(request.report_month) if request.report_month else None
    raw_bytes = _decode_upload(request.content_base64)

    lower_name = request.filename.lower()
    if lower_name.endswith(".xlsx"):
        records = _read_xlsx_records(raw_bytes)
    elif lower_name.endswith(".csv"):
        records = _read_csv_records(raw_bytes)
    else:
        raise HTTPException(
            status_code=422,
            detail="Unsupported format. Please upload a .csv or .xlsx file.",
        )
    if not records:
        raise HTTPException(status_code=422, detail="The uploaded spreadsheet has no data rows.")

    report_bins = _load_report_bins(
        session, (record.values.get("bin_id", "") for record in records)
    )
    first_line_by_bin: dict[str, int] = {}
    parsed_rows: list[ContractorReportParsedRow] = []
    for record in records:
        parsed = _build_parsed_row(record, report_bins, month_start, contractor)
        # A bin is reported once: the first row for it counts and later repeats are rejected.
        if parsed.bin_id:
            first_line = first_line_by_bin.setdefault(parsed.bin_id.upper(), parsed.row)
            if first_line != parsed.row:
                parsed.errors.insert(0, _duplicate_bin_error(parsed.bin_id, first_line))
                parsed.warnings = []
                parsed.status = "Error"
        parsed_rows.append(parsed)
    return ContractorReportFileParseResponse(filename=request.filename, rows=parsed_rows)


def _build_parsed_row(
    record: ReportRecord,
    report_bins: ReportBins,
    month_start: date | None,
    contractor: Contractor | None,
) -> ContractorReportParsedRow:
    values = record.values
    bin_id = values.get("bin_id", "").strip()
    errors: list[str] = []
    received_kg, received_error = _parse_weight(
        values.get("received_kg"), "received_kg", required=True
    )
    if received_error:
        errors.append(received_error)
    category_weights: dict[str, Decimal] = {}
    for column in CATEGORY_COLUMNS:
        weight, weight_error = _parse_weight(values.get(column), column, required=False)
        category_weights[column] = weight
        if weight_error:
            errors.append(weight_error)
    dispositions = ContractorDispositionWeights(**category_weights)
    categorized, uncategorized, total_errors = _weight_totals(received_kg, dispositions)
    if not errors:  # Totals mean nothing when a weight couldn't be read
        errors.extend(total_errors)

    site: Site | None = None
    handoff: Handoff | None = None
    if not bin_id:
        errors.insert(0, "Bin ID is missing.")
    else:
        bin_record, handoff, bin_errors = _check_report_bin(
            report_bins, bin_id, month_start=month_start, contractor=contractor
        )
        errors[:0] = bin_errors
        if bin_record is not None:
            site = report_bins.site_of(bin_record)

    staff_weight = handoff.staff_weight_kg if handoff is not None else None
    warnings: list[str] = []
    if not errors:
        if uncategorized > ZERO:
            warnings.append(f"Uncategorized remainder: {uncategorized:.2f} kg.")
        if staff_weight and abs(received_kg - staff_weight) / staff_weight > STAFF_WEIGHT_VARIANCE:
            diff = (received_kg - staff_weight).quantize(Decimal("0.01"))
            warnings.append(
                f"Received weight differs from the staff weight by more than 3% ({diff:+} kg)."
            )
        reported_kg = report_bins.reported_kg(handoff) if handoff is not None else None
        if reported_kg is not None:
            warnings.append(
                f"Already reported: saving replaces the existing outcomes ({reported_kg:.2f} kg)."
            )

    return ContractorReportParsedRow(
        row=record.line,
        bin_id=bin_id,
        site_name=site.name if site is not None else None,
        staff_weight_kg=float(staff_weight) if staff_weight is not None else None,
        received_kg=float(received_kg),
        dispositions=dispositions,
        categorized_weight_kg=float(categorized),
        uncategorized_weight_kg=float(uncategorized),
        status="Error" if errors else "Warning" if warnings else "Verified",
        errors=errors,
        warnings=warnings,
    )


@router.post("/import", response_model=ContractorReportImportResponse, status_code=201)
def import_contractor_report(
    payload: ContractorReportImportRequest,
    session: SessionDependency,
) -> ContractorReportImportResponse:
    """Save a contractor's monthly report against the bins it lists.

    Every row is checked again; if any fails, nothing is saved. Rows are grouped by their bin's
    site and one report is saved per site. A bin reported again has its outcomes replaced.
    """

    require_management_actor(session, payload.actor_id)
    contractor = _require_contractor(session, payload.contractor_id)
    month_start = _parse_report_month(payload.report_month)

    # CR #14: Enforce quarter lock before modifying persisted report inputs.
    lock_open_epr_quarter(session, month_start)

    report_bins = _load_report_bins(session, (row.bin_id for row in payload.rows))
    rows_by_site: dict[int, list[tuple[ContractorReportImportRowRequest, Handoff]]] = defaultdict(
        list
    )
    first_line_by_bin: dict[str, int] = {}
    for row in payload.rows:
        clean_bin = row.bin_id.strip()
        if not clean_bin:
            raise HTTPException(status_code=422, detail=f"Row {row.row}: Bin ID is missing.")
        first_line = first_line_by_bin.setdefault(clean_bin.upper(), row.row)
        if first_line != row.row:
            raise HTTPException(
                status_code=422,
                detail=f"Row {row.row}: {_duplicate_bin_error(clean_bin, first_line)}",
            )
        bin_record, handoff, errors = _check_report_bin(
            report_bins, clean_bin, month_start=month_start, contractor=contractor
        )
        errors += _weight_totals(row.received_kg, row.dispositions)[2]
        if errors or bin_record is None or handoff is None:
            raise HTTPException(status_code=422, detail=f"Row {row.row}: {' '.join(errors)}")
        rows_by_site[bin_record.site_id].append((row, handoff))

    now = utc_now()
    total_received = ZERO
    total_categorized = ZERO
    saved: list[tuple[ContractorReport, Site, int]] = []
    try:
        for site_id, site_rows in rows_by_site.items():
            report = session.exec(
                select(ContractorReport).where(
                    ContractorReport.site_id == site_id,
                    ContractorReport.contractor_id == contractor.id,
                    ContractorReport.report_month == month_start,
                )
            ).one_or_none()
            if report is None:
                report = ContractorReport(
                    site_id=site_id,
                    contractor_id=contractor.id,
                    uploaded_by_user_id=payload.actor_id,
                    report_month=month_start,
                    source_filename=payload.source_filename,
                    status=ReportStatus.IMPORTED,
                    validated_at=now,
                )
                session.add(report)
                session.flush()
            else:
                report.uploaded_by_user_id = payload.actor_id
                report.source_filename = payload.source_filename
                report.status = ReportStatus.IMPORTED
                report.validated_at = now

            for row, handoff in site_rows:
                handoff.contractor_received_kg = row.received_kg
                total_received += row.received_kg
                for category, weight in _disposition_weights(row.dispositions):
                    total_categorized += weight
                    # One entry per handoff and category: a re-reported bin's outcomes are
                    # replaced.
                    entry = report_bins.entries.get((handoff.id, category))
                    if entry is None:
                        session.add(
                            ContractorReportEntry(
                                contractor_report_id=report.id,
                                handoff_id=handoff.id,
                                disposition=category,
                                weight_kg=weight,
                                evidence_status=EvidenceStatus.CONTRACTOR_DECLARED,
                                destination=f"Contractor facility: {category.value}",
                            )
                        )
                    else:
                        entry.contractor_report_id = report.id
                        entry.weight_kg = weight
            saved.append((report, report_bins.sites[site_id], len(site_rows)))
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail="Another import of this report was saved at the same time. Try again.",
        ) from None

    site_names = ", ".join(site.name for _report, site, _count in saved)
    return ContractorReportImportResponse(
        reports=[
            ContractorReportImportSiteResult(
                report_id=report.id,
                site_id=site.id,
                site_name=site.name,
                imported_rows=count,
            )
            for report, site, count in saved
        ],
        contractor_name=contractor.name,
        report_month=month_start,
        imported_rows=len(payload.rows),
        total_received_kg=float(total_received),
        total_categorized_weight_kg=float(total_categorized),
        message=(
            f"Successfully imported {len(payload.rows)} validated record(s) "
            f"for {site_names} ({month_start:%Y-%m})."
        ),
    )
