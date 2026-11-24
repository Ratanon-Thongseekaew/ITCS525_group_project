import base64
import io
import zipfile
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.database import get_session
from app.main import app
from app.models import (
    ContractorReport,
    ContractorReportEntry,
    EprQuarterReport,
    EprReportStatus,
    Site,
    User,
    utc_now,
)
from app.schemas import UserRole

client = TestClient(app)


def report_row(*, received_kg: float, energy_recovery_kg: float = 5) -> dict:
    return {
        "row": 1,
        "received_kg": received_kg,
        "dispositions": {
            "upcycled_kg": 10,
            "fibre_to_fibre_kg": 20,
            "downcycled_kg": 10,
            "exported_kg": 5,
            "landfilled_kg": 10,
            "incinerated_energy_recovery_kg": energy_recovery_kg,
        },
    }


def test_validates_six_categories_and_returns_uncategorized_weight() -> None:
    response = client.post(
        "/api/contractor-reports/validate",
        json={"rows": [report_row(received_kg=100)]},
    )

    assert response.status_code == 200
    assert response.json() == {
        "rows": [
            {
                "row": 1,
                "categorized_weight_kg": 60.0,
                "uncategorized_weight_kg": 40.0,
                "is_valid": True,
                "errors": [],
            }
        ]
    }


def test_rejects_disposition_total_above_received_weight() -> None:
    response = client.post(
        "/api/contractor-reports/validate",
        json={"rows": [report_row(received_kg=50)]},
    )

    assert response.status_code == 200
    result = response.json()["rows"][0]
    assert result["categorized_weight_kg"] == 60.0
    assert result["uncategorized_weight_kg"] == 0.0
    assert result["is_valid"] is False
    assert result["errors"] == ["Disposition weights exceed received weight by 10.000 kg."]


def test_landfill_and_energy_recovery_are_counted_separately() -> None:
    response = client.post(
        "/api/contractor-reports/validate",
        json={"rows": [report_row(received_kg=100, energy_recovery_kg=15)]},
    )

    assert response.status_code == 200
    result = response.json()["rows"][0]
    assert result["categorized_weight_kg"] == 70.0
    assert result["uncategorized_weight_kg"] == 30.0


def test_rejects_negative_disposition_weight() -> None:
    row = report_row(received_kg=100)
    row["dispositions"]["landfilled_kg"] = -1

    response = client.post("/api/contractor-reports/validate", json={"rows": [row]})

    assert response.status_code == 422


def _build_import_test_client() -> tuple[TestClient, object]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        session.add(Site(code="TEST-BKK", name="Bangkok Test Center"))
        session.add(
            User(
                username="manager@test.local",
                password_hash="not-used-in-test",
                role=UserRole.MANAGER,
            )
        )
        session.commit()

    def _override_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = _override_session
    return TestClient(app), engine


def _make_sample_xlsx_base64() -> str:
    rows = [
        [
            "bin_id",
            "contractor",
            "store_weight_kg",
            "received_kg",
            "upcycled_kg",
            "fibre_to_fibre_kg",
            "downcycled_kg",
            "exported_kg",
            "landfilled_kg",
            "incinerated_energy_recovery_kg",
        ],
        [
            "BIN-TEST-01",
            "GreenLoop Partner",
            "20.0",
            "20.0",
            "3.0",
            "8.0",
            "4.0",
            "2.0",
            "1.0",
            "2.0",
        ],
    ]
    sheet_rows = []
    for r_idx, r in enumerate(rows, 1):
        cells = []
        for c_idx, val in enumerate(r):
            col = chr(65 + c_idx)
            if r_idx == 1 or c_idx < 2:
                cells.append(f'<c r="{col}{r_idx}" t="inlineStr"><is><t>{val}</t></is></c>')
            else:
                cells.append(f'<c r="{col}{r_idx}"><v>{val}</v></c>')
        sheet_rows.append(f'<row r="{r_idx}">' + "".join(cells) + "</row>")

    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        "<sheetData>" + "".join(sheet_rows) + "</sheetData></worksheet>"
    )
    ct_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" '
        'ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/'
        'vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/'
        'vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        "</Types>"
    )
    rels_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/'
        'officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        "</Relationships>"
    )
    wb_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>'
    )
    wb_rels = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/'
        'officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        "</Relationships>"
    )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("[Content_Types].xml", ct_xml)
        zf.writestr("_rels/.rels", rels_xml)
        zf.writestr("xl/workbook.xml", wb_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", wb_rels)
        zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def test_parse_import_and_locked_quarter_guard() -> None:
    client, engine = _build_import_test_client()
    try:
        options_resp = client.get("/api/contractor-reports/options")
        assert options_resp.status_code == 200
        site_id = options_resp.json()["sites"][0]["id"]

        parse_resp = client.post(
            "/api/contractor-reports/parse-and-validate",
            json={
                "filename": "nov_report.xlsx",
                "content_base64": _make_sample_xlsx_base64(),
            },
        )
        assert parse_resp.status_code == 200
        parsed_rows = parse_resp.json()["rows"]
        assert len(parsed_rows) == 1
        assert parsed_rows[0]["status"] == "Verified"

        import_resp = client.post(
            "/api/contractor-reports/import",
            json={
                "site_id": site_id,
                "contractor_name": "GreenLoop Partner",
                "report_month": "2026-11",
                "source_filename": "nov_report.xlsx",
                "rows": [
                    {
                        "row": 1,
                        "bin_id": "BIN-TEST-01",
                        "contractor": "GreenLoop Partner",
                        "store_weight_kg": 20.0,
                        "received_kg": 20.0,
                        "dispositions": parsed_rows[0]["dispositions"],
                    }
                ],
            },
        )
        assert import_resp.status_code == 201
        assert import_resp.json()["imported_rows"] == 1

        with Session(engine) as session:
            saved_reports = session.exec(select(ContractorReport)).all()
            saved_entries = session.exec(select(ContractorReportEntry)).all()
            assert len(saved_reports) == 1
            assert saved_reports[0].site_id == site_id
            assert len(saved_entries) == 6

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

        locked_resp = client.post(
            "/api/contractor-reports/import",
            json={
                "site_id": site_id,
                "contractor_name": "GreenLoop Partner",
                "report_month": date(2026, 8, 1).isoformat(),
                "source_filename": "aug_report.xlsx",
                "rows": [
                    {
                        "row": 1,
                        "bin_id": "BIN-TEST-02",
                        "contractor": "GreenLoop Partner",
                        "store_weight_kg": 20.0,
                        "received_kg": 20.0,
                        "dispositions": parsed_rows[0]["dispositions"],
                    }
                ],
            },
        )
        assert locked_resp.status_code == 409
    finally:
        app.dependency_overrides.clear()
