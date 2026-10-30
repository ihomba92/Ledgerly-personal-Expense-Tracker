"""Extra `flask` commands.

  flask seed-demo   create (or rebuild) a confirmed demo account with two months of sample data
"""
from datetime import date, datetime, timedelta, timezone

import click
from sqlalchemy import delete, select

from app.extensions import db
from app.models import Category, Expense, Notification, TopUp, User
from app.models.category import DEFAULT_CATEGORIES
from app.services import notifications
from app.models.enums import ExpenseStatus, FundingSource, PaymentMethod, TopUpKind
from app.security import hash_password

DEMO_EMAIL = "demo@ledgerly.app"
DEMO_PASSWORD = "Ledgerly2026"

TOP_UPS = [  # (days ago, shillings, source, note)
    (62, 40000, "bank", "Starting balance"), (33, 85000, "salary", "Salary"),
    (19, 6500, "business", "Design side project"), (3, 85000, "salary", "Salary"),
]
EXPENSES = [  # (days ago, subject, merchant, category, shillings, method, status)
    (60, "Rent", "Kilimani Heights", "Rent & housing", 25000, "bank", "paid"),
    (58, "Electricity tokens", "KPLC", "Bills & utilities", 2000, "mpesa", "paid"),
    (56, "Home internet", "Safaricom Home", "Bills & utilities", 2999, "mpesa", "paid"),
    (54, "Weekly groceries", "Naivas", "Food & groceries", 4650, "card", "paid"),
    (49, "Lunch", "Mama Oliech", "Eating out", 750, "mpesa", "paid"),
    (47, "Data bundles", "Safaricom", "Airtime & data", 1000, "mpesa", "paid"),
    (45, "Weekly groceries", "Carrefour", "Food & groceries", 3980, "card", "paid"),
    (42, "Gym membership", "Zoezi Fitness", "Health", 3000, "card", "paid"),
    (40, "Movie night", "Century Cinemax", "Entertainment", 1200, "card", "paid"),
    (36, "Taxi home", "Bolt", "Transport", 640, "mpesa", "paid"),
    (31, "Rent", "Kilimani Heights", "Rent & housing", 25000, "bank", "paid"),
    (30, "Electricity tokens", "KPLC", "Bills & utilities", 2500, "mpesa", "paid"),
    (27, "Weekly groceries", "Naivas", "Food & groceries", 5120, "card", "paid"),
    (24, "Coffee with Amani", "Java House", "Eating out", 980, "card", "paid"),
    (22, "Pharmacy", "Goodlife Pharmacy", "Health", 1450, "mpesa", "paid"),
    (20, "Running shoes", "Decathlon", "Shopping", 6200, "card", "paid"),
    (18, "Weekly groceries", "Quickmart", "Food & groceries", 3760, "mpesa", "paid"),
    (16, "Matatu fares", "Route 46", "Transport", 1400, "cash", "paid"),
    (14, "Streaming", "Netflix", "Entertainment", 1100, "card", "paid"),
    (10, "Lunch", "Artcaffé", "Eating out", 1350, "card", "paid"),
    (8, "Fuel", "Rubis", "Transport", 3000, "card", "paid"),
    (4, "Airtime", "Safaricom", "Airtime & data", 500, "mpesa", "paid"),
    (2, "Weekly groceries", "Carrefour", "Food & groceries", 4870, "card", "paid"),
    (1, "Lunch", "Mama Oliech", "Eating out", 800, "mpesa", "paid"),
    (0, "Matatu fare", "Route 46", "Transport", 150, "cash", "paid"),
    (1, "Dentist check-up", "Smile Dental", "Health", 4500, "card", "draft"),
    (0, "Birthday gift", "Text Book Centre", "Shopping", 3200, "mpesa", "draft"),
]


def register_commands(app):
    @app.cli.command("seed-demo")
    def seed_demo():
        """Create a confirmed demo account full of sample data (safe to run again)."""
        today = date.today()
        now = datetime.now(timezone.utc)
        user = db.session.scalar(select(User).where(User.email == DEMO_EMAIL))
        if user is None:
            user = User(full_name="Janice Chandler", email=DEMO_EMAIL, password_hash=hash_password(DEMO_PASSWORD),
                        email_verified_at=now)
            db.session.add(user)
            db.session.flush()
            db.session.add_all(Category.defaults_for(user.id))
        else:  # start the demo data over
            db.session.execute(delete(Expense).where(Expense.user_id == user.id))
            db.session.execute(delete(TopUp).where(TopUp.user_id == user.id))
            db.session.execute(delete(Notification).where(Notification.user_id == user.id))
            budgets = {label: budget for label, _, budget in DEFAULT_CATEGORIES}
            for category in db.session.scalars(select(Category).where(Category.user_id == user.id)):
                if category.label in budgets:
                    category.budget_cents = budgets[category.label]
        db.session.flush()

        cats = {c.label: c.id for c in db.session.scalars(select(Category).where(Category.user_id == user.id))}
        for i, (days, amount, source, note) in enumerate(TOP_UPS):
            db.session.add(TopUp(user_id=user.id, amount_cents=amount * 100, source=FundingSource(source), note=note,
                                 received_on=today - timedelta(days=days),
                                 kind=TopUpKind.initial if i == 0 else TopUpKind.topup))
        for days, subject, merchant, label, amount, method, status in EXPENSES:
            paid = status == "paid"
            db.session.add(Expense(user_id=user.id, category_id=cats.get(label, cats["Other"]), subject=subject,
                                   merchant=merchant, amount_cents=amount * 100, method=PaymentMethod(method),
                                   status=ExpenseStatus(status), spent_on=today - timedelta(days=days),
                                   paid_at=now if paid else None))
        notifications.welcome(user)
        db.session.commit()
        click.echo(f"Demo account ready: {DEMO_EMAIL} / {DEMO_PASSWORD}")
