"""The logged-in user's own account.

  PATCH  /api/auth/me                update name, ledger name, currency, time zone, notification choices
  POST   /api/auth/change-password   change the password (logs out other devices)
  DELETE /api/auth/me                delete the account and everything in it (asks for the password)
"""
import logging
from datetime import datetime, timezone

from flask import jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import select

from app.api import api
from app.api.auth import _token_for, _user_json
from app.api.helpers import current_user_id
from app.extensions import db, limiter
from app.models import Receipt, User
from app.schemas.account import ChangePasswordIn, DeleteAccountIn, ProfileUpdate
from app.security import hash_password, verify_password
from app.services import storage
from app.validation import parse_body

log = logging.getLogger("ledgerly.auth")


def _wrong_password(field: str):
    from flask import abort, make_response
    message = "That password isn't right."
    abort(make_response(jsonify(error={"code": 403, "name": "Forbidden", "message": message,
                                       "fields": {field: message}}), 403))


@api.patch("/auth/me")
@jwt_required()
def update_profile():
    user = db.session.get(User, current_user_id())
    data = parse_body(ProfileUpdate)
    changes = data.model_dump(exclude_none=True)
    for field, value in changes.items():
        setattr(user, field, value)
    db.session.commit()
    log.info("Profile updated: %s", ", ".join(sorted(changes)) or "nothing")
    return jsonify(user=_user_json(user))


@api.post("/auth/change-password")
@jwt_required()
@limiter.limit("5 per minute")
def change_password():
    user = db.session.get(User, current_user_id())
    data = parse_body(ChangePasswordIn)
    setting_first = not user.has_password  # Google/Microsoft account adding a password
    if not setting_first and not verify_password(data.current_password or "", user.password_hash):
        log.warning("Password change refused: current password wrong")
        _wrong_password("current_password")
    user.password_hash = hash_password(data.new_password)
    user.password_changed_at = datetime.now(timezone.utc)  # other devices are logged out
    db.session.commit()
    log.info("Password %s; other sessions ended", "set for the first time" if setting_first else "changed")
    # This device stays logged in with a fresh token.
    message = "Your password has been set. You can now also log in with your email." if setting_first \
        else "Your password has been changed."
    return jsonify(message=message, access_token=_token_for(user), token_type="Bearer", user=_user_json(user))


@api.delete("/auth/me")
@jwt_required()
@limiter.limit("5 per minute")
def delete_account():
    user = db.session.get(User, current_user_id())
    data = parse_body(DeleteAccountIn)
    if user.has_password:
        if not verify_password(data.password or "", user.password_hash):
            log.warning("Account deletion refused: wrong password")
            _wrong_password("password")
    elif (data.confirm_email or "").strip().lower() != user.email.lower():
        from flask import abort, make_response
        message = "Type your account email to confirm."
        abort(make_response(jsonify(error={"code": 403, "name": "Forbidden", "message": message,
                                           "fields": {"confirm_email": message}}), 403))
    user_id = user.id
    keys = db.session.scalars(select(Receipt.storage_key).where(Receipt.user_id == user.id)).all()
    db.session.delete(user)  # categories, income, expenses and receipts go with it
    db.session.commit()
    for key in keys:
        storage.delete(key)
    log.info("Account %s deleted with %d receipt file(s)", user_id, len(keys))
    return jsonify(message="Your account and all of its data have been deleted.")
