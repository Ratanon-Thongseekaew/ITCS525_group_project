import base64
import io
import zipfile
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.contractor_reports import MAX_DATA_ROWS
from app.database import get_session
from app.main import app
from app.models import (
    Bin,
    BinType,
    Contractor,
    ContractorReport,
    ContractorReportEntry,
    DispositionCategory,
    EprQuarterReport,
    EprReportStatus,
    Handoff,
    Site,
    User,
    utc_now,
)
from app.schemas import UserRole

NOV_PICKUP = datetime(2026, 11, 20, 4, 0, tzinfo=UTC)
COLUMNS = (
    "bin_id,received_kg,upcycled_kg,fibre_to_fibre_kg,downcycled_kg,exported_kg,"
    "landfilled_kg,incinerated_energy_recovery_kg"
)
# 3 + 8 + 4 + 2 + 1 + 2 = 20 kg, matching the 20 kg received.
WEIGHTS = "20.0,3.0,8.0,4.0,2.0,1.0,2.0"


class ImportContext:
    def __init__(self, client: TestClient, engine) -> None:
        self.client = client
        self.engine = engine

    def id_of(self, model, **where) -> int:
        with Session(self.engine) as session:
            statement = select(model.id)
            for field, value in where.items():
                statement = statement.where(getattr(model, field) == value)
            return session.exec(statement).one()

    @property
    def manager_id(self) -> int:
        return self.id_of(User, username="manager@test.local")

    @property
    def staff_id(self) -> int:
        return self.id_of(User, username="staff@test.local")

    @property
    def greenloop_id(self) -> int:
        return self.id_of(Contractor, name="GreenLoop Partner")

    @property
    def reweave_id(self) -> int:
        return self.id_of(Contractor, name="ReWeave Recyclers")

    def parse_file(self, filename: str, content: bytes, **fields):
        return self.client.post(
            "/api/contractor-reports/parse-and-validate",
            json={
                "actor_id": self.manager_id,
                "filename": filename,
                "content_base64": base64.b64encode(content).decode("ascii"),
                "report_month": "2026-11",
                "contractor_id": self.greenloop_id,
                **fields,
            },
        )

    def parse_csv(self, *lines: str, header: str = COLUMNS, **fields):
        return self.parse_file("report.csv", "\n".join([header, *lines]).encode(), **fields)

    def parse(self, *bin_codes: str, **fields) -> list[dict]:
        response = self.parse_csv(*(f"{code},{WEIGHTS}" for code in bin_codes), **fields)
        assert response.status_code == 200, response.text
        return response.json()["rows"]

    def import_rows(self, *rows: dict, **fields):
        return self.client.post(
            "/api/contractor-reports/import",
            json={
                "actor_id": self.manager_id,
                "contractor_id": self.greenloop_id,
                "report_month": "2026-11",
                "source_filename": "report.csv",
                "rows": list(rows),
                **fields,
            },
        )


def import_row(row: int, bin_id: str, received_kg: float = 20.0, landfilled_kg: float = 1.0):
    return {
        "row": row,
        "bin_id": bin_id,
        "received_kg": received_kg,
        "dispositions": {
            "upcycled_kg": 3.0,
            "fibre_to_fibre_kg": 8.0,
            "downcycled_kg": 4.0,
            "exported_kg": 2.0,
            "landfilled_kg": landfilled_kg,
            "incinerated_energy_recovery_kg": 2.0,
        },
    }


