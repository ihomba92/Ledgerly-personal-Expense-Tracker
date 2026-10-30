"""Account endpoints.

  POST /api/auth/register             create an account and email a confirmation link
  POST /api/auth/verify-email         confirm the email from that link and log the user in
  POST /api/auth/resend-verification  send a fresh confirmation link
  POST /api/auth/login                log in (only after the email is confirmed)
  GET  /api/auth/me                   the logged-in user
  POST /api/auth/forgot-password      email a password reset link
  POST /api/auth/reset-password       choose a new password from that link

Logging in or confirming an email returns an access token (a JWT). The React app
sends it with every request in the header:  Authorization: Bearer <token>
"""
import logging
from datetime import datetime, timedelta, timezone

from flask import current_app, jsonify
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app.api import api
from app.extensions import db, limiter
from app.models import Category, EmailVerificationToken, PasswordResetToken, User
from app.models.one_time_token import hash_token
from app.schemas.auth import (ForgotPasswordIn, LoginIn, RegisterIn, ResendVerificationIn, ResetPasswordIn,
                              UserOut, VerifyEmailIn)
from app.security import hash_password, verify_password
from app.services.email import password_reset_email, send_email, verification_email
from app.validation import parse_body
from app.services import notifications


log = logging.getLogger("ledgerly.auth")


def mask_email(email: str) -> str:
    """For logs: janice@example.com -> j***@example.com"""
    name, _, domain = str(email).partition("@")
    return f"{name[:1]}***@{domain}" if domain else "***"


# ---------- helpers ----------

def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def password_stamp(user: User) -> int:
    return int(user.password_changed_at.timestamp() * 1000)


def _token_for(user: User, remember_me: bool = False) -> str:
    days = current_app.config["JWT_REMEMBER_DAYS"] if remember_me else current_app.config["JWT_DEFAULT_DAYS"]
    # "pwd" records when the password last changed; after a reset, older tokens no longer match.
    return create_access_token(identity=str(user.id), expires_delta=timedelta(days=days),
                               additional_claims={"pwd": password_stamp(user)})


def _user_json(user: User) -> dict:
    return UserOut.model_validate(user).model_dump(mode="json")


def _logged_in(user: User, token: str, status: int = 200, message: str | None = None):
    body = {"access_token": token, "token_type": "Bearer", "user": _user_json(user)}
    if message:
        body["message"] = message
    return jsonify(body), status


def _error(code: int, name: str, message: str, fields: dict | None = None, reason: str | None = None):
    body = {"code": code, "name": name, "message": message}
    if fields:
        body["fields"] = fields
    if reason:
        body["reason"] = reason  # a fixed word the React app can check, e.g. "email_not_verified"
    return jsonify(error=body), code


def _send_link(user: User, model, minutes: int, path: str, build_email) -> bool:
    """Cancel the user's older unused links of this kind, issue a new one and email it."""
    db.session.execute(update(model).where(model.user_id == user.id, model.used_at.is_(None)).values(used_at=now_utc()))
    row, raw = model.issue(user.id, minutes)
    db.session.add(row)
    db.session.commit()
    # The token goes after "#": browsers never send that part to any server or in Referer headers,
    # and the React page removes it from the address bar as soon as it has read it.
    link = f"{current_app.config['FRONTEND_ORIGIN']}{path}#token={raw}"
    subject, html, text = build_email(user, link)
    return send_email(user.email, subject, html, text)


def _send_verification(user: User) -> bool:
    return _send_link(user, EmailVerificationToken, current_app.config["EMAIL_VERIFICATION_MINUTES"], "/verify-email",
               lambda u, link: verification_email(u.full_name, link))


def _find_usable(model, raw_token: str):
    row = db.session.scalar(select(model).where(model.token_hash == hash_token(raw_token)).with_for_update())
    return row if row is not None and row.is_usable else None


# ---------- sign up and email confirmation ----------

@api.post("/auth/register")
def register():
    data = parse_body(RegisterIn)
    user = User(full_name=data.full_name, email=str(data.email).lower(), password_hash=hash_password(data.password))
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        message = "An account with this email already exists."
        return _error(409, "Conflict", message, {"email": message})
    db.session.refresh(user)
    db.session.add_all(Category.defaults_for(user.id))  # every ledger starts with the usual categories
    notifications.welcome(user)
    db.session.commit()
    sent = _send_verification(user)
    log.info("Account %s created (%s); confirmation email %s", user.id, mask_email(user.email),
             "sent" if sent else "NOT sent")
    # No token yet: the account opens once the email is confirmed.
    return jsonify(message=f"We’ve sent a confirmation link to {user.email}. Open it to start using Ledgerly.",
                   user=_user_json(user)), 201


