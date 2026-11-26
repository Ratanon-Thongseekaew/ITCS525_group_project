from decimal import Decimal

from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlmodel import SQLModel

from alembic import command
from app.database import REPOSITORY_ROOT, get_engine
from app.models import (
    BinType,
    DispositionCategory,
    EprQuarterSiteSnapshot,
    GarmentOutcome,
    Handoff,
    HandoffStatus,
)

EXPECTED_TABLES = {
    "alembic_version",
    "bins",
    "contractor_report_entries",
    "contractor_reports",
    "contractors",
    "epr_adjustments",
    "epr_quarter_reports",
    "epr_quarter_site_snapshots",
    "garment_records",
    "handoffs",
    "resale_bin_processes",
    "sites",
    "user_sites",
    "users",
}


def alembic_config() -> Config:
    return Config(str(REPOSITORY_ROOT / "backend" / "alembic.ini"))


def test_sqlmodel_metadata_contains_initial_schema() -> None:
    assert EXPECTED_TABLES - {"alembic_version"} == set(SQLModel.metadata.tables)


def test_change_request_values_are_modeled() -> None:
    assert BinType.REPAIR.value == "repair"
    assert GarmentOutcome.REPAIR_UPCYCLE.value == "repair_upcycle"
    assert DispositionCategory.INCINERATED_ENERGY_RECOVERY.value == ("incinerated_energy_recovery")
    assert DispositionCategory.LANDFILLED is not DispositionCategory.INCINERATED_ENERGY_RECOVERY


def test_handoff_more_than_three_percent_is_disputed() -> None:
    handoff = Handoff(
        site_id=1,
        bin_id=1,
        contractor_id=1,
        created_by_user_id=1,
    )

    handoff.record_pickup_weights(Decimal("100"), Decimal("103.001"))

    assert handoff.weight_variance_percent == Decimal("3.0010")
    assert handoff.requires_manager_approval is True
    assert handoff.status is HandoffStatus.DISPUTED


def test_handoff_exactly_three_percent_is_not_disputed() -> None:
    handoff = Handoff(
        site_id=1,
        bin_id=1,
        contractor_id=1,
        created_by_user_id=1,
    )

    handoff.record_pickup_weights(Decimal("100"), Decimal("103"))

    assert handoff.weight_variance_percent == Decimal("3.0000")
    assert handoff.requires_manager_approval is False
    assert handoff.status is HandoffStatus.PICKED_UP


def test_epr_recovery_rate_excludes_landfilled_weight() -> None:
    snapshot = EprQuarterSiteSnapshot(
        epr_quarter_report_id=1,
        site_id=1,
        total_weight_received_kg=Decimal("100"),
        resold_weight_kg=Decimal("20"),
        repaired_weight_kg=Decimal("10"),
        fibre_to_fibre_weight_kg=Decimal("15"),
        downcycled_weight_kg=Decimal("5"),
        exported_weight_kg=Decimal("5"),
        upcycled_weight_kg=Decimal("5"),
        incinerated_energy_recovery_weight_kg=Decimal("10"),
        landfilled_weight_kg=Decimal("30"),
    )

    snapshot.recalculate_recovery_rate()

    assert snapshot.recovery_rate == Decimal("0.7000000")


def test_initial_migration_upgrades_and_downgrades_sqlite(tmp_path, monkeypatch) -> None:
    database_path = tmp_path / "migration.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path.as_posix()}")
    get_engine.cache_clear()

    command.upgrade(alembic_config(), "head")

    engine = create_engine(f"sqlite:///{database_path.as_posix()}")
    assert EXPECTED_TABLES == set(inspect(engine).get_table_names())

    command.downgrade(alembic_config(), "base")
    assert inspect(engine).get_table_names() == ["alembic_version"]
    engine.dispose()
    get_engine.cache_clear()


def test_initial_migration_adopts_existing_users_table(tmp_path, monkeypatch) -> None:
    database_path = tmp_path / "legacy-users.db"
    database_url = f"sqlite:///{database_path.as_posix()}"
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE users ("
                "id INTEGER PRIMARY KEY, "
                "username VARCHAR(254) NOT NULL, "
                "password_hash VARCHAR(255) NOT NULL, "
                "role VARCHAR(16) NOT NULL)"
            )
        )
        connection.execute(text("CREATE UNIQUE INDEX ix_users_username ON users (username)"))
        connection.execute(
            text(
                "INSERT INTO users (id, username, password_hash, role) "
                "VALUES (1, 'existing@example.com', 'hash', 'staff')"
            )
        )
    engine.dispose()

    monkeypatch.setenv("DATABASE_URL", database_url)
    get_engine.cache_clear()
    command.upgrade(alembic_config(), "head")

    migrated_engine = create_engine(database_url)
    with migrated_engine.connect() as connection:
        username = connection.execute(text("SELECT username FROM users WHERE id = 1")).scalar_one()
    assert username == "existing@example.com"
    assert EXPECTED_TABLES == set(inspect(migrated_engine).get_table_names())
    migrated_engine.dispose()
    get_engine.cache_clear()


def test_user_profile_migration_keeps_existing_users(tmp_path, monkeypatch) -> None:
    database_path = tmp_path / "profile.db"
    database_url = f"sqlite:///{database_path.as_posix()}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_engine.cache_clear()
    command.upgrade(alembic_config(), "20261116_0001")

    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO users (id, username, password_hash, role) "
                "VALUES (1, 'existing@example.com', 'hash', 'staff')"
            )
        )

    command.upgrade(alembic_config(), "head")
    with engine.connect() as connection:
        row = connection.execute(
            text("SELECT username, full_name, must_change_password FROM users WHERE id = 1")
        ).one()
    # Existing people keep their account, have no name yet and are not forced to change password.
    assert tuple(row) == ("existing@example.com", None, 0)

    command.downgrade(alembic_config(), "20261116_0001")
    columns = {column["name"] for column in inspect(engine).get_columns("users")}
    assert columns == {"id", "username", "password_hash", "role"}
    with engine.connect() as connection:
        assert connection.execute(text("SELECT COUNT(*) FROM users")).scalar_one() == 1
    engine.dispose()
    get_engine.cache_clear()
