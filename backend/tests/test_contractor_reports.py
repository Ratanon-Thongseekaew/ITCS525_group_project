from fastapi.testclient import TestClient

from app.main import app

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
