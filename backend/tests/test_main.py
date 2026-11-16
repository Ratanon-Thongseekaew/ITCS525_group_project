from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_greeting() -> None:
    response = client.get("/api/greeting")
    assert response.status_code == 200
    assert response.json() == {"message": "Hello from FastAPI!"}


def test_get_bins() -> None:
    response = client.get("/api/bins")
    assert response.status_code == 200
    bins = response.json()
    assert isinstance(bins, list)
    assert len(bins) >= 2


def test_get_active_bins() -> None:
    response = client.get("/api/bins/active")
    assert response.status_code == 200
    data = response.json()
    assert "resale_bin" in data
    assert "recycle_bin" in data
    if data["resale_bin"]:
        assert data["resale_bin"]["bin_type"] == "resale"
        assert data["resale_bin"]["status"] == "active"
    if data["recycle_bin"]:
        assert data["recycle_bin"]["bin_type"] == "recycle"
        assert data["recycle_bin"]["status"] == "active"


def test_create_and_close_bin() -> None:
    create_resp = client.post(
        "/api/bins",
        json={
            "bin_type": "resale",
            "bin_code": "BIN-RS-TEST",
            "max_capacity": 40,
            "notes": "Test bin",
        },
    )
    assert create_resp.status_code == 201
    new_bin = create_resp.json()
    bin_id = new_bin["id"]
    assert new_bin["bin_code"] == "BIN-RS-TEST"
    assert new_bin["status"] == "active"
    assert new_bin["item_count"] == 0

    close_resp = client.post(
        f"/api/bins/{bin_id}/close",
        json={"notes": "Closed for test verification"},
    )
    assert close_resp.status_code == 200
    closed_bin = close_resp.json()
    assert closed_bin["status"] == "closed"
    assert closed_bin["closed_at"] is not None


def test_close_nonexistent_bin() -> None:
    response = client.post("/api/bins/nonexistent-id/close", json={})
    assert response.status_code == 404


def test_sort_garment_resale() -> None:
    initial_stats = client.get("/api/sorting/stats").json()
    initial_resale = initial_stats["resale_count"]

    response = client.post(
        "/api/garments/sort",
        json={
            "condition": "good_reusable",
            "category": "Dresses",
            "weight_kg": 0.45,
            "notes": "Silk summer dress in pristine condition",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["garment"]["condition"] == "good_reusable"
    assert data["garment"]["category"] == "Dresses"
    assert data["bin"]["bin_type"] == "resale"

    updated_stats = client.get("/api/sorting/stats").json()
    assert updated_stats["resale_count"] == initial_resale + 1


def test_sort_garment_recycle() -> None:
    initial_stats = client.get("/api/sorting/stats").json()
    initial_recycle = initial_stats["recycle_count"]

    response = client.post(
        "/api/garments/sort",
        json={
            "condition": "worn_recyclable",
            "category": "Bottoms",
            "weight_kg": 0.70,
            "notes": "Torn denim jeans",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["garment"]["condition"] == "worn_recyclable"
    assert data["bin"]["bin_type"] == "recycle"

    updated_stats = client.get("/api/sorting/stats").json()
    assert updated_stats["recycle_count"] == initial_recycle + 1


def test_get_recent_garments() -> None:
    response = client.get("/api/garments/recent?limit=5")
    assert response.status_code == 200
    items = response.json()
    assert isinstance(items, list)
    assert len(items) <= 5
