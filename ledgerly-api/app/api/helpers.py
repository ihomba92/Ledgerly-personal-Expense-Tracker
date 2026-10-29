"""Small helpers shared by the data endpoints."""
import uuid

from flask import abort, jsonify, make_response, request
from flask_jwt_extended import get_jwt_identity
from pydantic import BaseModel, ValidationError

from app.extensions import db


def current_user_id() -> uuid.UUID:
    return uuid.UUID(get_jwt_identity())


def parse_uuid(value: str, what: str = "item") -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        abort(404, description=f"That {what} wasn't found.")


def get_owned(model, item_id: str, what: str):
    """Load a row that belongs to the logged-in user, or answer 404.
    Other people's rows look exactly like rows that don't exist."""
    row = db.session.get(model, parse_uuid(item_id, what))
    if row is None or row.user_id != current_user_id():
        abort(404, description=f"That {what} wasn't found.")
    return row


def parse_query(schema: type[BaseModel]) -> BaseModel:
    """Validate query-string filters (?month=2026-10&page=2) the same way as JSON bodies."""
    from app.validation import field_errors

    try:
        return schema.model_validate({k: v for k, v in request.args.to_dict().items() if v != ""})
    except ValidationError as exc:
        body = {"error": {"code": 422, "name": "Validation Error", "message": "Some filters aren't valid.",
                          "fields": field_errors(exc)}}
        abort(make_response(jsonify(body), 422))


def conflict(message: str, reason: str, **details):
    """409: the request is valid, but it breaks a ledger rule (e.g. not enough balance)."""
    body = {"code": 409, "name": "Conflict", "message": message, "reason": reason}
    if details:
        body["details"] = details
    abort(make_response(jsonify(error=body), 409))


def page_of(query, page: int, per_page: int):
    """Run a select with paging. Returns (rows, meta)."""
    from sqlalchemy import func, select

    total = db.session.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    rows = db.session.scalars(query.limit(per_page).offset((page - 1) * per_page)).unique().all()
    pages = max(1, -(-total // per_page))
    return rows, {"page": page, "per_page": per_page, "total": total, "pages": pages}
