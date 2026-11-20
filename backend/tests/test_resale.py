import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.database import get_session
from app.main import app
from seed import seed_dashboard_data


@pytest.fixture
def resale_client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed_dashboard_data(session)

    def override_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_resale_summary_returns_top_sites_from_persisted_bins(
    resale_client: TestClient,
) -> None:
    response = resale_client.get("/api/resale-bins/summary")

    assert response.status_code == 200
    stores = response.json()["stores"]
    assert [store["name"] for store in stores] == [
        "Chiang Mai Sorting Center",
        "Bangkok Sorting Center",
    ]
    assert [store["actual_value"] for store in stores] == [95530.0, 85690.0]
