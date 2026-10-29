"""Sign in with Google and Microsoft (OpenID Connect, Authorization Code flow with PKCE).

How one sign-in works:
  1. /start   creates a random state, nonce and PKCE verifier, keeps them in a short-lived signed
              cookie, and sends the browser to Google/Microsoft.
  2. The person signs in there and is sent back to /callback with a one-time code.
  3. /callback checks the state, swaps the code (plus the PKCE verifier) for an ID token, and verifies
              that token's signature, audience, issuer, expiry and nonce.
  4. Only an email the provider has confirmed is trusted.
"""
import base64
import hashlib
import logging
import re
import secrets
import time
from urllib.parse import urlencode

import jwt
import requests
from flask import current_app, session
from jwt import PyJWKClient

log = logging.getLogger("ledgerly.auth")

# Microsoft's tenant for personal accounts (outlook.com, hotmail.com, live.com): emails there are verified.
MS_CONSUMER_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad"
STATE_MAX_AGE = 600  # seconds the person has to finish signing in

PROVIDERS = {
    "google": {
        "label": "Google",
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "jwks_url": "https://www.googleapis.com/oauth2/v3/certs",
        "issuers": ["https://accounts.google.com", "accounts.google.com"],
    },
    "microsoft": {
        "label": "Microsoft",
        "authorize_url": "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
        "token_url": "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
        "jwks_url": "https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys",
    },
}


class OAuthError(Exception):
    """A sign-in that can't be completed. `reason` is a fixed word the React app shows a message for."""

    def __init__(self, reason: str, detail: str = ""):
        super().__init__(detail or reason)
        self.reason = reason


def _cfg(provider: str, key: str) -> str:
    return current_app.config[f"{provider.upper()}_{key}"]


def is_configured(provider: str) -> bool:
    return provider in PROVIDERS and bool(_cfg(provider, "CLIENT_ID") and _cfg(provider, "CLIENT_SECRET"))


def configured_providers() -> list[dict]:
    return [{"id": p, "label": PROVIDERS[p]["label"]} for p in PROVIDERS if is_configured(p)]


def _url(provider: str, key: str) -> str:
    return PROVIDERS[provider][key].format(tenant=current_app.config["MICROSOFT_TENANT"])


def redirect_uri(provider: str) -> str:
    return f"{current_app.config['API_BASE_URL'].rstrip('/')}/api/auth/oauth/{provider}/callback"


def authorization_url(provider: str, remember_me: bool) -> str:
    """Step 1: remember state/nonce/PKCE in the signed cookie and build the provider's sign-in URL."""
    state, nonce, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(32), secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    session["oauth"] = {"provider": provider, "state": state, "nonce": nonce, "verifier": verifier,
                        "remember_me": remember_me, "started": int(time.time())}
    params = {
        "client_id": _cfg(provider, "CLIENT_ID"),
        "redirect_uri": redirect_uri(provider),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "nonce": nonce,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "prompt": "select_account",
    }
    return f"{_url(provider, 'authorize_url')}?{urlencode(params)}"


def take_pending(provider: str, state: str | None) -> dict:
    """Step 3a: the state in the callback must match the one we stored, for the same provider, recently."""
    pending = session.pop("oauth", None)
    if not pending or pending.get("provider") != provider or not state \
            or not secrets.compare_digest(pending.get("state", ""), state):
        raise OAuthError("expired", "state missing or does not match")
    if time.time() - pending.get("started", 0) > STATE_MAX_AGE:
        raise OAuthError("expired", "sign-in took too long")
    return pending


# These two talk to the provider over the network; tests replace them with stand-ins.

def post_token_request(provider: str, data: dict) -> dict:
    response = requests.post(_url(provider, "token_url"), data=data, timeout=10)
    body = response.json()
    if response.status_code != 200 or "id_token" not in body:
        raise OAuthError("failed", f"token endpoint said {response.status_code}: {body.get('error')}")
    return body


_jwks_clients: dict[str, PyJWKClient] = {}


def signing_key(provider: str, id_token: str):
    url = _url(provider, "jwks_url")
    client = _jwks_clients.setdefault(url, PyJWKClient(url, cache_keys=True, lifespan=3600))
    return client.get_signing_key_from_jwt(id_token).key


def exchange_code(provider: str, code: str, pending: dict) -> dict:
    """Step 3b: swap the code for tokens and return the verified ID token claims."""
    tokens = post_token_request(provider, {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri(provider),
        "client_id": _cfg(provider, "CLIENT_ID"),
        "client_secret": _cfg(provider, "CLIENT_SECRET"),
        "code_verifier": pending["verifier"],
    })
    return verify_id_token(provider, tokens["id_token"], pending["nonce"])


def verify_id_token(provider: str, id_token: str, nonce: str) -> dict:
    """Check signature, audience, expiry, issuer and nonce of the provider's ID token."""
    try:
        claims = jwt.decode(
            id_token,
            signing_key(provider, id_token),
            algorithms=["RS256"],
            audience=_cfg(provider, "CLIENT_ID"),
            issuer=PROVIDERS[provider].get("issuers"),  # Microsoft's issuer is checked below
            leeway=60,
            options={"require": ["exp", "iat", "aud", "iss", "sub"], "verify_iss": provider == "google"},
        )
    except jwt.PyJWTError as exc:
        raise OAuthError("failed", f"ID token rejected: {exc}") from exc

    if provider == "microsoft":
        tid = claims.get("tid", "")
        if claims["iss"] != f"https://login.microsoftonline.com/{tid}/v2.0":
            raise OAuthError("failed", "Microsoft issuer does not match the tenant")
        tenant = current_app.config["MICROSOFT_TENANT"]
        if tenant not in ("common", "organizations", "consumers") and tid != tenant:
            raise OAuthError("failed", "account is from a different Microsoft tenant")

    if not secrets.compare_digest(str(claims.get("nonce", "")), nonce):
        raise OAuthError("failed", "nonce does not match")
    return claims


def profile_from(provider: str, claims: dict) -> dict:
    """Name, email and whether the provider vouches for the email.

    Google sets email_verified. Microsoft only guarantees the email for personal accounts or when the
    domain owner is verified (xms_edov); otherwise anyone could type someone else's email into a work account.
    """
    email = (claims.get("email") or "").strip().lower()
    if provider == "google":
        verified = claims.get("email_verified") is True
    else:
        verified = claims.get("tid") == MS_CONSUMER_TENANT or claims.get("xms_edov") in (True, "1", 1)
    if not email or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise OAuthError("no_email", "provider returned no usable email")
    if not verified:
        raise OAuthError("email_unverified", f"{provider} did not confirm {email}")
    name = " ".join((claims.get("name") or "").split()) or email.split("@")[0]
    if len(name) < 2:
        name = email.split("@")[0][:80] or "Ledgerly user"
    return {"subject": str(claims["sub"]), "email": email, "name": name[:80]}
