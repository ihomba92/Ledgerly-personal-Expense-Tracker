"""The logged-in user's own account.

  PATCH  /api/auth/me                update name, ledger name, currency, time zone, notification choices
  POST   /api/auth/change-password   change the password (logs out other devices)
  DELETE /api/auth/me                delete the account and everything in it (asks for the password)
"""
import logging
from datetime import datetime, timezone

from flask import abort, jsonify, request, send_file
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
from app.services import avatars, notifications

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
    notifications.security(user.id, "Password set" if setting_first else "Password changed",
                           ("You can now log in with your email and password too." if setting_first
                            else "Your Ledgerly password was changed and other devices were logged out.")
                           + " If this wasn’t you, reset your password straight away.")
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
    if user.avatar_key:
        keys.append(user.avatar_key)
    db.session.delete(user)  # categories, income, expenses and receipts go with it
    db.session.commit()
    for key in keys:
        storage.delete(key)
    log.info("Account %s deleted with %d receipt file(s)", user_id, len(keys))
    return jsonify(message="Your account and all of its data have been deleted.")


# ---------- profile picture ----------
#   POST   /api/auth/me/avatar   form field "file": JPG, PNG or WebP up to 5 MB (cleaned and resized to 256 x 256)
#   GET    /api/auth/me/avatar   the picture (WebP)
#   DELETE /api/auth/me/avatar   remove it

@api.post("/auth/me/avatar")
@jwt_required()
@limiter.limit("10 per minute")
def upload_avatar():
    user = db.session.get(User, current_user_id())
    upload = request.files.get("file")
    if upload is None or not upload.filename:
        abort(400, description="Choose an image to upload (form field “file”).")
    try:
        image = avatars.process(upload.read(avatars.MAX_BYTES + 1))
    except avatars.AvatarError as exc:
        log.warning("Profile picture refused: %s", exc)
        from flask import make_response
        abort(make_response(jsonify(error={"code": 422, "name": "Validation Error", "message": str(exc),
                                           "fields": {"file": str(exc)}}), 422))
    old_key = user.avatar_key
    user.avatar_key = storage.save(user.id, image, ".webp")
    user.avatar_updated_at = datetime.now(timezone.utc)
    db.session.commit()
    storage.delete(old_key)
    log.info("Profile picture updated (%d bytes after cleaning)", len(image))
    return jsonify(user=_user_json(user))


@api.get("/auth/me/avatar")
@jwt_required()
def get_avatar():
    user = db.session.get(User, current_user_id())
    if not user.avatar_key or not storage.path_for(user.avatar_key).exists():
        abort(404, description="No profile picture.")
    return send_file(storage.path_for(user.avatar_key), mimetype="image/webp")


@api.delete("/auth/me/avatar")
@jwt_required()
def delete_avatar():
    user = db.session.get(User, current_user_id())
    old_key, user.avatar_key, user.avatar_updated_at = user.avatar_key, None, None
    db.session.commit()
    storage.delete(old_key)
    log.info("Profile picture removed")
    return jsonify(user=_user_json(user))
