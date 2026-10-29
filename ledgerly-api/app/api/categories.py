"""Categories and their monthly budgets.

  GET    /api/categories?month=2026-10   all categories with spending for the month
  POST   /api/categories                 create one
  PATCH  /api/categories/<id>            rename, change icon or budget
  DELETE /api/categories/<id>            delete (its expenses move to "Other")
"""
from flask import jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError

from app.api import api
from app.api.dates import month_range
from app.api.helpers import conflict, current_user_id, get_owned, parse_query
from app.api.serializers import category_json
from app.extensions import db
from app.models import Category, Expense, User
from app.models.enums import ExpenseStatus
from app.money import to_cents
from app.schemas.ledger import CategoryIn, CategoryQuery, CategoryUpdate
from app.validation import parse_body


def _label_taken():
    message = "You already have a category with this name."
    from flask import abort, make_response
    abort(make_response(jsonify(error={"code": 409, "name": "Conflict", "message": message,
                                       "fields": {"label": message}, "reason": "duplicate_label"}), 409))


@api.get("/categories")
@jwt_required()
def list_categories():
    query = parse_query(CategoryQuery)
    uid = current_user_id()
    month, start, end = month_range(query.month, db.session.get(User, uid))

    spent = dict(db.session.execute(
        select(Expense.category_id, func.sum(Expense.amount_cents))
        .where(Expense.user_id == uid, Expense.status == ExpenseStatus.paid, Expense.spent_on.between(start, end))
        .group_by(Expense.category_id)).all())
    counts = dict(db.session.execute(
        select(Expense.category_id, func.count()).where(Expense.user_id == uid, Expense.status == ExpenseStatus.paid,
                                                         Expense.spent_on.between(start, end))
        .group_by(Expense.category_id)).all())
    rows = db.session.scalars(select(Category).where(Category.user_id == uid)
                              .order_by(Category.is_fallback, Category.created_at, Category.label)).all()

    items = [category_json(c, int(spent.get(c.id, 0)), counts.get(c.id, 0)) for c in rows]
    budgeted = [c for c in rows if c.budget_cents > 0]
    total_budget = sum(c.budget_cents for c in budgeted)
    total_spent = sum(int(v) for v in spent.values())
    return jsonify(month=month, categories=items, totals={
        "budget_cents": total_budget, "spent_cents": total_spent,
        "used_pct": round(total_spent / total_budget * 100, 1) if total_budget else None,
        "over_budget": sum(1 for i in items if i["status"] == "over"),
        "with_budget": len(budgeted),
    })


@api.post("/categories")
@jwt_required()
def create_category():
    data = parse_body(CategoryIn)
    category = Category(user_id=current_user_id(), label=data.label, icon=data.icon, budget_cents=to_cents(data.budget))
    db.session.add(category)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        _label_taken()
    return jsonify(category=category_json(category)), 201


@api.patch("/categories/<category_id>")
@jwt_required()
def update_category(category_id):
    category = get_owned(Category, category_id, "category")
    data = parse_body(CategoryUpdate)
    if data.label is not None:
        category.label = data.label
    if data.icon is not None:
        category.icon = data.icon
    if data.budget is not None:
        category.budget_cents = to_cents(data.budget)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        _label_taken()
    return jsonify(category=category_json(category))


@api.delete("/categories/<category_id>")
@jwt_required()
def delete_category(category_id):
    category = get_owned(Category, category_id, "category")
    if category.is_fallback:
        conflict("“Other” can’t be deleted. Expenses from deleted categories move here.", "fallback_category")
    fallback = db.session.scalar(select(Category).where(Category.user_id == category.user_id, Category.is_fallback))
    moved = db.session.execute(update(Expense).where(Expense.category_id == category.id, Expense.user_id == category.user_id)
                               .values(category_id=fallback.id)).rowcount
    db.session.delete(category)
    db.session.commit()
    return jsonify(message=f"{category.label} deleted.", moved_expenses=moved, moved_to=str(fallback.id))
