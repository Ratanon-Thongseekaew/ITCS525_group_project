from sqlmodel import Session, SQLModel, create_engine, select

from app.models import (
    ContractorReportEntry,
    DispositionCategory,
    EprAdjustment,
    EprQuarterSiteSnapshot,
    Handoff,
    HandoffStatus,
    Site,
)
from seed import seed_dashboard_data


def test_dashboard_seed_is_complete_and_idempotent() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        seed_dashboard_data(session)
        initial_counts = {
            "sites": len(session.exec(select(Site)).all()),
            "entries": len(session.exec(select(ContractorReportEntry)).all()),
            "snapshots": len(session.exec(select(EprQuarterSiteSnapshot)).all()),
            "adjustments": len(session.exec(select(EprAdjustment)).all()),
        }

        seed_dashboard_data(session)
        repeated_counts = {
            "sites": len(session.exec(select(Site)).all()),
            "entries": len(session.exec(select(ContractorReportEntry)).all()),
            "snapshots": len(session.exec(select(EprQuarterSiteSnapshot)).all()),
            "adjustments": len(session.exec(select(EprAdjustment)).all()),
        }

        dispositions = {
            entry.disposition for entry in session.exec(select(ContractorReportEntry)).all()
        }
        disputed_handoffs = session.exec(
            select(Handoff).where(Handoff.status == HandoffStatus.DISPUTED)
        ).all()

    assert initial_counts == repeated_counts
    assert initial_counts == {
        "sites": 2,
        "entries": 114,
        "snapshots": 4,
        "adjustments": 1,
    }
    assert dispositions == set(DispositionCategory)
    assert len(disputed_handoffs) == 1
