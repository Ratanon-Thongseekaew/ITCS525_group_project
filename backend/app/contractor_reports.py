import base64
import csv
import io
import zipfile
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Annotated
from xml.etree import ElementTree as ET

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from .database import get_session
from .epr import lock_open_epr_quarter
from .models import (
    Bin,
    BinStatus,
    BinType,
    Contractor,
    ContractorReport,
    ContractorReportEntry,
    DispositionCategory,
    EvidenceStatus,
    Handoff,
    HandoffStatus,
    ReportStatus,
    Site,
    User,
    utc_now,
)
from .schemas import (
    ContractorDispositionWeights,
    ContractorReportFileParseRequest,
    ContractorReportFileParseResponse,
    ContractorReportImportRequest,
    ContractorReportImportResponse,
    ContractorReportOptionItem,
    ContractorReportOptionsResponse,
    ContractorReportParsedRow,
    ContractorReportValidationRequest,
    ContractorReportValidationResponse,
    ContractorReportValidationRowRequest,
    ContractorReportValidationRowResult,
    UserRole,
)

router = APIRouter(prefix="/api/contractor-reports", tags=["contractor reports"])
SessionDependency = Annotated[Session, Depends(get_session)]
ZERO = Decimal("0")

HEADER_ALIASES: dict[str, tuple[str, ...]] = {
    "bin_id": ("bin_id", "bin_code", "bin", "binid"),
    "contractor": ("contractor", "contractor_name", "partner"),
    "store_weight_kg": ("store_weight_kg", "store_wt", "store_weight", "staff_weight_kg"),
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


def validate_report_row(
    report_row: ContractorReportValidationRowRequest,
) -> ContractorReportValidationRowResult:
    dispositions = report_row.dispositions
    categorized_weight = sum(
        (
            dispositions.upcycled_kg,
            dispositions.fibre_to_fibre_kg,
            dispositions.downcycled_kg,
            dispositions.exported_kg,
            dispositions.landfilled_kg,
            dispositions.incinerated_energy_recovery_kg,
        ),
        start=ZERO,
    )

    errors: list[str] = []
    if categorized_weight > report_row.received_kg:
        excess_weight = categorized_weight - report_row.received_kg
        errors.append(
            "Disposition weights exceed received weight by "
            f"{excess_weight.quantize(Decimal('0.001'))} kg."
        )

    uncategorized_weight = max(ZERO, report_row.received_kg - categorized_weight)
    return ContractorReportValidationRowResult(
        row=report_row.row,
        categorized_weight_kg=float(categorized_weight),
        uncategorized_weight_kg=float(uncategorized_weight),
        is_valid=not errors,
        errors=errors,
    )


def _normalize_header(raw: str) -> str:
    cleaned = raw.strip().lower().replace("-", "_").replace(" ", "_")
    for canonical, aliases in HEADER_ALIASES.items():
        if cleaned in aliases:
            return canonical
    return cleaned


def _parse_decimal(raw_val: str | None) -> Decimal:
    if raw_val is None:
        return ZERO
    cleaned = str(raw_val).strip().lower().replace("kg", "").strip()
    if not cleaned:
        return ZERO
    try:
        val = Decimal(cleaned)
        return val if val >= ZERO else ZERO
    except InvalidOperation:
        return ZERO


def _read_csv_records(raw_bytes: bytes) -> list[dict[str, str]]:
    text = raw_bytes.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    records: list[dict[str, str]] = []
    for raw_row in reader:
        if not raw_row or all(not (v or "").strip() for v in raw_row.values()):
            continue
        records.append(
            {_normalize_header(k): (v or "").strip() for k, v in raw_row.items() if k is not None}
        )
    return records


def _read_xlsx_records(raw_bytes: bytes) -> list[dict[str, str]]:
    try:
        zf = zipfile.ZipFile(io.BytesIO(raw_bytes))
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=422, detail="Invalid XLSX spreadsheet file.") from exc

    with zf:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            ss_root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            for si in ss_root.findall("s:si", ns):
                parts = [t.text or "" for t in si.findall(".//s:t", ns)]
                shared_strings.append("".join(parts))

        sheet_name = "xl/worksheets/sheet1.xml"
        if sheet_name not in zf.namelist():
            raise HTTPException(status_code=422, detail="No worksheet found in XLSX file.")

        sheet_root = ET.fromstring(zf.read(sheet_name))
        ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        matrix: list[list[str]] = []
        for row_el in sheet_root.findall(".//s:sheetData/s:row", ns):
            row_vals: list[str] = []
            for cell in row_el.findall("s:c", ns):
                cell_type = cell.attrib.get("t", "")
                val_el = cell.find("s:v", ns)
                inline_el = cell.find("s:is/s:t", ns)
                if inline_el is not None and inline_el.text is not None:
                    row_vals.append(inline_el.text.strip())
                elif val_el is not None and val_el.text is not None:
                    raw_text = val_el.text.strip()
                    if cell_type == "s" and raw_text.isdigit():
                        idx = int(raw_text)
                        row_vals.append(
                            shared_strings[idx].strip() if idx < len(shared_strings) else ""
                        )
                    else:
                        row_vals.append(raw_text)
                else:
                    row_vals.append("")
            if any(row_vals):
                matrix.append(row_vals)

    if len(matrix) < 2:
        return []
    headers = [_normalize_header(h) for h in matrix[0]]
    records: list[dict[str, str]] = []
    for data_row in matrix[1:]:
        row_dict: dict[str, str] = {}
        for idx, header in enumerate(headers):
            row_dict[header] = data_row[idx].strip() if idx < len(data_row) else ""
        records.append(row_dict)
    return records


