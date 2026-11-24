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


def test_sort_garment_repair_upcycle_goes_to_repair_bin() -> None:
    initial_stats = client.get("/api/sorting/stats").json()

    response = client.post(
        "/api/garments/sort",
        json={"condition": "repair_upcycle", "category": "Tops", "notes": "Missing button"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["garment"]["condition"] == "repair_upcycle"
    assert data["bin"]["bin_type"] == "repair"
    assert data["bin"]["status"] == "active"
    assert "Repair/Upcycle" in data["message"]

    updated_stats = client.get("/api/sorting/stats").json()
    assert updated_stats["repair_count"] == initial_stats["repair_count"] + 1
    assert updated_stats["total_sorted_today"] == initial_stats["total_sorted_today"] + 1
    assert updated_stats["active_repair_bin_code"] == data["bin"]["bin_code"]
    assert client.get("/api/bins/active").json()["repair_bin"]["id"] == data["bin"]["id"]


def test_repair_items_reuse_active_repair_bin_and_never_enter_other_bins() -> None:
    first = client.post("/api/garments/sort", json={"condition": "repair_upcycle"}).json()
    second = client.post("/api/garments/sort", json={"condition": "repair_upcycle"}).json()

    assert second["bin"]["id"] == first["bin"]["id"]
    assert second["bin"]["item_count"] == first["bin"]["item_count"] + 1


def test_repair_item_ignores_requested_bin_of_wrong_type() -> None:
    resale_bin = client.get("/api/bins/active").json()["resale_bin"]

    response = client.post(
        "/api/garments/sort",
        json={"condition": "repair_upcycle", "bin_id": resale_bin["id"]},
    )

    assert response.json()["bin"]["bin_type"] == "repair"


def test_repair_bin_can_be_created_filtered_and_closed() -> None:
    created = client.post("/api/bins", json={"bin_type": "repair"}).json()
    assert created["bin_code"].startswith("BIN-RP-")

    repair_bins = client.get("/api/bins?bin_type=repair").json()
    assert created["id"] in {b["id"] for b in repair_bins}
    assert all(b["bin_type"] == "repair" for b in repair_bins)

    closed = client.post(f"/api/bins/{created['id']}/close", json={}).json()
    assert closed["status"] == "closed"


def test_get_recent_garments() -> None:
    response = client.get("/api/garments/recent?limit=5")
    assert response.status_code == 200
    items = response.json()
    assert isinstance(items, list)
    assert len(items) <= 5
