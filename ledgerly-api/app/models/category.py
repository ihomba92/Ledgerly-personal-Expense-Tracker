"""Spending categories with an optional monthly budget."""
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db

# Created for every new account. "other" is the fallback that can't be deleted.
DEFAULT_CATEGORIES = [
    ("Food & groceries", "shopping_basket", 1_500_000),
    ("Transport", "directions_bus", 600_000),
    ("Rent & housing", "home", 2_500_000),
    ("Bills & utilities", "bolt", 700_000),
    ("Airtime & data", "wifi", 250_000),
    ("Eating out", "restaurant", 400_000),
    ("Health", "favorite", 500_000),
    ("Entertainment", "theaters", 300_000),
    ("Shopping", "shopping_bag", 500_000),
    ("Other", "more_horiz", 200_000),
]

ALLOWED_ICONS = {
    "shopping_basket", "directions_bus", "home", "bolt", "wifi", "restaurant", "favorite", "theaters", "shopping_bag",
    "school", "child_care", "pets", "fitness_center", "local_gas_station", "volunteer_activism", "savings", "flight", "more_horiz",
}


class Category(db.Model):
    __tablename__ = "categories"
    __table_args__ = (
        CheckConstraint("char_length(label) BETWEEN 2 AND 30", name="label_length"),
        CheckConstraint("budget_cents >= 0", name="budget_not_negative"),
        UniqueConstraint("id", "user_id", name="uq_categories_id_user"),  # lets expenses check the owner
        Index("uq_categories_user_label", "user_id", text("lower(label)"), unique=True),
        Index("uq_categories_one_fallback", "user_id", unique=True, postgresql_where=text("is_fallback")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(30))
    icon: Mapped[str] = mapped_column(String(40), server_default="more_horiz")
    budget_cents: Mapped[int] = mapped_column(BigInteger, server_default="0")
    is_fallback: Mapped[bool] = mapped_column(server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @classmethod
    def defaults_for(cls, user_id) -> list["Category"]:
        return [cls(user_id=user_id, label=label, icon=icon, budget_cents=budget, is_fallback=(label == "Other"))
                for label, icon, budget in DEFAULT_CATEGORIES]
