import re
from datetime import UTC, date, datetime

import pytest
from auth_helpers import bearer
from fastapi.testclient import TestClient
from sqlalchemy import make_url
from sqlmodel import Session, SQLModel, func, select

from app.database import get_session
from app.epr import lock_open_epr_quarter
from app.main import app
from app.models import (
    Bin,
    Contractor,
    ContractorReport,
    ContractorReportEntry,
    GarmentRecord,
    Handoff,
    HandoffStatus,
    Site,
    User,
    UserSite,
)
from seed import (
    DEFAULT_DEMO_PASSWORD,
    check_database_target,
    seed_demo_data,
    write_demo_reports,
)
from tests.conftest import DEMO_TODAY, memory_engine

STORE_CODES = {"BKK", "CNX", "HKT", "KKC", "HDY"}


@pytest.fixture
def client(demo_engine):
    def override_session():
        with Session(demo_engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def counts(session: Session) -> dict[str, int]:
    return {
        model.__name__: session.exec(select(func.count()).select_from(model)).one()
        for model in (Site, User, Contractor, Bin, GarmentRecord, Handoff, ContractorReport)
    }


def test_every_run_starts_clean_and_gives_the_same_data() -> None:
    engine = memory_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed_demo_data(session, DEMO_TODAY, password="first-run-pass")
        session.add(Site(code="OLD", name="Left over from before"))
        session.commit()
        first = counts(session)
        seed_demo_data(session, DEMO_TODAY, password="second-run-pass")
        second = counts(session)
        leftover = session.exec(select(Site).where(Site.code == "OLD")).first()

    assert leftover is None
    assert second == {**first, "Site": first["Site"] - 1}
    assert second["Site"] == 5
    assert second["Contractor"] == 3
    assert second["User"] == 11


def test_stores_and_bin_codes_follow_the_store_prefixed_format(demo_engine) -> None:
    with Session(demo_engine) as session:
        sites = {site.id: site.code for site in session.exec(select(Site)).all()}
        bins = session.exec(select(Bin)).all()

    assert set(sites.values()) == STORE_CODES
    for bin_record in bins:
        assert re.fullmatch(rf"{sites[bin_record.site_id]}-(RS|RC|RP)-\d{{3}}", bin_record.code)


def test_demo_accounts_log_in_and_managers_see_only_their_store(client, demo_engine) -> None:
    usernames = ["admin@example.com"] + [
        f"{role}.{code.lower()}@example.com"
        for role in ("manager", "staff")
        for code in STORE_CODES
    ]
    with Session(demo_engine) as session:
        users = {user.username: user for user in session.exec(select(User)).all()}
        hashes = {user.password_hash for user in users.values()}
        memberships = session.exec(
            select(User.username, Site.code)
            .select_from(UserSite)
            .join(User, User.id == UserSite.user_id)
            .join(Site, Site.id == UserSite.site_id)
        ).all()

    assert sorted(users) == sorted(usernames)
    assert len(hashes) == len(users)  # one password, but a different salted hash per account
    assert not any(user.must_change_password for user in users.values())
    for username in usernames:
        response = client.post(
            "/api/auth/login", json={"username": username, "password": DEFAULT_DEMO_PASSWORD}
        )
        assert response.status_code == 200, username
    for username, code in memberships:
        assert username.endswith(f".{code.lower()}@example.com")
    assert all(not username.startswith("admin") for username, _code in memberships)


def test_demo_password_can_come_from_the_environment(monkeypatch) -> None:
    monkeypatch.setenv("DEMO_PASSWORD", "my-own-demo-pass")
    engine = memory_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        data = seed_demo_data(session, DEMO_TODAY)

    assert data.password == "my-own-demo-pass"
    assert ("admin@example.com", "admin", "all stores") in data.accounts


def test_last_month_has_reports_to_import_and_its_quarter_is_open(demo_engine) -> None:
    october = (datetime(2026, 10, 1, tzinfo=UTC), datetime(2026, 11, 1, tzinfo=UTC))
    with Session(demo_engine) as session:
        reported = set(session.exec(select(ContractorReportEntry.handoff_id)).all())
        last_month = [
            (code, handoff)
            for code, handoff in session.exec(
                select(Site.code, Handoff).join(Site, Site.id == Handoff.site_id)
            ).all()
            if october[0] <= handoff.picked_up_at.replace(tzinfo=UTC) < october[1]
        ]
        unreported = {code for code, handoff in last_month if handoff.id not in reported}
        lock_open_epr_quarter(session, date(2026, 10, 1))  # raises if the quarter is locked

    assert unreported == {"BKK", "KKC"}
    assert all(
        handoff.status is HandoffStatus.PICKED_UP
        for code, handoff in last_month
        if code in unreported
    )


def test_demo_report_files_show_every_import_outcome(client, demo_engine, tmp_path) -> None:
    with Session(demo_engine) as session:
        files = write_demo_reports(session, DEMO_TODAY, tmp_path)
        admin_id = session.exec(select(User.id).where(User.username == "admin@example.com")).one()
        contractors = {c.name: c.id for c in session.exec(select(Contractor)).all()}

    names = sorted(path.name for path in files)
    assert names == ["circular-fibre-co-2026-10.csv", "greenloop-recycling-2026-10.csv"]

    def parse(name: str, contractor: str) -> list[dict]:
        import base64

        response = client.post(
            "/api/contractor-reports/parse-and-validate",
            json={
                "filename": name,
                "content_base64": base64.b64encode((tmp_path / name).read_bytes()).decode(),
                "report_month": "2026-10",
                "contractor_id": contractors[contractor],
            },
            headers=bearer(admin_id),
        )
        assert response.status_code == 200, response.text
        return response.json()["rows"]

    greenloop = parse("greenloop-recycling-2026-10.csv", "GreenLoop Recycling")
    assert [row["status"] for row in greenloop] == [
        "Verified",
        "Warning",
        "Warning",
        "Verified",
        "Error",
        "Error",
        "Error",
        "Error",
    ]
    assert greenloop[1]["warnings"][0].startswith("Uncategorized remainder")
    assert "staff weight" in greenloop[2]["warnings"][0]
    assert "already appears" in greenloop[4]["errors"][0]
    assert "was not found" in greenloop[5]["errors"][0]
    assert "handed off to Circular Fibre Co." in greenloop[6]["errors"][-1]
    assert "is not a number" in " ".join(greenloop[7]["errors"])

    circular = parse("circular-fibre-co-2026-10.csv", "Circular Fibre Co.")
    assert {row["status"] for row in circular} == {"Warning"}
    assert all(row["warnings"][-1].startswith("Already reported") for row in circular)


@pytest.mark.parametrize(
    ("url", "allow_remote", "allowed"),
    [
        ("mysql+pymysql://u:p@127.0.0.1:3307/textile_track", False, True),
        ("mysql+pymysql://u:p@localhost/textile_track", False, True),
        ("mysql+pymysql://u:p@mysql:3306/textile_track", False, True),
        ("sqlite://", False, True),
        ("mysql+pymysql://u:p@db.example.com/textile_track", False, False),
        ("mysql+pymysql://u:p@db.example.com/textile_track", True, True),
    ],
)
def test_reset_refuses_remote_databases_unless_allowed(url, allow_remote, allowed) -> None:
    if allowed:
        check_database_target(make_url(url), allow_remote=allow_remote)
    else:
        with pytest.raises(SystemExit, match="Refusing to reset"):
            check_database_target(make_url(url), allow_remote=allow_remote)
