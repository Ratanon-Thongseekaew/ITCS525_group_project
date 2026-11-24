"""Full name, store assignment, temporary passwords and first-login password change."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from app import database
from app.main import app
from app.models import Site, User, UserSite
from app.schemas import UserRole
from app.security import TEMPORARY_PASSWORD_ALPHABET, hash_password

PASSWORD = "demo-password"
NEW_PASSWORD = "brand-new-password"


@pytest.fixture
def env(monkeypatch):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    event.listen(engine, "connect", lambda conn, _: conn.execute("PRAGMA foreign_keys=ON"))
    monkeypatch.setattr(database, "get_engine", lambda: engine)
    SQLModel.metadata.create_all(engine)
    with TestClient(app) as http:
        yield http, engine
    engine.dispose()


def add_user(engine, username, role, *, must_change=False) -> int:
    with Session(engine) as session:
        user = User(
            username=username,
            password_hash=hash_password(PASSWORD),
            role=role,
            must_change_password=must_change,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id


def add_site(engine, code, name, *, active=True) -> int:
    with Session(engine) as session:
        site = Site(code=code, name=name, is_active=active)
        session.add(site)
        session.commit()
        session.refresh(site)
        return site.id


def add_membership(engine, user_id, site_id, *, default=False) -> None:
    with Session(engine) as session:
        session.add(UserSite(user_id=user_id, site_id=site_id, is_default=default))
        session.commit()


def site_ids_of(engine, user_id) -> list[int]:
    with Session(engine) as session:
        return sorted(
            session.exec(select(UserSite.site_id).where(UserSite.user_id == user_id)).all()
        )


def login(http, username, password=PASSWORD):
    return http.post("/api/auth/login", json={"username": username, "password": password})


def headers_for(http, username, password=PASSWORD) -> dict[str, str]:
    return {"Authorization": f"Bearer {login(http, username, password).json()['access_token']}"}


@pytest.fixture
def admin(env):
    http, engine = env
    add_user(engine, "boss@example.com", UserRole.ADMIN)
    return headers_for(http, "boss@example.com")


def new_user(http, admin, **fields):
    payload = {"username": "person@example.com", "role": "manager"} | fields
    return http.post("/api/users", headers=admin, json=payload)


# ----- temporary passwords -------------------------------------------------------------


def test_create_without_password_returns_a_one_time_temporary_password(env, admin):
    http, engine = env
    site_id = add_site(engine, "BKK", "Bangkok")
    response = new_user(http, admin, role="staff", site_id=site_id, full_name="  Narin S.  ")
    assert response.status_code == 201
    body = response.json()
    temporary = body["temporary_password"]
    assert len(temporary) == 14
    assert set(temporary) <= set(TEMPORARY_PASSWORD_ALPHABET)
    assert body["must_change_password"] is True
    assert body["full_name"] == "Narin S."
    assert body["store"] == {"id": site_id, "code": "BKK", "name": "Bangkok"}
    assert response.headers["cache-control"] == "no-store"
    assert "scrypt" not in response.text and "password_hash" not in response.text

    # It works once for login, is never returned again, and is stored only as a hash.
    assert login(http, "person@example.com", temporary).status_code == 200
    listed = http.get("/api/users", headers=admin)
    assert temporary not in listed.text
    assert "temporary_password" not in listed.text
    with Session(engine) as session:
        stored = session.exec(select(User).where(User.username == "person@example.com")).one()
        assert temporary not in stored.password_hash


def test_each_temporary_password_is_different(env, admin):
    http, _ = env
    first = new_user(http, admin, username="a@example.com").json()["temporary_password"]
    second = new_user(http, admin, username="b@example.com").json()["temporary_password"]
    assert first != second


def test_explicit_password_is_not_temporary(env, admin):
    http, _ = env
    response = new_user(http, admin, password="chosen-password")
    assert response.status_code == 201
    assert response.json()["temporary_password"] is None
    assert response.json()["must_change_password"] is False
    assert (
        "cache-control" not in response.headers or response.headers["cache-control"] != "no-store"
    )
    assert login(http, "person@example.com", "chosen-password").status_code == 200


def test_reset_password_issues_a_new_temporary_password(env, admin):
    http, engine = env
    target = add_user(engine, "person@example.com", UserRole.MANAGER)
    response = http.post(f"/api/users/{target}/reset-password", headers=admin)
    assert response.status_code == 200
    body = response.json()
    assert body["must_change_password"] is True
    assert response.headers["cache-control"] == "no-store"
    assert login(http, "person@example.com", PASSWORD).status_code == 401
    assert login(http, "person@example.com", body["temporary_password"]).status_code == 200


def test_reset_password_rules(env, admin):
    http, engine = env
    admin_id = http.get("/api/auth/me", headers=admin).json()["id"]
    assert http.post(f"/api/users/{admin_id}/reset-password", headers=admin).status_code == 400
    assert http.post("/api/users/999/reset-password", headers=admin).status_code == 404
    add_user(engine, "staff@example.com", UserRole.STAFF)
    staff = headers_for(http, "staff@example.com")
    assert http.post("/api/users/1/reset-password", headers=staff).status_code == 403
    assert http.post("/api/users/1/reset-password").status_code == 401


def test_admin_setting_someone_elses_password_forces_a_change(env, admin):
    http, engine = env
    target = add_user(engine, "person@example.com", UserRole.MANAGER)
    changed = http.patch(
        f"/api/users/{target}", headers=admin, json={"password": "admin-chose-this"}
    )
    assert changed.json()["must_change_password"] is True


def test_admin_changing_own_password_is_not_forced(env, admin):
    http, _ = env
    me = http.get("/api/auth/me", headers=admin).json()["id"]
    changed = http.patch(f"/api/users/{me}", headers=admin, json={"password": "my-new-password"})
    assert changed.status_code == 200
    assert changed.json()["must_change_password"] is False


# ----- first-login password change -----------------------------------------------------


def test_temporary_password_only_unlocks_the_change_password_screen(env):
    http, engine = env
    add_user(engine, "boss@example.com", UserRole.ADMIN, must_change=True)
    headers = headers_for(http, "boss@example.com")

    me = http.get("/api/auth/me", headers=headers)
    assert me.status_code == 200 and me.json()["must_change_password"] is True
    blocked = http.get("/api/users", headers=headers)
    assert blocked.status_code == 403
    assert blocked.json() == {"detail": "Password change required"}
    assert http.get("/api/sites", headers=headers).status_code == 403

    changed = http.post(
        "/api/auth/change-password",
        headers=headers,
        json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
    )
    assert changed.status_code == 200
    assert changed.json()["must_change_password"] is False
    assert http.get("/api/users", headers=headers).status_code == 200
    assert login(http, "boss@example.com", PASSWORD).status_code == 401
    assert login(http, "boss@example.com", NEW_PASSWORD).status_code == 200


def test_change_password_errors(env):
    http, engine = env
    add_user(engine, "staff@example.com", UserRole.STAFF, must_change=True)
    headers = headers_for(http, "staff@example.com")
    url = "/api/auth/change-password"

    assert http.post(url, json={}).status_code == 401
    wrong = http.post(
        url, headers=headers, json={"current_password": "nope", "new_password": NEW_PASSWORD}
    )
    # 400, not 401: the person is still signed in, so the client must not log them out.
    assert wrong.status_code == 400
    assert wrong.json() == {"detail": "Current password is incorrect"}
    same = http.post(
        url, headers=headers, json={"current_password": PASSWORD, "new_password": PASSWORD}
    )
    assert same.status_code == 400
    short = http.post(
        url, headers=headers, json={"current_password": PASSWORD, "new_password": "short"}
    )
    assert short.status_code == 422
    # Nothing changed.
    assert login(http, "staff@example.com", PASSWORD).status_code == 200
    assert http.get("/api/auth/me", headers=headers).json()["must_change_password"] is True


def test_users_without_the_flag_are_unaffected(env, admin):
    http, _ = env
    assert http.get("/api/users", headers=admin).status_code == 200
    assert http.get("/api/sites", headers=admin).status_code == 200


# ----- full name ----------------------------------------------------------------------


def test_full_name_create_update_and_clear(env, admin):
    http, _ = env
    created = new_user(http, admin, full_name="   ")
    assert created.json()["full_name"] is None
    user_id = created.json()["id"]

    named = http.patch(f"/api/users/{user_id}", headers=admin, json={"full_name": " Somchai K. "})
    assert named.json()["full_name"] == "Somchai K."
    untouched = http.patch(f"/api/users/{user_id}", headers=admin, json={"role": "manager"})
    assert untouched.json()["full_name"] == "Somchai K."
    cleared = http.patch(f"/api/users/{user_id}", headers=admin, json={"full_name": None})
    assert cleared.json()["full_name"] is None
    too_long = http.patch(f"/api/users/{user_id}", headers=admin, json={"full_name": "x" * 121})
    assert too_long.status_code == 422


# ----- stores -------------------------------------------------------------------------


def test_store_rules_on_create(env, admin):
    http, engine = env
    site_id = add_site(engine, "BKK", "Bangkok")
    closed_id = add_site(engine, "OLD", "Closed store", active=False)

    assert new_user(http, admin, role="staff").status_code == 422
    assert new_user(http, admin, role="admin", site_id=site_id).status_code == 422
    assert new_user(http, admin, role="staff", site_id=9999).status_code == 422
    assert new_user(http, admin, role="staff", site_id=closed_id).status_code == 422
    assert new_user(http, admin, role="manager", site_id=0).status_code == 422
    assert new_user(http, admin, role="admin").status_code == 201
    manager = new_user(http, admin, username="m@example.com", role="manager")
    assert manager.status_code == 201 and manager.json()["store"] is None
    staff = new_user(http, admin, username="s@example.com", role="staff", site_id=site_id)
    assert staff.status_code == 201
    assert site_ids_of(engine, staff.json()["id"]) == [site_id]


def test_failed_create_leaves_no_user_or_membership_behind(env, admin):
    http, engine = env
    site_id = add_site(engine, "BKK", "Bangkok")
    assert new_user(http, admin, role="staff", site_id=site_id).status_code == 201
    duplicate = new_user(http, admin, username="PERSON@example.com", role="staff", site_id=site_id)
    assert duplicate.status_code == 409
    with Session(engine) as session:
        assert (
            len(session.exec(select(User).where(User.username == "person@example.com")).all()) == 1
        )
        assert len(session.exec(select(UserSite)).all()) == 1


def test_list_returns_each_users_store(env, admin):
    http, engine = env
    first = add_site(engine, "BKK", "Bangkok")
    second = add_site(engine, "CNX", "Chiang Mai")
    staff = add_user(engine, "staff@example.com", UserRole.STAFF)
    multi = add_user(engine, "multi@example.com", UserRole.MANAGER)
    add_user(engine, "none@example.com", UserRole.MANAGER)
    add_membership(engine, staff, second, default=True)
    # A manager with several sites shows the default one, whatever the id order.
    add_membership(engine, multi, first)
    add_membership(engine, multi, second, default=True)

    by_name = {u["username"]: u for u in http.get("/api/users", headers=admin).json()}
    assert by_name["staff@example.com"]["store"]["code"] == "CNX"
    assert by_name["multi@example.com"]["store"]["code"] == "CNX"
    assert by_name["none@example.com"]["store"] is None
    assert by_name["boss@example.com"]["store"] is None


def test_changing_a_staff_store_replaces_it(env, admin):
    http, engine = env
    first = add_site(engine, "BKK", "Bangkok")
    second = add_site(engine, "CNX", "Chiang Mai")
    created = new_user(http, admin, role="staff", site_id=first).json()

    moved = http.patch(f"/api/users/{created['id']}", headers=admin, json={"site_id": second})
    assert moved.status_code == 200
    assert moved.json()["store"]["id"] == second
    assert site_ids_of(engine, created["id"]) == [second]

    # Sending the same store again is a no-op, not a unique-constraint error.
    again = http.patch(f"/api/users/{created['id']}", headers=admin, json={"site_id": second})
    assert again.status_code == 200
    assert site_ids_of(engine, created["id"]) == [second]


def test_staff_cannot_lose_their_store(env, admin):
    http, engine = env
    site_id = add_site(engine, "BKK", "Bangkok")
    created = new_user(http, admin, role="staff", site_id=site_id).json()
    removed = http.patch(f"/api/users/{created['id']}", headers=admin, json={"site_id": None})
    assert removed.status_code == 422
    assert site_ids_of(engine, created["id"]) == [site_id]
    missing = http.patch(f"/api/users/{created['id']}", headers=admin, json={"site_id": 9999})
    assert missing.status_code == 422
    assert site_ids_of(engine, created["id"]) == [site_id]


def test_manager_store_is_optional_and_removable(env, admin):
    http, engine = env
    site_id = add_site(engine, "BKK", "Bangkok")
    created = new_user(http, admin, role="manager").json()
    assigned = http.patch(f"/api/users/{created['id']}", headers=admin, json={"site_id": site_id})
    assert assigned.json()["store"]["id"] == site_id
    removed = http.patch(f"/api/users/{created['id']}", headers=admin, json={"site_id": None})
    assert removed.status_code == 200 and removed.json()["store"] is None
    assert site_ids_of(engine, created["id"]) == []


def test_role_changes_respect_store_rules(env, admin):
    http, engine = env
    first = add_site(engine, "BKK", "Bangkok")
    second = add_site(engine, "CNX", "Chiang Mai")
    staff = new_user(http, admin, role="staff", site_id=first).json()["id"]
    # Another administrator so the first one can be demoted later.
    add_user(engine, "second-admin@example.com", UserRole.ADMIN)

    # Staff to manager keeps the store.
    manager = http.patch(f"/api/users/{staff}", headers=admin, json={"role": "manager"})
    assert manager.json()["store"]["id"] == first
    # Becoming an administrator drops it, and an admin cannot be given one.
    blocked = http.patch(
        f"/api/users/{staff}", headers=admin, json={"role": "admin", "site_id": first}
    )
    assert blocked.status_code == 422
    assert site_ids_of(engine, staff) == [first]
    promoted = http.patch(f"/api/users/{staff}", headers=admin, json={"role": "admin"})
    assert promoted.json()["store"] is None
    assert site_ids_of(engine, staff) == []
    assert (
        http.patch(f"/api/users/{staff}", headers=admin, json={"site_id": first}).status_code == 422
    )

    # A store-less admin cannot become staff without choosing a store.
    assert (
        http.patch(f"/api/users/{staff}", headers=admin, json={"role": "staff"}).status_code == 422
    )
    demoted = http.patch(
        f"/api/users/{staff}", headers=admin, json={"role": "staff", "site_id": second}
    )
    assert demoted.status_code == 200 and demoted.json()["store"]["id"] == second


def test_manager_with_several_sites_must_pick_one_to_become_staff(env, admin):
    http, engine = env
    first = add_site(engine, "BKK", "Bangkok")
    second = add_site(engine, "CNX", "Chiang Mai")
    manager = add_user(engine, "multi@example.com", UserRole.MANAGER)
    add_membership(engine, manager, first, default=True)
    add_membership(engine, manager, second)

    ambiguous = http.patch(f"/api/users/{manager}", headers=admin, json={"role": "staff"})
    assert ambiguous.status_code == 422
    assert site_ids_of(engine, manager) == [first, second]
    # Editing other fields never touches the memberships.
    renamed = http.patch(f"/api/users/{manager}", headers=admin, json={"full_name": "Multi"})
    assert renamed.status_code == 200
    assert site_ids_of(engine, manager) == [first, second]
    chosen = http.patch(
        f"/api/users/{manager}", headers=admin, json={"role": "staff", "site_id": second}
    )
    assert chosen.status_code == 200
    assert site_ids_of(engine, manager) == [second]


def test_existing_staff_without_a_store_can_still_be_edited(env, admin):
    # Staff created before stores existed have no membership; unrelated edits must not fail.
    http, engine = env
    legacy = add_user(engine, "legacy@example.com", UserRole.STAFF)
    edited = http.patch(f"/api/users/{legacy}", headers=admin, json={"full_name": "Legacy"})
    assert edited.status_code == 200
    same_role = http.patch(f"/api/users/{legacy}", headers=admin, json={"role": "staff"})
    assert same_role.status_code == 200


def test_failed_update_changes_nothing(env, admin):
    http, engine = env
    site_id = add_site(engine, "BKK", "Bangkok")
    other = add_user(engine, "taken@example.com", UserRole.MANAGER)
    target = new_user(http, admin, role="staff", site_id=site_id).json()["id"]
    clash = http.patch(
        f"/api/users/{target}",
        headers=admin,
        json={"username": "taken@example.com", "full_name": "Changed", "role": "manager"},
    )
    assert clash.status_code == 409
    after = http.get(f"/api/users/{target}", headers=admin).json()
    assert after["role"] == "staff" and after["full_name"] is None
    assert after["username"] == "person@example.com"
    assert other != target


def test_deleting_a_user_removes_their_store_link(env, admin):
    http, engine = env
    site_id = add_site(engine, "BKK", "Bangkok")
    created = new_user(http, admin, role="staff", site_id=site_id).json()
    assert http.delete(f"/api/users/{created['id']}", headers=admin).status_code == 204
    assert site_ids_of(engine, created["id"]) == []


# ----- sites ----------------------------------------------------------------------------


def test_sites_lists_active_stores_for_admins_only(env, admin):
    http, engine = env
    add_site(engine, "CNX", "Chiang Mai")
    add_site(engine, "BKK", "Bangkok")
    add_site(engine, "OLD", "Closed store", active=False)

    response = http.get("/api/sites", headers=admin)
    assert response.status_code == 200
    assert [site["code"] for site in response.json()] == ["BKK", "CNX"]
    assert set(response.json()[0]) == {"id", "code", "name"}

    assert http.get("/api/sites").status_code == 401
    add_user(engine, "manager@example.com", UserRole.MANAGER)
    add_user(engine, "staff@example.com", UserRole.STAFF)
    for username in ("manager@example.com", "staff@example.com"):
        assert http.get("/api/sites", headers=headers_for(http, username)).status_code == 403
