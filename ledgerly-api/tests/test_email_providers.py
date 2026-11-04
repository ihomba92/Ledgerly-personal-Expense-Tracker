"""Choosing between Resend and Brevo, without sending real email."""
import logging

import pytest

from app.config import ProductionConfig
from app.services import email as email_service


class FakeResponse:
    def __init__(self, status, body):
        self.status_code, self._body, self.content = status, body, b"x"
        self.text = str(body)

    def json(self):
        return self._body


@pytest.fixture
def brevo(app, monkeypatch):
    sent = []

    def fake_post(url, headers, json, timeout):
        sent.append({"url": url, "headers": headers, "json": json})
        return FakeResponse(201, {"messageId": "<abc@smtp-relay.brevo.com>"})

    monkeypatch.setattr(email_service.requests, "post", fake_post)
    app.config.update(EMAIL_PROVIDER="brevo", BREVO_API_KEY="xkeysib-test", EMAIL_FROM="Ledgerly <no-reply@ledgerly.dpdns.org>")
    yield sent
    app.config.update(EMAIL_PROVIDER="resend", BREVO_API_KEY="", EMAIL_FROM="Ledgerly <onboarding@resend.dev>")


def test_brevo_sends_the_right_request(app, brevo):
    with app.app_context():
        assert email_service.send_email("amani@example.com", "Confirm your email", "<p>Hi</p>", "Hi") is True
    request = brevo[0]
    assert request["url"] == "https://api.brevo.com/v3/smtp/email"
    assert request["headers"]["api-key"] == "xkeysib-test"
    assert request["json"]["sender"] == {"name": "Ledgerly", "email": "no-reply@ledgerly.dpdns.org"}
    assert request["json"]["to"] == [{"email": "amani@example.com"}]
    assert request["json"]["htmlContent"] == "<p>Hi</p>" and request["json"]["textContent"] == "Hi"


def test_brevo_refusal_is_logged_not_raised(app, brevo, monkeypatch, caplog):
    monkeypatch.setattr(email_service.requests, "post",
                        lambda *a, **k: FakeResponse(400, {"code": "invalid_parameter", "message": "sender is not valid"}))
    logger = logging.getLogger("ledgerly")
    logger.addHandler(caplog.handler)
    try:
        with app.app_context():
            assert email_service.send_email("amani@example.com", "Confirm your email", "<p>Hi</p>", "Hi") is False
    finally:
        logger.removeHandler(caplog.handler)
    assert any("Brevo refused" in r.getMessage() and "sender is not valid" in r.getMessage() for r in caplog.records)


def test_signup_email_goes_through_brevo(client, brevo):
    r = client.post("/api/auth/register", json={"full_name": "Amani Otieno", "email": "amani@example.com", "password": "Ledgerly2026"})
    assert r.status_code == 201
    assert brevo and brevo[0]["json"]["subject"] == "Confirm your email for Ledgerly"
    assert "/verify-email#token=" in brevo[0]["json"]["textContent"]


def test_production_needs_the_chosen_providers_key(monkeypatch):
    monkeypatch.setattr(ProductionConfig, "SECRET_KEY", "x" * 64)
    monkeypatch.setattr(ProductionConfig, "JWT_SECRET_KEY", "y" * 64)
    monkeypatch.setattr(ProductionConfig, "RATELIMIT_STORAGE_URI", "redis://localhost:6379/0")
    monkeypatch.setattr(ProductionConfig, "SQLALCHEMY_DATABASE_URI", "postgresql+psycopg://u:p@h/db")
    monkeypatch.setattr(ProductionConfig, "EMAIL_PROVIDER", "brevo")
    monkeypatch.setattr(ProductionConfig, "BREVO_API_KEY", "")
    with pytest.raises(RuntimeError, match="BREVO_API_KEY"):
        ProductionConfig.validate()
    monkeypatch.setattr(ProductionConfig, "BREVO_API_KEY", "xkeysib-real")
    ProductionConfig.validate()  # no error: Resend's key isn't needed when Brevo is chosen