@pytest.fixture
def ctx():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        bkk = Site(code="BKK", name="Bangkok Test Center")
        cnx = Site(code="CNX", name="Chiang Mai Test Center")
        manager = User(username="manager@test.local", password_hash="unused", role=UserRole.MANAGER)
        staff = User(username="staff@test.local", password_hash="unused", role=UserRole.STAFF)
        greenloop = Contractor(name="GreenLoop Partner")
        reweave = Contractor(name="ReWeave Recyclers")
        session.add_all([bkk, cnx, manager, staff, greenloop, reweave])
        session.flush()

        def handed_off_bin(
            site: Site,
            code: str,
            picked_up_at: datetime | None,
            by: Contractor = greenloop,
            staff_weight_kg: Decimal | None = None,
        ) -> None:
            bin_record = Bin(site_id=site.id, code=code, bin_type=BinType.RECYCLE)
            session.add(bin_record)
            session.flush()
            session.add(
                Handoff(
                    site_id=site.id,
                    bin_id=bin_record.id,
                    contractor_id=by.id,
                    created_by_user_id=manager.id,
                    picked_up_at=picked_up_at,
                    staff_weight_kg=staff_weight_kg,
                )
            )

        handed_off_bin(bkk, "BKK-RC-001", NOV_PICKUP, staff_weight_kg=Decimal("20.0"))
        handed_off_bin(cnx, "CNX-RC-001", NOV_PICKUP)
        handed_off_bin(bkk, "BKK-RC-002", datetime(2026, 7, 20, 4, 0, tzinfo=UTC))
        handed_off_bin(bkk, "BKK-RC-003", NOV_PICKUP, by=reweave)
        handed_off_bin(bkk, "BKK-RC-004", None)  # Scheduled, not picked up yet
        handed_off_bin(bkk, "BKK-RC-005", NOV_PICKUP, staff_weight_kg=Decimal("25.0"))
        session.add(Bin(site_id=bkk.id, code="BKK-RC-009", bin_type=BinType.RECYCLE))
        session.commit()

    def override_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    yield ImportContext(TestClient(app), engine)
    app.dependency_overrides.clear()


def make_xlsx(rows: list[list[tuple[str, str]]]) -> bytes:
    """An XLSX whose rows list (cell reference, value) pairs; omitted cells stay empty."""

    sheet_rows = []
    for line, cells in enumerate(rows, 1):
        xml_cells = "".join(
            f'<c r="{ref}" t="inlineStr"><is><t>{value}</t></is></c>'
            if line == 1 or not value.replace(".", "").isdigit()
            else f'<c r="{ref}"><v>{value}</v></c>'
            for ref, value in cells
        )
        sheet_rows.append(f'<row r="{line}">{xml_cells}</row>')
    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        "<sheetData>" + "".join(sheet_rows) + "</sheetData></worksheet>"
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)
    return buffer.getvalue()


def xlsx_row(line: int, values: list[str]) -> list[tuple[str, str]]:
    return [(f"{chr(65 + idx)}{line}", value) for idx, value in enumerate(values) if value != ""]


# --- Reading files --------------------------------------------------------------------------


def test_options_list_active_contractors_only(ctx) -> None:
    response = ctx.client.get("/api/contractor-reports/options")

    assert response.status_code == 200
    assert response.json() == {
        "contractors": [
            {"id": ctx.greenloop_id, "name": "GreenLoop Partner"},
            {"id": ctx.reweave_id, "name": "ReWeave Recyclers"},
        ]
    }


def test_parse_reports_spreadsheet_lines_sites_and_ignores_legacy_columns(ctx) -> None:
    response = ctx.parse_csv(
        f"BKK-RC-001,Old Partner,99,{WEIGHTS}",
        f"CNX-RC-001,Old Partner,99,{WEIGHTS}",
        header=COLUMNS.replace("bin_id,", "bin_id,contractor,store_weight_kg,"),
    )

    assert response.status_code == 200
    bkk, cnx = response.json()["rows"]
    assert (bkk["row"], bkk["status"], bkk["site_name"]) == (2, "Verified", "Bangkok Test Center")
    assert (cnx["row"], cnx["status"], cnx["site_name"]) == (
        3,
        "Verified",
        "Chiang Mai Test Center",
    )
    assert bkk["staff_weight_kg"] == 20.0 and cnx["staff_weight_kg"] is None
    assert "contractor" not in bkk and "store_weight_kg" not in bkk


