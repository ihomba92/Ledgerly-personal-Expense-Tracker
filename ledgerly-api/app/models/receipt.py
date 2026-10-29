"""Receipt files attached to expenses (one per expense)."""
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKeyConstraint, Integer, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db

ALLOWED_TYPES = ("application/pdf", "image/png", "image/jpeg")
MAX_BYTES = 15 * 1024 * 1024


class Receipt(db.Model):
    __tablename__ = "receipts"
    __table_args__ = (
        CheckConstraint("mime_type IN ('application/pdf', 'image/png', 'image/jpeg')", name="allowed_type"),
        CheckConstraint(f"size_bytes BETWEEN 1 AND {MAX_BYTES}", name="size_range"),
        # The expense must belong to the same user; deleting the expense deletes the receipt.
        ForeignKeyConstraint(["expense_id", "user_id"], ["expenses.id", "expenses.user_id"],
                             name="fk_receipts_expense_same_user", ondelete="CASCADE"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    expense_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(50))
    size_bytes: Mapped[int] = mapped_column(Integer)
    storage_key: Mapped[str] = mapped_column(String(500), unique=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
