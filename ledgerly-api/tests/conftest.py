"""Shared test setup.

Tests run against the separate ledgerly_test database (TEST_DATABASE_URL in .env),
never your real data. Every test starts with empty tables.
"""
import re
import shutil

import pytest
from dotenv import load_dotenv

load_dotenv(".env")

from flask_migrate import upgrade  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app import create_app  # noqa: E402
from app.extensions import db, limiter  # noqa: E402

PASSWORD = "Ledgerly2026"


@pytest.fixture(scope="session")
def app():
    app = create_app("testing")
    if not app.config["SQLALCHEMY_DATABASE_URI"]:
        pytest.exit("Set TEST_DATABASE_URL in .env to run the tests.")
    with app.app_context():
        upgrade()  # build the tables exactly as the migrations do
    yield app
    shutil.rmtree(app.config["UPLOAD_FOLDER"], ignore_errors=True)


@pytest.fixture(autouse=True)
def clean(app):
    with app.app_context():
        db.session.execute(text("TRUNCATE users, support_requests RESTART IDENTITY CASCADE"))
        db.session.commit()
    limiter.reset()
    yield


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def outbox(monkeypatch):
    """Capture emails instead of sending them."""
    sent = []

    def fake_send(to, subject, html, text):
        sent.append({"to": to, "subject": subject, "text": text})
        return True

    monkeypatch.setattr("app.api.auth.send_email", fake_send)
    monkeypatch.setattr("app.api.support.send_email", fake_send)
    return sent


def link_token(mail: dict) -> str:
    return re.search(r"token=([\w-]+)", mail["text"]).group(1)


@pytest.fixture
def make_user(client, outbox):
    """Register and confirm a user; returns their auth headers."""
    def _make(email="janice@example.com", name="Janice Chandler"):
        r = client.post("/api/auth/register", json={"full_name": name, "email": email, "password": PASSWORD})
        assert r.status_code == 201, r.get_json()
        r = client.post("/api/auth/verify-email", json={"token": link_token(outbox[-1])})
        assert r.status_code == 200, r.get_json()
        limiter.reset()
        return {"Authorization": f"Bearer {r.get_json()['access_token']}"}
    return _make


@pytest.fixture
def auth(make_user):
    return make_user()


@pytest.fixture
def category_id(client, auth):
    """Id of the user's "Food & groceries" category."""
    cats = client.get("/api/categories", headers=auth).get_json()["categories"]
    return next(c["id"] for c in cats if c["label"] == "Food & groceries")


def top_up(client, headers, amount="10000", source="salary", received_on="2026-10-01"):
    r = client.post("/api/top-ups", headers=headers, json={"amount": amount, "source": source, "received_on": received_on})
    assert r.status_code == 201, r.get_json()
    return r.get_json()


def expense(client, headers, category_id, amount="500", status="paid", spent_on=None, **extra):
    from datetime import date
    body = {"subject": "Weekly groceries", "merchant": "Naivas", "amount": amount, "category_id": category_id,
            "status": status, "spent_on": spent_on or date.today().isoformat(), **extra}
    return client.post("/api/expenses", headers=headers, json=body)
