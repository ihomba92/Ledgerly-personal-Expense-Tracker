"""Income and top-ups. Each one raises the balance."""
import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, CheckConstraint, Date, DateTime, Enum, ForeignKey, Index, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db
from app.models.enums import FundingSource, TopUpKind


class TopUp(db.Model):
    __tablename__ = "top_ups"
    __table_args__ = (
        CheckConstraint("amount_cents > 0 AND amount_cents <= 1000000000", name="amount_range"),
        Index("ix_top_ups_user_received", "user_id", "received_on"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    amount_cents: Mapped[int] = mapped_column(BigInteger)
    source: Mapped[FundingSource] = mapped_column(Enum(FundingSource, name="funding_source"))
    kind: Mapped[TopUpKind] = mapped_column(Enum(TopUpKind, name="topup_kind"), server_default="topup")
    received_on: Mapped[date] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