def test_xlsx_empty_cells_keep_later_columns_in_place(ctx) -> None:
    header = COLUMNS.split(",")
    # downcycled_kg (column E) is left empty, as Excel does for blank cells.
    data = ["BKK-RC-001", "20.0", "3.0", "8.0", "", "2.0", "1.0", "2.0"]

    response = ctx.parse_file("report.xlsx", make_xlsx([xlsx_row(1, header), xlsx_row(2, data)]))

    assert response.status_code == 200
    (row,) = response.json()["rows"]
    assert row["dispositions"] == {
        "upcycled_kg": "3.0",
        "fibre_to_fibre_kg": "8.0",
        "downcycled_kg": "0",
        "exported_kg": "2.0",
        "landfilled_kg": "1.0",
        "incinerated_energy_recovery_kg": "2.0",
    }
    assert row["uncategorized_weight_kg"] == 4.0
    assert row["warnings"] == ["Uncategorized remainder: 4.00 kg."]


def test_unreadable_negative_and_missing_weights_reject_the_row(ctx) -> None:
    response = ctx.parse_csv(
        "BKK-RC-001,abc,3,8,4,2,1,2",
        "CNX-RC-001,20,3,8,-4,2,1,2",
        'BKK-RC-005,20,"1,234.5",8,4,2,1,2',
        "BKK-RC-001,,3,8,4,2,1,2",
        "CNX-RC-001,20 kg,3,8,,2,1,2",
    )

    assert response.status_code == 200
    text, negative, comma, missing, blank_category = response.json()["rows"]
    assert text["errors"] == ["received_kg: 'abc' is not a number."]
    assert negative["errors"] == ["downcycled_kg can't be negative."]
    assert comma["errors"] == ["upcycled_kg: '1,234.5' is not a number."]
    assert missing["errors"][0] == "Bin 'BKK-RC-001' already appears in row 2."
    assert "received_kg is missing." in missing["errors"]
    # A blank category counts as 0, and "kg" after a number is allowed.
    assert blank_category["errors"] == ["Bin 'CNX-RC-001' already appears in row 3."]
    assert blank_category["dispositions"]["downcycled_kg"] == "0"


def test_disposition_weights_above_received_reject_the_row(ctx) -> None:
    (row,) = ctx.parse_csv("BKK-RC-001,10,3,8,4,2,1,2").json()["rows"]

    assert row["status"] == "Error"
    assert row["errors"] == ["Disposition weights exceed received weight by 10.000 kg."]
    assert row["uncategorized_weight_kg"] == 0.0


@pytest.mark.parametrize(
    "header",
    [
        "bin_id,upcycled_kg,fibre_to_fibre_kg,downcycled_kg,exported_kg,landfilled_kg,"
        "incinerated_energy_recovery_kg",
        COLUMNS.replace("landfilled_kg", "landfiled_kg"),
    ],
)
def test_missing_required_columns_reject_the_file(ctx, header) -> None:
    response = ctx.parse_csv("BKK-RC-001,3,8,4,2,1,2", header=header)

    assert response.status_code == 422
    assert response.json()["detail"].startswith("The file is missing required columns: ")


def test_oversized_files_and_too_many_rows_are_rejected(ctx) -> None:
    too_big = ctx.parse_file("report.csv", b"x" * (5 * 1024 * 1024 + 1))
    assert too_big.status_code == 413

    too_many = ctx.parse_csv(*(f"BIN-{n},{WEIGHTS}" for n in range(MAX_DATA_ROWS + 1)))
    assert too_many.status_code == 422
    assert f"at most {MAX_DATA_ROWS}" in too_many.json()["detail"]


# --- Row checks -----------------------------------------------------------------------------


def test_parse_rejects_unknown_bins_and_bins_without_a_handoff(ctx) -> None:
    unknown, not_handed_off, no_bin = ctx.parse_csv(
        f"BKK-RC-404,{WEIGHTS}", f"BKK-RC-009,{WEIGHTS}", f",{WEIGHTS}"
    ).json()["rows"]

    assert unknown["errors"] == ["Bin 'BKK-RC-404' was not found."]
    assert unknown["site_name"] is None
    assert not_handed_off["errors"] == ["Bin 'BKK-RC-009' has no handoff to a contractor."]
    assert no_bin["errors"] == ["Bin ID is missing."]