@api.post("/auth/verify-email")
@limiter.limit(lambda: current_app.config["LOGIN_RATE_LIMIT"])
def verify_email():
    """Confirm the email and log the user in, so the app can open the dashboard straight away."""
    data = parse_body(VerifyEmailIn)
    row = _find_usable(EmailVerificationToken, data.token)
    if row is None:
        log.warning("Email confirmation rejected: link unknown, used or expired")
        message = "This confirmation link is invalid or has expired. Request a new one."
        return _error(400, "Bad Request", message, reason="invalid_link")

    user = db.session.get(User, row.user_id)
    row.used_at = now_utc()
    if user.email_verified_at is None:
        user.email_verified_at = row.used_at
    db.session.commit()
    log.info("Email confirmed for account %s", user.id)
    return _logged_in(user, _token_for(user), message="Your email is confirmed. Welcome to Ledgerly.")


@api.post("/auth/resend-verification")
@limiter.limit(lambda: current_app.config["RESEND_VERIFICATION_RATE_LIMIT"])
def resend_verification():
    """Send a fresh confirmation link. Same answer for every email, so it reveals nothing."""
    data = parse_body(ResendVerificationIn)
    user = db.session.scalar(select(User).where(User.email == str(data.email)))
    if user and not user.email_verified:
        sent = _send_verification(user)
        log.info("Confirmation email %s to %s", "re-sent" if sent else "NOT re-sent", mask_email(data.email))
    else:
        # Only in the server log; the answer below is the same for everyone.
        log.info("Confirmation email not re-sent to %s: %s", mask_email(data.email),
                 "already confirmed" if user else "no account with this email")
    return jsonify(message="If that account still needs confirming, we’ve sent a new link."), 200


# ---------- log in ----------

@api.post("/auth/login")
@limiter.limit(lambda: current_app.config["LOGIN_RATE_LIMIT"])  # at most 5 attempts a minute per IP
def login():
    data = parse_body(LoginIn)
    user = db.session.scalar(select(User).where(User.email == str(data.email)))
    if not verify_password(data.password, user.password_hash if user else None):
        reason = "no such account" if user is None else "account has no password (Google/Microsoft sign-in)" \
            if not user.has_password else "wrong password"
        log.warning("Login failed for %s: %s", mask_email(data.email), reason)
        # Same message whether the email or the password is wrong.
        return _error(401, "Unauthorized", "Email or password is incorrect.")
    if not user.email_verified:
        log.info("Login refused for account %s: email not confirmed", user.id)
        # Only said after the password is right, so it reveals nothing to strangers.
        return _error(403, "Forbidden", "Confirm your email to continue. Check your inbox for the link, or request a new one.",
                      reason="email_not_verified")
    log.info("Login succeeded for account %s (remember_me=%s)", user.id, data.remember_me)
    return _logged_in(user, _token_for(user, data.remember_me))


@api.get("/auth/me")
@jwt_required()
def me():
    user = db.session.get(User, get_jwt_identity())
    return jsonify(user=_user_json(user))


# ---------- forgotten password ----------

@api.post("/auth/forgot-password")
@limiter.limit(lambda: current_app.config["FORGOT_PASSWORD_RATE_LIMIT"])
def forgot_password():
    """Email a one-time reset link. Always answers the same way, so nobody can
    use this form to find out which emails have accounts."""
    data = parse_body(ForgotPasswordIn)
    user = db.session.scalar(select(User).where(User.email == str(data.email)))
    if user:
        minutes = current_app.config["PASSWORD_RESET_MINUTES"]
        sent = _send_link(user, PasswordResetToken, minutes, "/reset-password",
                          lambda u, link: password_reset_email(u.full_name, link, minutes))
        log.info("Password reset link %s for account %s", "emailed" if sent else "created but NOT emailed", user.id)
    else:
        log.info("Password reset requested for %s: no account (nothing sent)", mask_email(data.email))
    return jsonify(message="If an account exists for that email, we’ve sent a link to reset the password."), 200


@api.post("/auth/reset-password")
@limiter.limit(lambda: current_app.config["LOGIN_RATE_LIMIT"])
def reset_password():
    data = parse_body(ResetPasswordIn)
    row = _find_usable(PasswordResetToken, data.token)
    if row is None:
        log.warning("Password reset rejected: link unknown, used or expired")
        message = "This reset link is invalid or has expired. Request a new one."
        return _error(400, "Bad Request", message, {"token": message}, reason="invalid_link")

    user = db.session.get(User, row.user_id)
    changed = now_utc()
    user.password_hash = hash_password(data.password)
    user.password_changed_at = changed  # logs out every device that used the old password
    if user.email_verified_at is None:
        user.email_verified_at = changed  # the reset link proves they own the email
    row.used_at = changed
    notifications.security(user.id, "Your password was reset",
                           "Your Ledgerly password was changed using a reset link, and other devices were logged out. "
                           "If this wasn’t you, reset it again straight away.")
    db.session.commit()
    log.info("Password reset completed for account %s; other sessions ended", user.id)
    return jsonify(message="Your password has been changed. Log in with your new password."), 200
