"""Sign in with Google and Microsoft, against a stand-in provider.

The real Google/Microsoft servers are replaced by two small fakes: one answers the token request,
the other supplies the public key. Our code still builds the redirect, checks state and nonce,
verifies the ID token's signature, audience, issuer and expiry, and hands over the login with a
one-time code exactly as it does in production.
"""
import time
from urllib.parse import parse_qs, urlparse

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.extensions import limiter
from app.services import oauth
from conftest import PASSWORD, link_token

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def providers(app, monkeypatch):
    app.config.update(GOOGLE_CLIENT_ID="google-client", GOOGLE_CLIENT_SECRET="g-secret",
                      MICROSOFT_CLIENT_ID="ms-client", MICROSOFT_CLIENT_SECRET="m-secret", MICROSOFT_TENANT="common")
    monkeypatch.setattr(oauth, "signing_key", lambda provider, token: KEY.public_key())
    yield
    app.config.update(GOOGLE_CLIENT_ID="", GOOGLE_CLIENT_SECRET="", MICROSOFT_CLIENT_ID="", MICROSOFT_CLIENT_SECRET="")


def id_token(provider, nonce, key=KEY, **claims):
    now = int(time.time())
    base = {"sub": "provider-user-1", "iat": now, "exp": now + 300, "nonce": nonce,
            "email": "amani@gmail.com", "name": "Amani Otieno"}
    if provider == "google":
        base |= {"iss": "https://accounts.google.com", "aud": "google-client", "email_verified": True}
    else:
        tid = oauth.MS_CONSUMER_TENANT
        base |= {"iss": f"https://login.microsoftonline.com/{tid}/v2.0", "aud": "ms-client", "tid": tid}
    return jwt.encode(base | claims, key, algorithm="RS256")


def sign_in(client, monkeypatch, provider="google", remember=False, **claims):
    """Run the whole browser journey and return where the API finally sends the browser."""
    start = client.get(f"/api/auth/oauth/{provider}/start" + ("?remember=1" if remember else ""))
    assert start.status_code == 302
    params = parse_qs(urlparse(start.location).query)
    sent = {}

    def fake_token_request(p, data):
        sent.update(data)
        return {"id_token": id_token(provider, params["nonce"][0], **claims)}

    monkeypatch.setattr(oauth, "post_token_request", fake_token_request)
    back = client.get(f"/api/auth/oauth/{provider}/callback?code=auth-code&state={params['state'][0]}")
    assert back.status_code == 302
    return back.location, params, sent


def code_from(location):
    assert location.startswith("http://localhost:5173/auth/callback#code="), location
    return location.split("#code=")[1]


def test_only_configured_providers_are_offered(app, client):
    assert [p["id"] for p in client.get("/api/auth/oauth/providers").get_json()["providers"]] == ["google", "microsoft"]
    app.config["MICROSOFT_CLIENT_ID"] = ""
    assert [p["id"] for p in client.get("/api/auth/oauth/providers").get_json()["providers"]] == ["google"]
    assert client.get("/api/auth/oauth/microsoft/start").status_code == 404


def test_start_uses_pkce_state_and_nonce(client):
    params = parse_qs(urlparse(client.get("/api/auth/oauth/google/start").location).query)
    assert params["code_challenge_method"] == ["S256"] and len(params["code_challenge"][0]) == 43
    assert len(params["state"][0]) >= 40 and len(params["nonce"][0]) >= 40
    assert params["redirect_uri"] == ["http://localhost:8000/api/auth/oauth/google/callback"]
    assert params["scope"] == ["openid email profile"]


def test_google_sign_up_creates_account_and_logs_in(client, monkeypatch):
    location, _, sent = sign_in(client, monkeypatch, remember=True)
    assert "code_verifier" in sent and sent["client_secret"] == "g-secret"  # PKCE verifier sent server-to-server
    r = client.post("/api/auth/oauth/exchange", json={"code": code_from(location)})
    body = r.get_json()
    assert r.status_code == 200 and body["is_new_user"] is True
    assert body["user"]["email"] == "amani@gmail.com" and body["user"]["email_verified"] is True
    assert body["user"]["has_password"] is False and body["user"]["providers"] == ["google"]
    payload = jwt.decode(body["access_token"], options={"verify_signature": False})
    assert payload["exp"] - payload["iat"] == 30 * 24 * 3600  # "keep me signed in" carried through
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    cats = client.get("/api/categories", headers={"Authorization": f"Bearer {body['access_token']}"}).get_json()
    assert len(cats["categories"]) == 10  # same default categories as an email sign-up


