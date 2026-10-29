"""The users table: one row per account."""
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, String, func, text
from sqlalchemy.dialects.postgresql import CITEXT, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db


class User(db.Model):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("char_length(full_name) BETWEEN 2 AND 80", name="full_name_length"),
        CheckConstraint("char_length(ledger_name) BETWEEN 2 AND 60", name="ledger_name_length"),
        CheckConstraint("char_length(currency) = 3", name="currency_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    full_name: Mapped[str] = mapped_column(String(80))
    # CITEXT compares case-insensitively, so Jane@Mail.com and jane@mail.com are the same account.
    email: Mapped[str] = mapped_column(CITEXT, unique=True)
    # Empty for accounts created with Google or Microsoft until the user sets a password.
    password_hash: Mapped[str | None] = mapped_column(String(255))
    ledger_name: Mapped[str] = mapped_column(String(60), server_default="Personal ledger")
    currency: Mapped[str] = mapped_column(String(3), server_default="KES")
    timezone: Mapped[str] = mapped_column(String(50), server_default="Africa/Nairobi")
    notify_low_balance: Mapped[bool] = mapped_column(server_default=text("true"))
    notify_budget: Mapped[bool] = mapped_column(server_default=text("true"))
    weekly_digest: Mapped[bool] = mapped_column(server_default=text("false"))
    # When the user clicked the link in the verification email (empty until then).
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Tokens issued before this moment stop working (e.g. after a password reset).
    password_changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    identities = relationship("OAuthIdentity", lazy="selectin", cascade="all, delete-orphan", passive_deletes=True)

    @property
    def has_password(self) -> bool:
        return self.password_hash is not None

    @property
    def providers(self) -> list[str]:
        return sorted(i.provider.value for i in self.identities)

    @property
    def email_verified(self) -> bool:
        return self.email_verified_at is not None

    def __repr__(self) -> str:
        return f"<User {self.email}>"
