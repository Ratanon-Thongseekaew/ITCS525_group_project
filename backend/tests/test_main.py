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
