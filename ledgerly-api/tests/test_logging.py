"""Logging: request ids, per-request lines, and no secrets in the logs."""
import logging

import pytest

from app.logging_setup import redact
from conftest import PASSWORD, link_token


@pytest.fixture
def logs(caplog):
    """Listen to Ledgerly's logger (it doesn't pass messages up to Python's default logger)."""
    logger = logging.getLogger("ledgerly")
    logger.addHandler(caplog.handler)
    caplog.set_level(logging.INFO)
    yield caplog
    logger.removeHandler(caplog.handler)


def test_every_response_has_a_request_id(client):
    r = client.get("/api/health")
    assert len(r.headers["X-Request-ID"]) == 12
    mine = client.get("/api/health", headers={"X-Request-ID": "support-ticket-42"})
    assert mine.headers["X-Request-ID"] == "support-ticket-42"


def test_errors_include_the_request_id(client):
    r = client.get("/api/expenses")
    assert r.status_code == 401 and r.get_json()["error"]["request_id"] == r.headers["X-Request-ID"]
    bad = client.post("/api/auth/register", json={})
    assert bad.get_json()["error"]["request_id"] == bad.headers["X-Request-ID"]


def test_security_headers(client):
    h = client.get("/api/health").headers
    assert h["Referrer-Policy"] == "no-referrer" and h["Cache-Control"] == "no-store"
    assert h["X-Content-Type-Options"] == "nosniff" and h["X-Frame-Options"] == "DENY"


def test_redaction():
    assert redact("POST /x?token=abc123SECRETtoken1") == "POST /x?token=[redacted]"
    assert redact('{"password": "Ledgerly2026"}') == '{"password": "[redacted]"}'
    assert redact("Authorization: Bearer eyJhbGciOi.payload.sig") == "Authorization: Bearer [redacted]"
    assert redact("leaked eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc-def_g here") == "leaked [jwt redacted] here"
    assert redact("#code=AbCdEf123456789xyz") == "#code=[redacted]"


def test_no_tokens_or_passwords_in_logs(client, outbox, logs):
    client.post("/api/auth/register", json={"full_name": "Amani Otieno", "email": "amani@example.com", "password": PASSWORD})
    token = link_token(outbox[-1])
    r = client.post("/api/auth/verify-email", json={"token": token})
    access = r.get_json()["access_token"]
    client.get("/api/auth/me", headers={"Authorization": f"Bearer {access}"})
    client.post("/api/auth/login", json={"email": "amani@example.com", "password": "WrongPass123"})
    logged = "\n".join(rec.getMessage() for rec in logs.records)
    assert "Login failed for a***@example.com: wrong password" in logged
    assert "Email confirmed for account" in logged
    for secret in (token, access, PASSWORD, "WrongPass123", "amani@example.com"):
        assert secret not in logged


def test_request_lines_name_the_user(client, auth, logs):
    client.get("/api/balance", headers=auth)
    line = [rec for rec in logs.records if "GET /api/balance -> 200" in rec.getMessage()][0]
    assert line.user_id != "-" and line.request_id != "-"