def _build_parsed_row(index: int, record: dict[str, str]) -> ContractorReportParsedRow:
    bin_id = record.get("bin_id", "").strip() or "MISSING_ID"
    contractor = record.get("contractor", "").strip() or "Unknown Contractor"
    store_wt = _parse_decimal(record.get("store_weight_kg"))
    received_wt = _parse_decimal(record.get("received_kg"))
    dispositions = ContractorDispositionWeights(
        upcycled_kg=_parse_decimal(record.get("upcycled_kg")),
        fibre_to_fibre_kg=_parse_decimal(record.get("fibre_to_fibre_kg")),
        downcycled_kg=_parse_decimal(record.get("downcycled_kg")),
        exported_kg=_parse_decimal(record.get("exported_kg")),
        landfilled_kg=_parse_decimal(record.get("landfilled_kg")),
        incinerated_energy_recovery_kg=_parse_decimal(record.get("incinerated_energy_recovery_kg")),
    )
    weight_check = validate_report_row(
        ContractorReportValidationRowRequest(
            row=index,
            received_kg=received_wt,
            dispositions=dispositions,
        )
    )
    errors = list(weight_check.errors)
    if bin_id.upper() == "MISSING_ID" or len(bin_id) < 3:
        errors.insert(0, "Missing or invalid Bin ID format.")

    if errors:
        status = "Error"
    elif weight_check.uncategorized_weight_kg > 0 or (
        store_wt > ZERO and abs(received_wt - store_wt) / store_wt > Decimal("0.03")
    ):
        status = "Warning"
        if weight_check.uncategorized_weight_kg > 0:
            errors.append(
                f"Uncategorized remainder: {weight_check.uncategorized_weight_kg:.2f} kg."
            )
        else:
            diff = (received_wt - store_wt).quantize(Decimal("0.01"))
            errors.append(f"Minor weight variance flagged ({diff:+} kg).")
    else:
        status = "Verified"

    return ContractorReportParsedRow(
        row=index,
        bin_id=bin_id,
        contractor=contractor,
        store_weight_kg=float(store_wt),
        received_kg=float(received_wt),
        dispositions=dispositions,
        categorized_weight_kg=weight_check.categorized_weight_kg,
        uncategorized_weight_kg=weight_check.uncategorized_weight_kg,
        status=status,
        errors=errors,
    )


