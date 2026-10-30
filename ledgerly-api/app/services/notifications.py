"""Creating notifications for the bell.

  notify(...)                    add one (skipped quietly if its dedupe_key already exists)
  check_after_spending(user, …)  after an expense is paid or edited: budget and low-balance alerts

Budget and low-balance alerts respect the switches in Settings (notify_budget, notify_low_balance).
Security notices are always sent.
"""
import logging
import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert

from app.extensions import db
from app.models import Category, Expense, Notification, TopUp, User
from app.models.enums import ExpenseStatus, NotificationKind
from app.money import label

log = logging.getLogger("ledgerly.notifications")

NEAR_LIMIT = 0.85       # budget warning at 85%
LOW_BALANCE_SHARE = 0.10  # balance below 10% of everything added


def notify(user_id: uuid.UUID, kind: NotificationKind, title: str, body: str,
           link: str | None = None, dedupe_key: str | None = None) -> bool:
    """Add a notification. Returns False if one with the same dedupe_key already exists."""
    stmt = insert(Notification).values(user_id=user_id, kind=kind, title=title[:120], body=body[:300],
                                       link=link, dedupe_key=dedupe_key)
    if dedupe_key:
        stmt = stmt.on_conflict_do_nothing(index_elements=["user_id", "dedupe_key"],
                                           index_where=Notification.dedupe_key.isnot(None))
    created = db.session.execute(stmt).rowcount > 0
    if created:
        log.info("Notification created: %s (%s)", kind.value, dedupe_key or "no dedupe")
    return created


def welcome(user: User) -> None:
    notify(user.id, NotificationKind.welcome, "Welcome to Ledgerly",
           "Add your starting balance, then record expenses as you spend. Your balance updates every time.",
           link="/app/wallet", dedupe_key="welcome")


def security(user_id: uuid.UUID, title: str, body: str) -> None:
    notify(user_id, NotificationKind.security, title, body, link="/app/settings")


def _month_spent(user_id, category_id, start: date, end: date) -> int:
    return int(db.session.scalar(select(func.coalesce(func.sum(Expense.amount_cents), 0)).where(
        Expense.user_id == user_id, Expense.category_id == category_id, Expense.status == ExpenseStatus.paid,
        Expense.spent_on.between(start, end))))


def check_after_spending(user: User, expenses: list[Expense], today: date) -> None:
    """Run after paid expenses are saved: budget alerts for their categories (this month) and low balance."""
    from app.services.ledger import month_bounds, totals

    start, end = month_bounds(today.year, today.month)
    month = f"{today.year:04d}-{today.month:02d}"

    if user.notify_budget:
        for category_id in {e.category_id for e in expenses if e.status == ExpenseStatus.paid and start <= e.spent_on <= end}:
            category = db.session.get(Category, category_id)
            if not category or category.budget_cents <= 0:
                continue
            spent = _month_spent(user.id, category_id, start, end)
            share = spent / category.budget_cents
            if share > 1:
                notify(user.id, NotificationKind.budget_over, f"{category.label} is over budget",
                       f"You’ve spent {label(spent, user.currency)} of your {label(category.budget_cents, user.currency)} "
                       f"{category.label} budget this month.",
                       link="/app/categories", dedupe_key=f"budget:{category_id}:{month}:100")
            elif share >= NEAR_LIMIT:
                notify(user.id, NotificationKind.budget_near, f"{category.label} is at {int(share * 100)}% of its budget",
                       f"{label(category.budget_cents - spent, user.currency)} left of your "
                       f"{label(category.budget_cents, user.currency)} {category.label} budget this month.",
                       link="/app/categories", dedupe_key=f"budget:{category_id}:{month}:85")

    if user.notify_low_balance:
        t = totals(user.id)
        if t["topped_up_cents"] > 0 and t["balance_cents"] < t["topped_up_cents"] * LOW_BALANCE_SHARE:
            notify(user.id, NotificationKind.low_balance, "Your balance is running low",
                   f"{label(t['balance_cents'], user.currency)} left. Top up before your next payment.",
                   link="/app/wallet", dedupe_key=f"low-balance:{month}")