def test_parse_rejects_bins_not_picked_up_in_the_report_month(ctx) -> None:
    other_month, not_picked_up = ctx.parse("BKK-RC-002", "BKK-RC-004")

    assert other_month["errors"] == [
        "Bin 'BKK-RC-002' was picked up in 2026-07, not in the report month 2026-11."
    ]
    assert not_picked_up["errors"] == ["Bin 'BKK-RC-004' has not been picked up yet."]
    (july,) = ctx.parse("BKK-RC-002", report_month="2026-07")
    assert july["status"] == "Verified"


def test_parse_rejects_bins_handed_off_to_another_contractor(ctx) -> None:
    (row,) = ctx.parse("BKK-RC-003")
    assert row["errors"] == [
        "Bin 'BKK-RC-003' was handed off to ReWeave Recyclers, not GreenLoop Partner."
    ]

    (matching,) = ctx.parse("BKK-RC-003", contractor_id=ctx.reweave_id)
    assert matching["status"] == "Verified"


def test_parse_keeps_the_first_row_for_a_bin_and_rejects_repeats(ctx) -> None:
    first, other, repeat = ctx.parse("BKK-RC-001", "CNX-RC-001", "bkk-rc-001")

    assert first["status"] == other["status"] == "Verified"
    assert repeat["status"] == "Error"
    assert repeat["errors"][0] == "Bin 'bkk-rc-001' already appears in row 2."


def test_warnings_are_separate_from_errors(ctx) -> None:
    (row,) = ctx.parse("BKK-RC-005")  # Staff weighed 25 kg; the contractor received 20 kg

    assert row["status"] == "Warning"
    assert row["errors"] == []
    assert row["warnings"] == [
        "Received weight differs from the staff weight by more than 3% (-5.00 kg)."
    ]


def test_bin_lookups_do_not_grow_with_the_number_of_rows(ctx) -> None:
    statements: list[str] = []

    def count(_conn, _cursor, statement, *_args) -> None:
        statements.append(statement)

    manager_id, greenloop_id = ctx.manager_id, ctx.greenloop_id
    event.listen(ctx.engine, "before_cursor_execute", count)
    try:
        ctx.parse("BKK-RC-001", actor_id=manager_id, contractor_id=greenloop_id)
        one_row = len(statements)
        statements.clear()
        ctx.parse(
            "BKK-RC-001",
            "CNX-RC-001",
            "BKK-RC-003",
            "BKK-RC-404",
            actor_id=manager_id,
            contractor_id=greenloop_id,
        )
        assert len(statements) == one_row
    finally:
        event.remove(ctx.engine, "before_cursor_execute", count)


# --- Access ---------------------------------------------------------------------------------


@pytest.mark.parametrize("actor", ["staff", "missing"])
def test_only_managers_and_admins_can_parse_or_import(ctx, actor) -> None:
    actor_id = ctx.staff_id if actor == "staff" else 999_999
    detail = "Select an existing manager or admin account."

    parse = ctx.parse_csv(f"BKK-RC-001,{WEIGHTS}", actor_id=actor_id)
    imported = ctx.import_rows(import_row(2, "BKK-RC-001"), actor_id=actor_id)

    assert (parse.status_code, parse.json()["detail"]) == (422, detail)
    assert (imported.status_code, imported.json()["detail"]) == (422, detail)


# --- Saving ---------------------------------------------------------------------------------


def test_import_saves_one_report_per_site_and_the_received_weight(ctx) -> None:
    response = ctx.import_rows(
        import_row(2, "BKK-RC-001"), import_row(3, "CNX-RC-001", received_kg=21.5)
    )

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["imported_rows"] == 2
    assert sorted((r["site_name"], r["imported_rows"]) for r in data["reports"]) == [
        ("Bangkok Test Center", 1),
        ("Chiang Mai Test Center", 1),
    ]
    with Session(ctx.engine) as session:
        reports = session.exec(select(ContractorReport)).all()
        assert len(reports) == 2
        assert {report.uploaded_by_user_id for report in reports} == {ctx.manager_id}
        assert len(session.exec(select(ContractorReportEntry)).all()) == 12
        received = {
            handoff.contractor_received_kg
            for handoff in session.exec(select(Handoff)).all()
            if handoff.contractor_received_kg is not None
        }
        assert received == {Decimal("20.000"), Decimal("21.500")}


