from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.database import get_session
from app.main import app
from app.models import ContractorReport, ContractorReportEntry, Handoff, Site

# The demo seed is pinned to 2026-11-27: October is last month (BKK and KKC reports pending),
# Q3 is fully reported, and November has one disputed handoff awaiting approval.


@pytest.fixture
def dashboard_engine(demo_engine):
    def override_session():
        with Session(demo_engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    yield demo_engine
    app.dependency_overrides.clear()


@pytest.fixture
def dashboard_client(dashboard_engine):
    with TestClient(app) as client:
        yield client


def october_weights(engine, site_code: str | None = None) -> tuple[float, float]:
    """Staff weight picked up in October and outcome weight reported for October."""

    start, end = datetime(2026, 10, 1, tzinfo=UTC), datetime(2026, 11, 1, tzinfo=UTC)
    with Session(engine) as session:
        site_id = (
            session.exec(select(Site.id).where(Site.code == site_code)).one() if site_code else None
        )
        handoffs = [
            handoff
            for handoff in session.exec(select(Handoff)).all()
            if start <= handoff.picked_up_at.replace(tzinfo=UTC) < end
            and (site_id is None or handoff.site_id == site_id)
        ]
        entries = session.exec(
            select(ContractorReportEntry, ContractorReport).join(
                ContractorReport, ContractorReport.id == ContractorReportEntry.contractor_report_id
            )
        ).all()
        reported = [
            entry.weight_kg
            for entry, report in entries
            if report.report_month == start.date()
            and (site_id is None or report.site_id == site_id)
        ]
        return float(sum(h.staff_weight_kg for h in handoffs)), float(sum(reported))


def test_monthly_dashboard_aggregates_seeded_data(dashboard_client, dashboard_engine) -> None:
    response = dashboard_client.get(
        "/api/dashboard", params={"frequency": "monthly", "year": 2026, "month": 10}
    )

    assert response.status_code == 200
    payload = response.json()
    recorded, reported = october_weights(dashboard_engine)
    summary = payload["summary"]
    assert payload["period_label"] == "October 2026"
    assert summary["recycling_bins_collected"] == 10  # 5 stores x 2 recycle bins
    assert summary["recycling_bins_reported"] == 6  # BKK and KKC are still pending
    assert summary["pending_bins"] == 4
    assert summary["disputed_handoffs"] == 0
    assert summary["total_recorded_weight_kg"] == pytest.approx(recorded)
    assert summary["total_reported_weight_kg"] == pytest.approx(reported)
    assert {outcome["category"] for outcome in payload["outcomes"]} == {
        "upcycled",
        "fibre_to_fibre",
        "downcycled",
        "exported",
        "landfilled",
        "incinerated_energy_recovery",
    }
    assert {exception["status"] for exception in payload["exceptions"]} == {"pending"}
    assert len(payload["filters"]["sites"]) == 5
    assert len(payload["filters"]["contractors"]) == 3
    assert payload["filters"]["available_years"] == [2026, 2025]


def test_dashboard_filters_by_site(dashboard_client, dashboard_engine) -> None:
    options = dashboard_client.get("/api/dashboard", params={"year": 2026, "month": 10}).json()[
        "filters"
    ]
    site_ids = {site["code"]: site["id"] for site in options["sites"]}

    bangkok = dashboard_client.get(
        "/api/dashboard", params={"year": 2026, "month": 10, "site_id": site_ids["BKK"]}
    ).json()["summary"]
    chiang_mai = dashboard_client.get(
        "/api/dashboard", params={"year": 2026, "month": 10, "site_id": site_ids["CNX"]}
    ).json()["summary"]

    assert (bangkok["recycling_bins_collected"], bangkok["pending_bins"]) == (2, 2)
    assert bangkok["total_recorded_weight_kg"] == pytest.approx(
        october_weights(dashboard_engine, "BKK")[0]
    )
    assert bangkok["total_reported_weight_kg"] == 0
    assert (chiang_mai["recycling_bins_reported"], chiang_mai["pending_bins"]) == (2, 0)


def test_quarterly_dashboard_uses_quarter_boundaries(dashboard_client: TestClient) -> None:
    response = dashboard_client.get(
        "/api/dashboard",
        params={"frequency": "quarterly", "year": 2026, "quarter": 3},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["period_label"] == "Q3 2026"
    assert payload["month"] is None
    assert payload["quarter"] == 3
    assert payload["summary"]["recycling_bins_collected"] == 30
    assert payload["summary"]["recycling_bins_reported"] == 30
    assert payload["exceptions"] == []


def test_current_month_shows_the_disputed_handoff(dashboard_client: TestClient) -> None:
    payload = dashboard_client.get("/api/dashboard", params={"year": 2026, "month": 11}).json()

    assert payload["summary"]["disputed_handoffs"] == 1
    assert "disputed" in {exception["status"] for exception in payload["exceptions"]}


def test_dashboard_rejects_invalid_filters(dashboard_client: TestClient) -> None:
    assert dashboard_client.get("/api/dashboard?year=2026&month=13").status_code == 422
    assert dashboard_client.get("/api/dashboard?year=2026&site_id=9999").status_code == 404
    assert dashboard_client.get("/api/dashboard?year=2026&contractor_id=9999").status_code == 404
