"""Balance and the numbers behind the dashboard and income pages.

  GET /api/balance                      topped up, spent, drafts and the balance
  GET /api/summary?month=2026-10        dashboard: spending, categories, daily totals, to-do counts, runway
  GET /api/reports/monthly?months=6     money in vs out for the last N months
"""
from datetime import date, timedelta

from flask import jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func, select

from app.api import api
from app.api.dates import month_range, today_for
from app.api.helpers import current_user_id, parse_query
from app.extensions import db
from app.models import Category, Expense, Receipt, TopUp, User
from app.models.enums import ExpenseStatus
from app.money import money
from app.schemas.ledger import MonthlyQuery, SummaryQuery
from app.services.ledger import balance_json, month_bounds

PAID = Expense.status == ExpenseStatus.paid


def _spent_between(uid, start: date, end: date) -> int:
    return int(db.session.scalar(select(func.coalesce(func.sum(Expense.amount_cents), 0))
                                 .where(Expense.user_id == uid, PAID, Expense.spent_on.between(start, end))))


@api.get("/balance")
@jwt_required()
def balance():
    return jsonify(balance=balance_json(current_user_id()))


@api.get("/summary")
@jwt_required()
def summary():
    query = parse_query(SummaryQuery)
    uid = current_user_id()
    user = db.session.get(User, uid)
    today = today_for(user)
    month, start, end = month_range(query.month, user)
    is_current = start <= today <= end
    upto = today if is_current else end  # compare like with like: same number of days

    spent = _spent_between(uid, start, upto)
    prev_end_month = start - timedelta(days=1)
    prev_start = prev_end_month.replace(day=1)
    prev_upto = min(prev_start + (upto - start), prev_end_month)
    prev_spent = _spent_between(uid, prev_start, prev_upto)
    change_pct = round((spent - prev_spent) / prev_spent * 100, 1) if prev_spent else None

    # Spending per day of the month
    per_day = dict(db.session.execute(select(Expense.spent_on, func.sum(Expense.amount_cents))
                                      .where(Expense.user_id == uid, PAID, Expense.spent_on.between(start, end))
                                      .group_by(Expense.spent_on)).all())
    daily = [{"date": (start + timedelta(days=i)).isoformat(), "spent": money(per_day.get(start + timedelta(days=i), 0))}
             for i in range((end - start).days + 1)]

    # Spending per category, with budgets
    by_cat = dict(db.session.execute(select(Expense.category_id, func.sum(Expense.amount_cents))
                                     .where(Expense.user_id == uid, PAID, Expense.spent_on.between(start, end))
                                     .group_by(Expense.category_id)).all())
    categories = db.session.scalars(select(Category).where(Category.user_id == uid)).all()
    cat_rows = []
    for c in categories:
        amount = int(by_cat.get(c.id, 0))
        pct = round(amount / c.budget_cents * 100, 1) if c.budget_cents else None
        cat_rows.append({"category_id": str(c.id), "label": c.label, "icon": c.icon, "spent": money(amount),
                         "spent_cents": amount, "budget": money(c.budget_cents), "used_pct": pct,
                         "status": None if pct is None else "over" if pct > 100 else "near" if pct >= 85 else "ok"})
    cat_rows.sort(key=lambda r: r["spent_cents"], reverse=True)
    total_budget = sum(c.budget_cents for c in categories)

    # To-do counts
    drafts = db.session.execute(select(func.count(), func.coalesce(func.sum(Expense.amount_cents), 0))
                                .where(Expense.user_id == uid, Expense.status == ExpenseStatus.draft)).one()
    has_receipt = select(Receipt.id).where(Receipt.expense_id == Expense.id).exists()
    missing_receipts = db.session.scalar(select(func.count()).where(Expense.user_id == uid, PAID, ~has_receipt,
                                                                     Expense.spent_on.between(start, end)))

    # Runway: how long the balance lasts at the last 30 days' average
    bal = balance_json(uid)
    last30 = _spent_between(uid, today - timedelta(days=29), today)
    per_day_avg = last30 / 30
    runway_days = int(bal["balance_cents"] // per_day_avg) if per_day_avg > 0 else None

    income = int(db.session.scalar(select(func.coalesce(func.sum(TopUp.amount_cents), 0))
                                   .where(TopUp.user_id == uid, TopUp.received_on.between(start, end))))
    days_counted = (upto - start).days + 1

    return jsonify(
        month=month,
        balance=bal,
        spent=money(spent),
        income=money(income),
        previous_period_spent=money(prev_spent),
        change_pct=change_pct,
        daily_average=money(round(spent / days_counted)) if days_counted else "0.00",
        daily=daily,
        categories=cat_rows,
        budgets={"total": money(total_budget), "used_pct": round(spent / total_budget * 100, 1) if total_budget else None,
                 "near_limit": sum(1 for r in cat_rows if r["status"] in ("near", "over")),
                 "over": sum(1 for r in cat_rows if r["status"] == "over")},
        todo={"drafts": drafts[0], "drafts_total": money(drafts[1]), "missing_receipts": missing_receipts},
        runway={"days": runway_days, "per_day": money(round(per_day_avg))},
    )


@api.get("/reports/monthly")
@jwt_required()
def monthly():
    query = parse_query(MonthlyQuery)
    uid = current_user_id()
    today = today_for(db.session.get(User, uid))
    months = []
    y, m = today.year, today.month
    for _ in range(query.months):
        months.append((y, m))
        y, m = (y - 1, 12) if m == 1 else (y, m - 1)
    rows = []
    for y, m in reversed(months):
        start, end = month_bounds(y, m)
        money_in = int(db.session.scalar(select(func.coalesce(func.sum(TopUp.amount_cents), 0))
                                         .where(TopUp.user_id == uid, TopUp.received_on.between(start, end))))
        money_out = _spent_between(uid, start, end)
        rows.append({"month": f"{y:04d}-{m:02d}", "in": money(money_in), "out": money(money_out),
                     "kept": money(money_in - money_out)})
    return jsonify(months=rows)
