"""Every API route needs a login unless it is listed as public here.

A new route that forgets its auth dependency fails this test, rather than silently accepting
requests from anyone.
"""

import re

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.database import get_session
from app.main import app

# Routes anyone may call. Adding one here is a decision to make the route public.
PUBLIC_ROUTES = {
    ("GET", "/api/health"),
    ("GET", "/api/greeting"),
    ("POST", "/api/auth/login"),
}


def api_routes() -> list[tuple[str, str]]:
    return sorted(
        (method, route.path)
        for route in app.routes
        if isinstance(route, APIRoute)
        for method in route.methods - {"HEAD", "OPTIONS"}
    )


PROTECTED_ROUTES = [
    pytest.param(method, path, id=f"{method} {path}")
    for method, path in api_routes()
    if (method, path) not in PUBLIC_ROUTES
]


@pytest.fixture
def anonymous_client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)

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


def test_public_routes_still_exist() -> None:
    assert PUBLIC_ROUTES <= set(api_routes())


@pytest.mark.parametrize(("method", "path"), PROTECTED_ROUTES)
def test_route_rejects_requests_without_a_login(anonymous_client, method, path) -> None:
    # Any path parameter will do: the login check runs before the record is looked up.
    url = re.sub(r"\{[^}]+\}", "1", path)

    response = anonymous_client.request(method, url)

    assert response.status_code == 401, f"{method} {path} answered without a login"
    assert response.headers["WWW-Authenticate"] == "Bearer"
