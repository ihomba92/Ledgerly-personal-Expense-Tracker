"""The balance rule and the numbers behind the dashboard.

Balance = everything topped up - every expense marked as paid. It is always
calculated, never stored. Anything that could push it below zero (paying an
expense, editing a paid amount, removing a top-up) first locks the user's row,
so two requests arriving at the same moment can't both spend the same money.
"""
import logging
import uuid
from datetime import date, timedelta

from sqlalchemy import func, select

from app.api.helpers import conflict
from app.extensions import db
from app.models import Expense, TopUp, User
from app.models.enums import ExpenseStatus
from app.money import label, money

log = logging.getLogger("ledgerly.ledger")


def lock_user(user_id: uuid.UUID) -> None:
    """Hold this user's row until the transaction ends (SELECT ... FOR UPDATE)."""
    db.session.execute(select(User.id).where(User.id == user_id).with_for_update())


def totals(user_id: uuid.UUID) -> dict:
    topped_up = db.session.scalar(select(func.coalesce(func.sum(TopUp.amount_cents), 0)).where(TopUp.user_id == user_id))
    spent = db.session.scalar(select(func.coalesce(func.sum(Expense.amount_cents), 0))
                              .where(Expense.user_id == user_id, Expense.status == ExpenseStatus.paid))
    drafts = db.session.scalar(select(func.coalesce(func.sum(Expense.amount_cents), 0))
                               .where(Expense.user_id == user_id, Expense.status == ExpenseStatus.draft))
    return {"topped_up_cents": int(topped_up), "spent_cents": int(spent), "drafts_cents": int(drafts),
            "balance_cents": int(topped_up) - int(spent)}


def balance_cents(user_id: uuid.UUID) -> int:
    return totals(user_id)["balance_cents"]


def require_funds(user_id: uuid.UUID, amount_cents: int, already_counted_cents: int = 0) -> None:
    """Stop with 409 if paying `amount_cents` would take the balance below zero.
    `already_counted_cents` is what an expense being edited has already taken (it's given back first)."""
    lock_user(user_id)
    available = balance_cents(user_id) + already_counted_cents
    if amount_cents > available:
        currency = db.session.scalar(select(User.currency).where(User.id == user_id))
        log.info("Payment refused: needs %s cents, %s cents available", amount_cents, available)
        conflict(
            f"This is {label(amount_cents - available, currency)} more than your balance of {label(available, currency)}. "
            "Top up first, or save it as a draft.",
            "insufficient_balance",
            available=money(available), shortfall=money(amount_cents - available),
        )


def balance_json(user_id: uuid.UUID) -> dict:
    t = totals(user_id)
    return {key.replace("_cents", ""): money(value) for key, value in t.items()} | {"balance_cents": t["balance_cents"]}


def month_bounds(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    end = date(year + (month == 12), month % 12 + 1, 1) - timedelta(days=1)
    return start, end
