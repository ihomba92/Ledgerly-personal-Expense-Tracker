"""Sign-up, email confirmation, login, password reset and account settings."""
from conftest import PASSWORD, link_token

from app.extensions import limiter


def register(client, email="amani@example.com", password=PASSWORD):
    return client.post("/api/auth/register", json={"full_name": "Amani Otieno", "email": email, "password": password})


def test_register_sends_confirmation_and_gives_no_token(client, outbox):
    r = register(client)
    assert r.status_code == 201
    assert "access_token" not in r.get_json()
    assert r.get_json()["user"]["email_verified"] is False
    assert outbox[-1]["subject"] == "Confirm your email for Ledgerly"
    assert "/verify-email#token=" in outbox[-1]["text"]  # after "#": never sent to servers


def test_password_is_stored_as_bcrypt_hash(app, client, outbox):
    register(client)
    from app.extensions import db
    from app.models import User
    with app.app_context():
        user = db.session.query(User).one()
        assert user.password_hash.startswith("$2b$") and PASSWORD not in user.password_hash


def test_weak_password_and_bad_email_are_rejected(client, outbox):
    r = client.post("/api/auth/register", json={"full_name": "A", "email": "nope", "password": "password"})
    assert r.status_code == 422
    assert set(r.get_json()["error"]["fields"]) == {"full_name", "email", "password"}


def test_duplicate_email_ignores_capitals(client, outbox):
    register(client)
    r = register(client, email="AMANI@Example.com")
    assert r.status_code == 409


def test_login_blocked_until_email_confirmed(client, outbox):
    register(client)
    r = client.post("/api/auth/login", json={"email": "amani@example.com", "password": PASSWORD})
    assert r.status_code == 403 and r.get_json()["error"]["reason"] == "email_not_verified"
    wrong = client.post("/api/auth/login", json={"email": "amani@example.com", "password": "Wrong12345"})
    assert wrong.status_code == 401  # wrong password never reveals the verification state


def test_confirmation_link_logs_in_once(client, outbox):
    register(client)
    token = link_token(outbox[-1])
    r = client.post("/api/auth/verify-email", json={"token": token})
    assert r.status_code == 200 and r.get_json()["user"]["email_verified"] is True
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {r.get_json()['access_token']}"})
    assert me.status_code == 200
    again = client.post("/api/auth/verify-email", json={"token": token})
    assert again.status_code == 400 and again.get_json()["error"]["reason"] == "invalid_link"


def test_resend_replaces_old_link(client, outbox):
    register(client)
    first = link_token(outbox[-1])
    client.post("/api/auth/resend-verification", json={"email": "amani@example.com"})
    assert client.post("/api/auth/verify-email", json={"token": first}).status_code == 400
    assert client.post("/api/auth/verify-email", json={"token": link_token(outbox[-1])}).status_code == 200


def test_login_rate_limit_is_five_per_minute(client, auth):
    for _ in range(5):
        assert client.post("/api/auth/login", json={"email": "janice@example.com", "password": "Wrong12345"}).status_code == 401
    r = client.post("/api/auth/login", json={"email": "janice@example.com", "password": PASSWORD})
    assert r.status_code == 429


def test_forgot_and_reset_password(client, auth, outbox):
    r = client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    same = client.post("/api/auth/forgot-password", json={"email": "janice@example.com"})
    assert r.get_json() == same.get_json()  # reveals nothing about which emails exist
    token = link_token(outbox[-1])
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "NewPass2026"}).status_code == 200
    assert client.get("/api/auth/me", headers=auth).status_code == 401  # old login ended
    limiter.reset()
    assert client.post("/api/auth/login", json={"email": "janice@example.com", "password": "NewPass2026"}).status_code == 200
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "Other2026x"}).status_code == 400


def test_requests_without_or_with_bad_token(client):
    assert client.get("/api/expenses").status_code == 401
    assert client.get("/api/expenses", headers={"Authorization": "Bearer nonsense"}).status_code == 401


def test_update_profile(client, auth):
    r = client.patch("/api/auth/me", headers=auth, json={"ledger_name": "Family budget", "timezone": "Africa/Kampala",
                                                        "weekly_digest": True})
    assert r.status_code == 200 and r.get_json()["user"]["ledger_name"] == "Family budget"
    bad = client.patch("/api/auth/me", headers=auth, json={"timezone": "Mars/Base", "currency": "XYZ"})
    assert bad.status_code == 422 and set(bad.get_json()["error"]["fields"]) == {"timezone", "currency"}


def test_change_password_keeps_this_device_logged_in(client, auth):
    wrong = client.post("/api/auth/change-password", headers=auth, json={"current_password": "Nope1234", "new_password": "Fresh2026"})
    assert wrong.status_code == 403
    r = client.post("/api/auth/change-password", headers=auth, json={"current_password": PASSWORD, "new_password": "Fresh2026"})
    assert r.status_code == 200
    assert client.get("/api/auth/me", headers=auth).status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {r.get_json()['access_token']}"}).status_code == 200


def test_delete_account_needs_password_and_removes_everything(client, auth, category_id):
    from conftest import expense, top_up
    top_up(client, auth)
    expense(client, auth, category_id)
    assert client.delete("/api/auth/me", headers=auth, json={"password": "Wrong1234"}).status_code == 403
    assert client.delete("/api/auth/me", headers=auth, json={"password": PASSWORD}).status_code == 200
    assert client.get("/api/auth/me", headers=auth).status_code == 401