@router.get("/options", response_model=ContractorReportOptionsResponse)
def get_import_options(session: SessionDependency) -> ContractorReportOptionsResponse:
    sites = session.exec(select(Site).where(Site.is_active).order_by(Site.id)).all()
    contractors = session.exec(
        select(Contractor).where(Contractor.is_active).order_by(Contractor.id)
    ).all()
    return ContractorReportOptionsResponse(
        sites=[ContractorReportOptionItem(id=s.id, code=s.code, name=s.name) for s in sites],
        contractors=[ContractorReportOptionItem(id=c.id, name=c.name) for c in contractors],
    )


@router.post("/validate", response_model=ContractorReportValidationResponse)
async def validate_contractor_report(
    request: ContractorReportValidationRequest,
) -> ContractorReportValidationResponse:
    return ContractorReportValidationResponse(
        rows=[validate_report_row(report_row) for report_row in request.rows]
    )


@router.post("/parse-and-validate", response_model=ContractorReportFileParseResponse)
async def parse_and_validate_file(
    request: ContractorReportFileParseRequest,
) -> ContractorReportFileParseResponse:
    try:
        raw_bytes = base64.b64decode(request.content_base64)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Invalid base64 file content.") from exc

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

    parsed_rows = [_build_parsed_row(idx + 1, rec) for idx, rec in enumerate(records)]
    return ContractorReportFileParseResponse(filename=request.filename, rows=parsed_rows)


def _resolve_uploader(session: Session) -> User:
    manager = session.exec(
        select(User).where(User.role.in_([UserRole.MANAGER, UserRole.ADMIN])).order_by(User.id)
    ).first()
    if manager is not None:
        return manager
    fallback = User(
        username="import.manager@example.invalid",
        password_hash="demo-import-account",
        role=UserRole.MANAGER,
    )
    session.add(fallback)
    session.flush()
    return fallback


