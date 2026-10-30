"""Expenses. Paid expenses come out of the balance; drafts don't until they're paid.

  GET    /api/expenses?status=&category_id=&method=&receipt=&month=&q=&sort=&page=   list with filters
  POST   /api/expenses                 record one (status "paid" or "draft")
  GET    /api/expenses/<id>            one expense
  PATCH  /api/expenses/<id>            edit (the balance rule is checked again)
  DELETE /api/expenses/<id>            delete (a paid amount returns to the balance)
  POST   /api/expenses/<id>/pay        pay a draft from the balance
  POST   /api/expenses/pay             pay several drafts at once   {"ids": [...]}
  POST   /api/expenses/delete          delete several at once       {"ids": [...]}
"""
import logging
from datetime import datetime, timezone

from flask import abort, jsonify, make_response
from flask_jwt_extended import jwt_required
from sqlalchemy import func, or_, select

from app.api import api
from app.api.dates import month_range
from app.api.helpers import conflict, current_user_id, get_owned, page_of, parse_query
from app.api.serializers import expense_json
from app.extensions import db
from app.models import Category, Expense, Receipt, User
from app.models.enums import ExpenseStatus
from app.money import label, money, to_cents
from app.schemas.ledger import ExpenseIds, ExpenseIn, ExpenseQuery, ExpenseUpdate
from app.services import storage
from app.services.ledger import balance_json, lock_user, require_funds
from app.services.notifications import check_after_spending
from app.api.dates import today_for
from app.validation import parse_body

log = logging.getLogger("ledgerly.ledger")


def _now():
    return datetime.now(timezone.utc)


def _after_spending(uid, expenses):
    """Budget and low-balance alerts for the bell, once the spending is saved."""
    user = db.session.get(User, uid)
    check_after_spending(user, expenses, today_for(user))
    db.session.commit()


def _require_own_category(uid, category_id):
    if db.session.scalar(select(Category.id).where(Category.id == category_id, Category.user_id == uid)) is None:
        message = "Choose one of your categories."
        abort(make_response(jsonify(error={"code": 422, "name": "Validation Error", "message": "Some fields need attention.",
                                           "fields": {"category_id": message}}), 422))


def _filtered(uid, query: ExpenseQuery):
    stmt = select(Expense).where(Expense.user_id == uid)
    if query.status:
        stmt = stmt.where(Expense.status == query.status)
    if query.category_id:
        stmt = stmt.where(Expense.category_id == query.category_id)
    if query.method:
        stmt = stmt.where(Expense.method == query.method)
    if query.receipt:
        has = select(Receipt.id).where(Receipt.expense_id == Expense.id).exists()
        stmt = stmt.where(has if query.receipt == "attached" else ~has)
    if query.month:
        _, start, end = month_range(query.month, db.session.get(User, uid))
        stmt = stmt.where(Expense.spent_on.between(start, end))
    if query.q:
        like = f"%{query.q.strip()}%"
        stmt = stmt.where(or_(Expense.subject.ilike(like), Expense.merchant.ilike(like), Expense.note.ilike(like)))
    return stmt


SORTS = {
    "date-desc": (Expense.spent_on.desc(), Expense.created_at.desc()),
    "date-asc": (Expense.spent_on.asc(), Expense.created_at.asc()),
    "amount-desc": (Expense.amount_cents.desc(), Expense.spent_on.desc()),
    "amount-asc": (Expense.amount_cents.asc(), Expense.spent_on.desc()),
}


@api.get("/expenses")
@jwt_required()
def list_expenses():
    query = parse_query(ExpenseQuery)
    uid = current_user_id()
    stmt = _filtered(uid, query)
    matching = stmt.subquery()
    total = db.session.scalar(select(func.coalesce(func.sum(matching.c.amount_cents), 0)))
    rows, meta = page_of(stmt.order_by(*SORTS[query.sort]), query.page, query.per_page)
    return jsonify(expenses=[expense_json(e) for e in rows], total=money(total), pagination=meta)


@api.post("/expenses")
@jwt_required()
def create_expense():
    data = parse_body(ExpenseIn)
    uid = current_user_id()
    _require_own_category(uid, data.category_id)
    cents = to_cents(data.amount)
    if data.status == ExpenseStatus.paid:
        require_funds(uid, cents)
    expense = Expense(user_id=uid, category_id=data.category_id, subject=data.subject, merchant=data.merchant,
                      amount_cents=cents, method=data.method, status=data.status, spent_on=data.spent_on, note=data.note,
                      paid_at=_now() if data.status == ExpenseStatus.paid else None)
    db.session.add(expense)
    db.session.commit()
    log.info("Expense %s created (%s, %s cents)", expense.id, expense.status.value, cents)
    _after_spending(uid, [expense])
    return jsonify(expense=expense_json(expense), balance=balance_json(uid)), 201


