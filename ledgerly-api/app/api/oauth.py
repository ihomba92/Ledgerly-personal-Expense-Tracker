"""Sign in / sign up with Google or Microsoft.

  GET  /api/auth/oauth/providers             which buttons to show (only providers with keys set)
  GET  /api/auth/oauth/<provider>/start      opened by the browser: goes to Google/Microsoft
  GET  /api/auth/oauth/<provider>/callback   Google/Microsoft send the browser back here
  POST /api/auth/oauth/exchange              the React app swaps the one-time code for a login token

The callback never puts a login token in a URL. It sends the browser to
  <frontend>/auth/callback#code=<one-time code, valid 2 minutes, stored hashed>
Everything after # stays in the browser: it isn't sent to servers or in Referer headers.
Failures go to <frontend>/login#oauth_error=<reason>.
"""
import logging
from datetime import datetime, timezone
from urllib.parse import urlencode

from flask import abort, current_app, jsonify, redirect, request
from sqlalchemy import select, update

from app.api import api
from app.api.auth import _logged_in, _token_for, now_utc
from app.extensions import db, limiter
from app.models import Category, LoginCode, OAuthIdentity, User
from app.models.enums import OAuthProvider
from app.models.one_time_token import hash_token
from app.schemas.auth import OAuthExchangeIn
from app.services import notifications, oauth
from app.validation import parse_body

log = logging.getLogger("ledgerly.auth")
LOGIN_CODE_MINUTES = 2


def _frontend(path: str, **fragment) -> str:
    return f"{current_app.config['FRONTEND_ORIGIN'].rstrip('/')}{path}#{urlencode(fragment)}"


def _fail(provider: str, reason: str, detail: str = ""):
    log.warning("%s sign-in failed: %s %s", provider, reason, detail)
    return redirect(_frontend("/login", oauth_error=reason))


@api.get("/auth/oauth/providers")
def oauth_providers():
    return jsonify(providers=oauth.configured_providers())


@api.get("/auth/oauth/<provider>/start")
@limiter.limit("20 per minute")
def oauth_start(provider):
    if not oauth.is_configured(provider):
        abort(404, description="That sign-in option isn't available.")
    remember = request.args.get("remember") in ("1", "true")
    log.info("%s sign-in started", provider)
    return redirect(oauth.authorization_url(provider, remember))


def _find_or_create_user(provider: str, profile: dict) -> tuple[User, bool]:
    """Same Google/Microsoft account -> same user. Otherwise link by (verified) email, or create a new user."""
    identity = db.session.scalar(select(OAuthIdentity).where(
        OAuthIdentity.provider == OAuthProvider(provider), OAuthIdentity.subject == profile["subject"]))
    if identity:
        identity.last_login_at = now_utc()
        user = db.session.get(User, identity.user_id)
        log.info("%s sign-in for existing linked account %s", provider, user.id)
        return user, False

    user = db.session.scalar(select(User).where(User.email == profile["email"]))
    is_new = user is None
    if is_new:
        user = User(full_name=profile["name"], email=profile["email"], password_hash=None, email_verified_at=now_utc())
        db.session.add(user)
        db.session.flush()
        db.session.add_all(Category.defaults_for(user.id))
        notifications.welcome(user)
        log.info("%s sign-up created account %s", provider, user.id)
    else:
        if user.email_verified_at is None:
            user.email_verified_at = now_utc()  # the provider has confirmed the email for us
        log.info("%s account linked to existing account %s (same verified email)", provider, user.id)
        label = oauth.PROVIDERS[provider]["label"]
        notifications.security(user.id, f"{label} sign-in added",
                               f"You can now sign in to Ledgerly with your {label} account ({profile['email']}). "
                               "If this wasn’t you, change your password and contact support.")
    db.session.add(OAuthIdentity(user_id=user.id, provider=OAuthProvider(provider),
                                 subject=profile["subject"], email=profile["email"]))
    return user, is_new


@api.get("/auth/oauth/<provider>/callback")
@limiter.limit("20 per minute")
def oauth_callback(provider):
    if provider not in oauth.PROVIDERS:
        abort(404)
    if request.args.get("error"):
        # e.g. the person pressed "Cancel" on the Google/Microsoft page
        reason = "cancelled" if request.args.get("error") == "access_denied" else "failed"
        return _fail(provider, reason, request.args.get("error", ""))
    try:
        pending = oauth.take_pending(provider, request.args.get("state"))
        code = request.args.get("code")
        if not code:
            raise oauth.OAuthError("failed", "no code in callback")
        claims = oauth.exchange_code(provider, code, pending)
        profile = oauth.profile_from(provider, claims)
    except oauth.OAuthError as exc:
        return _fail(provider, exc.reason, str(exc))
    except Exception:  # network trouble with the provider, unexpected responses
        log.exception("%s sign-in crashed", provider)
        return redirect(_frontend("/login", oauth_error="failed"))

    user, is_new = _find_or_create_user(provider, profile)
    db.session.execute(update(LoginCode).where(LoginCode.user_id == user.id, LoginCode.used_at.is_(None))
                       .values(used_at=now_utc()))
    row, raw = LoginCode.issue(user.id, LOGIN_CODE_MINUTES)
    row.remember_me, row.is_new_user = pending["remember_me"], is_new
    db.session.add(row)
    db.session.commit()
    return redirect(_frontend("/auth/callback", code=raw))


@api.post("/auth/oauth/exchange")
@limiter.limit(lambda: current_app.config["LOGIN_RATE_LIMIT"])
def oauth_exchange():
    data = parse_body(OAuthExchangeIn)
    row = db.session.scalar(select(LoginCode).where(LoginCode.token_hash == hash_token(data.code)).with_for_update())
    if row is None or not row.is_usable:
        log.warning("Sign-in code rejected (unknown, used or expired)")
        return jsonify(error={"code": 400, "name": "Bad Request", "reason": "invalid_code",
                              "message": "This sign-in has expired. Please try again."}), 400
    row.used_at = datetime.now(timezone.utc)
    user = db.session.get(User, row.user_id)
    db.session.commit()
    log.info("Signed in with Google/Microsoft (account %s, new=%s)", user.id, row.is_new_user)
    response, status = _logged_in(user, _token_for(user, row.remember_me))
    body = response.get_json() | {"is_new_user": row.is_new_user}
    return jsonify(body), status