def test_login_code_works_once(client, monkeypatch):
    code = code_from(sign_in(client, monkeypatch)[0])
    assert client.post("/api/auth/oauth/exchange", json={"code": code}).status_code == 200
    again = client.post("/api/auth/oauth/exchange", json={"code": code})
    assert again.status_code == 400 and again.get_json()["error"]["reason"] == "invalid_code"


def test_same_google_account_signs_into_same_user(client, monkeypatch):
    first = client.post("/api/auth/oauth/exchange", json={"code": code_from(sign_in(client, monkeypatch)[0])}).get_json()
    second = client.post("/api/auth/oauth/exchange", json={"code": code_from(sign_in(client, monkeypatch)[0])}).get_json()
    assert first["user"]["id"] == second["user"]["id"] and second["is_new_user"] is False


def test_links_to_existing_email_account(client, monkeypatch, make_user):
    make_user(email="amani@gmail.com", name="Amani Otieno")
    location = sign_in(client, monkeypatch)[0]
    body = client.post("/api/auth/oauth/exchange", json={"code": code_from(location)}).get_json()
    assert body["is_new_user"] is False and body["user"]["has_password"] is True
    assert body["user"]["providers"] == ["google"]


def test_microsoft_personal_account(client, monkeypatch):
    location = sign_in(client, monkeypatch, provider="microsoft", email="amani@outlook.com")[0]
    body = client.post("/api/auth/oauth/exchange", json={"code": code_from(location)}).get_json()
    assert body["user"]["providers"] == ["microsoft"]


def test_microsoft_work_account_with_unverified_email_is_refused(client, monkeypatch):
    tid = "11111111-2222-3333-4444-555555555555"
    location = sign_in(client, monkeypatch, provider="microsoft", tid=tid, iss=f"https://login.microsoftonline.com/{tid}/v2.0",
                       email="ceo@victim-company.com")[0]
    assert location == "http://localhost:5173/login#oauth_error=email_unverified"


def test_unverified_google_email_is_refused(client, monkeypatch):
    assert sign_in(client, monkeypatch, email_verified=False)[0].endswith("#oauth_error=email_unverified")


@pytest.mark.parametrize("claims", [
    {"aud": "someone-elses-app"},
    {"iss": "https://evil.example.com"},
    {"exp": int(time.time()) - 3600},
    {"nonce": "a-different-nonce"},
])
def test_bad_id_tokens_are_rejected(client, monkeypatch, claims):
    assert sign_in(client, monkeypatch, **claims)[0].endswith("#oauth_error=failed")


def test_token_signed_with_wrong_key_is_rejected(client, monkeypatch):
    start = client.get("/api/auth/oauth/google/start")
    params = parse_qs(urlparse(start.location).query)
    monkeypatch.setattr(oauth, "post_token_request",
                        lambda p, d: {"id_token": id_token("google", params["nonce"][0], key=OTHER_KEY)})
    back = client.get(f"/api/auth/oauth/google/callback?code=x&state={params['state'][0]}")
    assert back.location.endswith("#oauth_error=failed")


def test_state_must_match(client, monkeypatch):
    client.get("/api/auth/oauth/google/start")
    back = client.get("/api/auth/oauth/google/callback?code=x&state=forged-state")
    assert back.location.endswith("#oauth_error=expired")
    fresh = client.application.test_client()  # no cookie at all: a link someone else started
    assert fresh.get("/api/auth/oauth/google/callback?code=x&state=anything").location.endswith("#oauth_error=expired")


def test_cancel_on_provider_page(client):
    client.get("/api/auth/oauth/google/start")
    assert client.get("/api/auth/oauth/google/callback?error=access_denied").location.endswith("#oauth_error=cancelled")


def test_google_only_account_can_set_a_password_then_log_in(client, monkeypatch):
    body = client.post("/api/auth/oauth/exchange", json={"code": code_from(sign_in(client, monkeypatch)[0])}).get_json()
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    limiter.reset()
    assert client.post("/api/auth/login", json={"email": "amani@gmail.com", "password": "Anything123"}).status_code == 401
    r = client.post("/api/auth/change-password", headers=headers, json={"new_password": "Fresh2026x"})
    assert r.status_code == 200 and r.get_json()["user"]["has_password"] is True
    assert client.post("/api/auth/login", json={"email": "amani@gmail.com", "password": "Fresh2026x"}).status_code == 200


def test_google_only_account_deletes_with_email_confirmation(client, monkeypatch):
    body = client.post("/api/auth/oauth/exchange", json={"code": code_from(sign_in(client, monkeypatch)[0])}).get_json()
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    assert client.delete("/api/auth/me", headers=headers, json={"confirm_email": "wrong@gmail.com"}).status_code == 403
    assert client.delete("/api/auth/me", headers=headers, json={"confirm_email": "Amani@Gmail.com"}).status_code == 200