@router.post("/import", response_model=ContractorReportImportResponse, status_code=201)
def import_contractor_report(
    payload: ContractorReportImportRequest,
    session: SessionDependency,
) -> ContractorReportImportResponse:
    parts = payload.report_month.split("-")
    month_start = date(int(parts[0]), int(parts[1]), 1)

    # CR #14: Enforce quarter lock before modifying persisted report inputs.
    lock_open_epr_quarter(session, month_start)

    site = session.get(Site, payload.site_id)
    if site is None:
        raise HTTPException(status_code=404, detail="Selected site was not found.")

    clean_contractor_name = payload.contractor_name.strip()
    contractor = session.exec(
        select(Contractor).where(Contractor.name == clean_contractor_name)
    ).one_or_none()
    if contractor is None:
        contractor = Contractor(name=clean_contractor_name)
        session.add(contractor)
        session.flush()

    uploader = _resolve_uploader(session)

    site_upper = site.code.upper()
    other_site_tag = "-CNX-" if "BKK" in site_upper else "-BKK-" if "CNX" in site_upper else None

    for row in payload.rows:
        clean_bin = row.bin_id.strip()
        if not clean_bin or clean_bin.upper() == "MISSING_ID":
            raise HTTPException(status_code=422, detail=f"Row {row.row}: Invalid Bin ID.")
        if other_site_tag and other_site_tag in clean_bin.upper():
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Row {row.row}: Bin '{clean_bin}' belongs to another sorting center "
                    f"and cannot be imported under {site.name} ({site.code})."
                ),
            )
        check = validate_report_row(
            ContractorReportValidationRowRequest(
                row=row.row,
                received_kg=row.received_kg,
                dispositions=row.dispositions,
            )
        )
        if not check.is_valid:
            raise HTTPException(status_code=422, detail=f"Row {row.row}: {' '.join(check.errors)}")

    now = utc_now()
    report = session.exec(
        select(ContractorReport).where(
            ContractorReport.site_id == site.id,
            ContractorReport.contractor_id == contractor.id,
            ContractorReport.report_month == month_start,
        )
    ).one_or_none()
    if report is None:
        report = ContractorReport(
            site_id=site.id,
            contractor_id=contractor.id,
            uploaded_by_user_id=uploader.id,
            report_month=month_start,
            source_filename=payload.source_filename,
            status=ReportStatus.IMPORTED,
            validated_at=now,
        )
        session.add(report)
        session.flush()
    else:
        report.uploaded_by_user_id = uploader.id
        report.source_filename = payload.source_filename
        report.status = ReportStatus.IMPORTED
        report.validated_at = now

    total_received = ZERO
    total_categorized = ZERO

    for row in payload.rows:
        bin_code = row.bin_id.strip()
        bin_record = session.exec(
            select(Bin).where(Bin.site_id == site.id, Bin.code == bin_code)
        ).one_or_none()
        if bin_record is None:
            initial_wt = row.store_weight_kg if row.store_weight_kg > ZERO else row.received_kg
            bin_record = Bin(
                site_id=site.id,
                code=bin_code,
                bin_type=BinType.RECYCLE,
                status=BinStatus.CLOSED,
                item_count=max(1, int(initial_wt)),
                total_weight_kg=initial_wt,
                closed_at=now,
                notes="Created via contractor monthly report import",
            )
            session.add(bin_record)
            session.flush()

        handoff = session.exec(select(Handoff).where(Handoff.bin_id == bin_record.id)).one_or_none()
        if handoff is None:
            staff_wt = (
                bin_record.total_weight_kg if bin_record.total_weight_kg > ZERO else row.received_kg
            )
            handoff = Handoff(
                site_id=site.id,
                bin_id=bin_record.id,
                contractor_id=contractor.id,
                created_by_user_id=uploader.id,
                scheduled_pickup_at=now,
                picked_up_at=now,
                scale_photo_url=f"https://example.invalid/scales/{bin_code}.jpg",
                driver_name="Contractor Driver",
                vehicle_plate_number="IMPORT-01",
                status=HandoffStatus.CLOSED,
                closed_at=now,
            )
            handoff.record_pickup_weights(staff_wt, row.received_kg)
            if not handoff.requires_manager_approval:
                handoff.status = HandoffStatus.CLOSED
                handoff.closed_at = now
            else:
                handoff.closed_at = None
            session.add(handoff)
            session.flush()

        disposition_map: list[tuple[DispositionCategory, Decimal]] = [
            (DispositionCategory.UPCYCLED, row.dispositions.upcycled_kg),
            (DispositionCategory.FIBRE_TO_FIBRE, row.dispositions.fibre_to_fibre_kg),
            (DispositionCategory.DOWNCYCLED, row.dispositions.downcycled_kg),
            (DispositionCategory.EXPORTED, row.dispositions.exported_kg),
            (DispositionCategory.LANDFILLED, row.dispositions.landfilled_kg),
            (
                DispositionCategory.INCINERATED_ENERGY_RECOVERY,
                row.dispositions.incinerated_energy_recovery_kg,
            ),
        ]

        total_received += row.received_kg
        for category, weight_val in disposition_map:
            total_categorized += weight_val
            entry = session.exec(
                select(ContractorReportEntry).where(
                    ContractorReportEntry.contractor_report_id == report.id,
                    ContractorReportEntry.handoff_id == handoff.id,
                    ContractorReportEntry.disposition == category,
                )
            ).one_or_none()
            if entry is None:
                session.add(
                    ContractorReportEntry(
                        contractor_report_id=report.id,
                        handoff_id=handoff.id,
                        disposition=category,
                        weight_kg=weight_val,
                        evidence_status=EvidenceStatus.CONTRACTOR_DECLARED,
                        destination=f"Contractor facility: {category.value}",
                    )
                )
            else:
                entry.weight_kg = weight_val

    session.commit()
    return ContractorReportImportResponse(
        report_id=report.id,
        site_id=site.id,
        site_name=site.name,
        contractor_name=contractor.name,
        report_month=month_start,
        imported_rows=len(payload.rows),
        total_received_kg=float(total_received),
        total_categorized_weight_kg=float(total_categorized),
        message=(
            f"Successfully imported {len(payload.rows)} validated record(s) "
            f"for {site.name} ({month_start.strftime('%Y-%m')})."
        ),
    )