def test_reimport_flags_and_replaces_existing_outcomes(ctx) -> None:
    assert ctx.import_rows(import_row(2, "BKK-RC-001")).status_code == 201

    (reported,) = ctx.parse("BKK-RC-001")
    assert reported["status"] == "Warning"
    assert reported["warnings"] == [
        "Already reported: saving replaces the existing outcomes (20.00 kg)."
    ]

    corrected = ctx.import_rows(import_row(2, "BKK-RC-001", received_kg=19.5, landfilled_kg=0.5))
    assert corrected.status_code == 201
    with Session(ctx.engine) as session:
        assert len(session.exec(select(ContractorReport)).all()) == 1
        assert len(session.exec(select(ContractorReportEntry)).all()) == 6
        landfilled = session.exec(
            select(ContractorReportEntry).where(
                ContractorReportEntry.disposition == DispositionCategory.LANDFILLED
            )
        ).one()
        assert landfilled.weight_kg == Decimal("0.5")
        handoff = session.exec(
            select(Handoff).where(Handoff.contractor_received_kg.is_not(None))
        ).one()
        assert handoff.contractor_received_kg == Decimal("19.5")


@pytest.mark.parametrize(
    ("rows", "detail"),
    [
        (
            [import_row(2, "BKK-RC-001"), import_row(3, "BKK-RC-404")],
            "Row 3: Bin 'BKK-RC-404' was not found.",
        ),
        ([import_row(2, "BKK-RC-009")], "Row 2: Bin 'BKK-RC-009' has no handoff to a contractor."),
        (
            [import_row(2, "BKK-RC-002")],
            "Row 2: Bin 'BKK-RC-002' was picked up in 2026-07, not in the report month 2026-11.",
        ),
        (
            [import_row(2, "BKK-RC-003")],
            "Row 2: Bin 'BKK-RC-003' was handed off to ReWeave Recyclers, not GreenLoop Partner.",
        ),
        (
            [import_row(2, "BKK-RC-001"), import_row(3, "BKK-RC-001")],
            "Row 3: Bin 'BKK-RC-001' already appears in row 2.",
        ),
        (
            [import_row(2, "BKK-RC-001", received_kg=10)],
            "Row 2: Disposition weights exceed received weight by 10.000 kg.",
        ),
    ],
)
def test_import_rejects_invalid_rows_and_saves_nothing(ctx, rows, detail) -> None:
    response = ctx.import_rows(*rows)

    assert response.status_code == 422
    assert response.json()["detail"] == detail
    with Session(ctx.engine) as session:
        assert session.exec(select(ContractorReport)).all() == []
        assert session.exec(select(Bin).where(Bin.code == "BKK-RC-404")).first() is None


def test_import_rejects_an_unknown_contractor(ctx) -> None:
    response = ctx.import_rows(import_row(2, "BKK-RC-001"), contractor_id=999_999)

    assert response.status_code == 422
    assert response.json()["detail"] == "Select an active contractor."


def test_import_rejects_negative_weights(ctx) -> None:
    response = ctx.import_rows(import_row(2, "BKK-RC-001", landfilled_kg=-1))

    assert response.status_code == 422


def test_import_is_blocked_for_a_locked_quarter(ctx) -> None:
    with Session(ctx.engine) as session:
        now = utc_now()
        session.add(
            EprQuarterReport(
                report_year=2026,
                quarter=3,
                status=EprReportStatus.SUBMITTED,
                submitted_at=now,
                locked_at=now,
            )
        )
        session.commit()

    response = ctx.import_rows(
        import_row(2, "BKK-RC-002"), report_month=date(2026, 8, 1).isoformat()
    )

    assert response.status_code == 409
