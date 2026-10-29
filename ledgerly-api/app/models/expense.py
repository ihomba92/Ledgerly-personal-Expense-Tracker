"""Expenses. Paid ones come out of the balance; drafts don't."""
import uuid
from datetime import date, datetime

from sqlalchemy import (BigInteger, CheckConstraint, Date, DateTime, Enum, ForeignKey, ForeignKeyConstraint, Index,
                        String, UniqueConstraint, func, text)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.models.enums import ExpenseStatus, PaymentMethod


class Expense(db.Model):
    __tablename__ = "expenses"
    __table_args__ = (
        CheckConstraint("amount_cents > 0 AND amount_cents <= 1000000000", name="amount_range"),
        CheckConstraint("char_length(subject) BETWEEN 2 AND 120", name="subject_length"),
        CheckConstraint("char_length(merchant) BETWEEN 1 AND 120", name="merchant_length"),
        CheckConstraint("(status = 'paid') = (paid_at IS NOT NULL)", name="paid_at_matches_status"),
        # The category must belong to the same user.
        ForeignKeyConstraint(["category_id", "user_id"], ["categories.id", "categories.user_id"],
                             name="fk_expenses_category_same_user", ondelete="RESTRICT"),
        UniqueConstraint("id", "user_id", name="uq_expenses_id_user"),  # lets receipts check the owner
        Index("ix_expenses_user_spent", "user_id", "spent_on"),
        Index("ix_expenses_user_status", "user_id", "status"),
        Index("ix_expenses_user_category", "user_id", "category_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    category_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    subject: Mapped[str] = mapped_column(String(120))
    merchant: Mapped[str] = mapped_column(String(120))
    amount_cents: Mapped[int] = mapped_column(BigInteger)
    method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod, name="payment_method"), server_default="mpesa")
    status: Mapped[ExpenseStatus] = mapped_column(Enum(ExpenseStatus, name="expense_status"), server_default="draft")
    spent_on: Mapped[date] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(String(500))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    receipt = relationship("Receipt", uselist=False, lazy="joined", viewonly=True,
                           primaryjoin="Expense.id == foreign(Receipt.expense_id)")

    @property
    def is_paid(self) -> bool:
        return self.status == ExpenseStatus.paid
