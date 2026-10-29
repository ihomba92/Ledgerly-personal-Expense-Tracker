"""Messages sent from the Support page."""
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db
from app.models.enums import RequestStatus


class SupportRequest(db.Model):
    __tablename__ = "support_requests"
    __table_args__ = (
        CheckConstraint("char_length(subject) BETWEEN 4 AND 120", name="subject_length"),
        CheckConstraint("char_length(message) BETWEEN 20 AND 2000", name="message_length"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    topic: Mapped[str] = mapped_column(String(40))
    subject: Mapped[str] = mapped_column(String(120))
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[RequestStatus] = mapped_column(Enum(RequestStatus, name="request_status"), server_default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
