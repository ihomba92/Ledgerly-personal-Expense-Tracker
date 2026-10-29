"""Income and top-ups (money in). Each one raises the balance.

  GET    /api/top-ups?source=mpesa&month=2026-10&page=1   list, newest first
  POST   /api/top-ups                                     add money
  PATCH  /api/top-ups/<id>                                correct one
  DELETE /api/top-ups/<id>                                remove one (not if the balance would go below zero)
"""
import logging

from flask import jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func, select

from app.api import api
from app.api.dates import month_range
from app.api.helpers import conflict, current_user_id, get_owned, page_of, parse_query
from app.api.serializers import top_up_json
from app.extensions import db
from app.models import TopUp, User
from app.models.enums import TopUpKind
from app.money import label, money, to_cents
from app.schemas.ledger import TopUpIn, TopUpQuery, TopUpUpdate
from app.services.ledger import balance_cents, balance_json, lock_user
from app.validation import parse_body

log = logging.getLogger("ledgerly.ledger")


def _refuse_below_zero(uid, removing_cents: int):
    lock_user(uid)
    balance = balance_cents(uid)
    if balance - removing_cents < 0:
        currency = db.session.get(User, uid).currency
        conflict(f"This would leave your balance at {label(balance - removing_cents, currency)}. "
                 "Delete or edit some paid expenses first.", "balance_below_zero", balance=money(balance))


@api.get("/top-ups")
@jwt_required()
def list_top_ups():
    query = parse_query(TopUpQuery)
    uid = current_user_id()
    stmt = select(TopUp).where(TopUp.user_id == uid)
    if query.source:
        stmt = stmt.where(TopUp.source == query.source)
    if query.month:
        _, start, end = month_range(query.month, db.session.get(User, uid))
        stmt = stmt.where(TopUp.received_on.between(start, end))
    matching = stmt.subquery()
    total = db.session.scalar(select(func.coalesce(func.sum(matching.c.amount_cents), 0)))
    rows, meta = page_of(stmt.order_by(TopUp.received_on.desc(), TopUp.created_at.desc()), query.page, query.per_page)
    return jsonify(top_ups=[top_up_json(t) for t in rows], total=money(total), pagination=meta)


@api.post("/top-ups")
@jwt_required()
def create_top_up():
    data = parse_body(TopUpIn)
    uid = current_user_id()
    lock_user(uid)
    first = db.session.scalar(select(func.count()).where(TopUp.user_id == uid)) == 0
    top_up = TopUp(user_id=uid, amount_cents=to_cents(data.amount), source=data.source, received_on=data.received_on,
                   note=data.note or ("Starting balance" if first else None),
                   kind=TopUpKind.initial if first else TopUpKind.topup)
    db.session.add(top_up)
    db.session.commit()
    log.info("Top-up %s added (%s, %s cents, %s)", top_up.id, top_up.kind.value, top_up.amount_cents, top_up.source.value)
    return jsonify(top_up=top_up_json(top_up), balance=balance_json(uid)), 201


@api.patch("/top-ups/<top_up_id>")
@jwt_required()
def update_top_up(top_up_id):
    top_up = get_owned(TopUp, top_up_id, "top-up")
    data = parse_body(TopUpUpdate)
    if data.amount is not None:
        new_cents = to_cents(data.amount)
        if new_cents < top_up.amount_cents:
            _refuse_below_zero(top_up.user_id, top_up.amount_cents - new_cents)
        top_up.amount_cents = new_cents
    for field in ("source", "received_on"):
        if getattr(data, field) is not None:
            setattr(top_up, field, getattr(data, field))
    if "note" in data.model_fields_set:
        top_up.note = data.note
    db.session.commit()
    return jsonify(top_up=top_up_json(top_up), balance=balance_json(top_up.user_id))


@api.delete("/top-ups/<top_up_id>")
@jwt_required()
def delete_top_up(top_up_id):
    top_up = get_owned(TopUp, top_up_id, "top-up")
    _refuse_below_zero(top_up.user_id, top_up.amount_cents)
    db.session.delete(top_up)
    db.session.commit()
    log.info("Top-up %s removed (%s cents)", top_up.id, top_up.amount_cents)
    currency = db.session.get(User, top_up.user_id).currency
    return jsonify(message=f"{label(top_up.amount_cents, currency)} removed from your balance.", balance=balance_json(top_up.user_id))
