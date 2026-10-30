"""In-app notifications shown under the bell.

`dedupe_key` stops the same alert repeating, e.g. "budget:<category>:2026-10:85" is created once
per category per month. (Push notifications to phones can later send these same rows.)
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db
from app.models.enums import NotificationKind


class Notification(db.Model):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_created", "user_id", "created_at"),
        Index("uq_notifications_user_dedupe", "user_id", "dedupe_key", unique=True,
              postgresql_where=text("dedupe_key IS NOT NULL")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[NotificationKind] = mapped_column(Enum(NotificationKind, name="notification_kind"))
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(String(300))
    link: Mapped[str | None] = mapped_column(String(200))  # where in the app it leads, e.g. /app/categories
    dedupe_key: Mapped[str | None] = mapped_column(String(120))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
