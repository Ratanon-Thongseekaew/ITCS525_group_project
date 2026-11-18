import pytest


@pytest.fixture(autouse=True)
def jwt_secret(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-only-secret-that-is-long-enough-0123456789")
