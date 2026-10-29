"""Return every error as JSON, so the React app always gets the same shape back.

Every error body includes the request_id. If someone reports a problem, that id finds the
matching lines in the log straight away.
"""
import logging

from flask import g, jsonify, request
from werkzeug.exceptions import HTTPException

log = logging.getLogger("ledgerly.errors")


def _body(code: int, name: str, message: str) -> dict:
    return {"error": {"code": code, "name": name, "message": message, "request_id": getattr(g, "request_id", None)}}


def register_error_handlers(app):
    @app.after_request
    def add_request_id_to_errors(response):
        """Errors built elsewhere (validation, ledger rules) get the request id too."""
        if response.status_code >= 400 and response.is_json:
            data = response.get_json(silent=True)
            if isinstance(data, dict) and isinstance(data.get("error"), dict) and "request_id" not in data["error"]:
                data["error"]["request_id"] = getattr(g, "request_id", None)
                response.set_data(app.json.dumps(data))
        return response

    @app.errorhandler(429)
    def handle_too_many(err):
        log.warning("Rate limit hit on %s %s (%s)", request.method, request.path, err.description)
        return jsonify(_body(429, "Too Many Requests", "Too many attempts. Please wait a few minutes and try again.")), 429

    @app.errorhandler(HTTPException)
    def handle_http_error(err):
        return jsonify(_body(err.code, err.name, err.description)), err.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(err):
        log.exception("Unhandled error on %s %s", request.method, request.path)
        body = _body(500, "Internal Server Error", "Something went wrong on our side. If it keeps happening, "
                                                   "contact support with the reference below.")
        return jsonify(body), 500


def register_jwt_errors(jwt):
    """Token problems all come back as 401 with a clear message."""
    auth_log = logging.getLogger("ledgerly.auth")

    def unauthorized(message, reason):
        auth_log.info("Request refused (401): %s", reason)
        return jsonify(_body(401, "Unauthorized", message)), 401

    jwt.unauthorized_loader(lambda reason: unauthorized("Log in to continue.", "no login token"))
    jwt.expired_token_loader(lambda header, payload: unauthorized("Your session has expired. Log in again.", "token expired"))
    jwt.invalid_token_loader(lambda reason: unauthorized("Your session is not valid. Log in again.", f"invalid token ({reason})"))
    jwt.revoked_token_loader(lambda header, payload: unauthorized("Your session has ended. Log in again.",
                                                                  "token replaced (password changed or account deleted)"))
    jwt.user_lookup_error_loader(lambda header, payload: unauthorized("Your session has ended. Log in again.", "account not found"))

    @jwt.token_in_blocklist_loader
    def token_no_longer_valid(header, payload):
        """A token stops working if the account is gone or the password changed after it was issued."""
        from app.extensions import db
        from app.models import User

        user = db.session.get(User, payload["sub"])
        if user is None:
            return True
        g.user_id = str(user.id)  # every log line for this request now names the user
        return payload.get("pwd") != int(user.password_changed_at.timestamp() * 1000)