@api.get("/expenses/<expense_id>")
@jwt_required()
def get_expense(expense_id):
    return jsonify(expense=expense_json(get_owned(Expense, expense_id, "expense")))


@api.patch("/expenses/<expense_id>")
@jwt_required()
def update_expense(expense_id):
    expense = get_owned(Expense, expense_id, "expense")
    data = parse_body(ExpenseUpdate)
    if data.category_id is not None:
        _require_own_category(expense.user_id, data.category_id)

    new_cents = to_cents(data.amount) if data.amount is not None else expense.amount_cents
    new_status = data.status or expense.status
    if new_status == ExpenseStatus.paid:
        # Give back what this expense already took, then check the new amount fits.
        require_funds(expense.user_id, new_cents, expense.amount_cents if expense.is_paid else 0)

    for field in ("subject", "merchant", "category_id", "method", "spent_on"):
        if getattr(data, field) is not None:
            setattr(expense, field, getattr(data, field))
    if "note" in data.model_fields_set:
        expense.note = data.note
    expense.amount_cents = new_cents
    if new_status != expense.status:
        expense.paid_at = _now() if new_status == ExpenseStatus.paid else None
        expense.status = new_status
    db.session.commit()
    log.info("Expense %s updated (%s, %s cents)", expense.id, expense.status.value, expense.amount_cents)
    _after_spending(expense.user_id, [expense])
    return jsonify(expense=expense_json(expense), balance=balance_json(expense.user_id))


@api.delete("/expenses/<expense_id>")
@jwt_required()
def delete_expense(expense_id):
    expense = get_owned(Expense, expense_id, "expense")
    key = expense.receipt.storage_key if expense.receipt else None
    refunded = expense.amount_cents if expense.is_paid else 0
    db.session.delete(expense)
    db.session.commit()
    storage.delete(key)
    log.info("Expense %s deleted (%s cents back in the balance)", expense.id, refunded)
    currency = db.session.get(User, expense.user_id).currency
    message = f"{expense.subject} deleted." + (f" {label(refunded, currency)} is back in your balance." if refunded else "")
    return jsonify(message=message, balance=balance_json(expense.user_id))


def _pay(expenses, uid):
    drafts = [e for e in expenses if not e.is_paid]
    if not drafts:
        conflict("Those expenses are already paid.", "already_paid")
    require_funds(uid, sum(e.amount_cents for e in drafts))
    for e in drafts:
        e.status, e.paid_at = ExpenseStatus.paid, _now()
    db.session.commit()
    log.info("Paid %d draft(s) from the balance: %s", len(drafts), ", ".join(str(e.id) for e in drafts))
    _after_spending(uid, drafts)
    return drafts


@api.post("/expenses/<expense_id>/pay")
@jwt_required()
def pay_expense(expense_id):
    expense = get_owned(Expense, expense_id, "expense")
    _pay([expense], expense.user_id)
    return jsonify(expense=expense_json(expense), balance=balance_json(expense.user_id))


def _owned_many(uid, ids):
    lock_user(uid)
    rows = db.session.scalars(select(Expense).where(Expense.user_id == uid, Expense.id.in_(ids))).unique().all()
    if len(rows) != len(set(ids)):
        abort(404, description="Some of those expenses weren't found.")
    return rows


@api.post("/expenses/pay")
@jwt_required()
def pay_many():
    data = parse_body(ExpenseIds)
    uid = current_user_id()
    paid = _pay(_owned_many(uid, data.ids), uid)  # all or nothing
    return jsonify(paid=[str(e.id) for e in paid], balance=balance_json(uid))


@api.post("/expenses/delete")
@jwt_required()
def delete_many():
    data = parse_body(ExpenseIds)
    uid = current_user_id()
    rows = _owned_many(uid, data.ids)
    keys = [e.receipt.storage_key for e in rows if e.receipt]
    refunded = sum(e.amount_cents for e in rows if e.is_paid)
    for e in rows:
        db.session.delete(e)
    db.session.commit()
    for key in keys:
        storage.delete(key)
    return jsonify(deleted=len(rows), refunded=money(refunded), balance=balance_json(uid))
