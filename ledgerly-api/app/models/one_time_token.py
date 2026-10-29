"""Shared parts of one-time email links (password reset, email verification)."""
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import CHAR, DateTime, ForeignKey, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


def hash_token(raw: str) -> str:
    """We store only a SHA-256 hash of the link token, never the token itself."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class OneTimeTokenMixin:
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(CHAR(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    @classmethod
    def issue(cls, user_id, minutes: int):
        """Create a token row and return it with the raw token for the email link."""
        raw = secrets.token_urlsafe(32)
        row = cls(user_id=user_id, token_hash=hash_token(raw),
                  expires_at=datetime.now(timezone.utc) + timedelta(minutes=minutes))
        return row, raw

    @property
    def is_usable(self) -> bool:
        return self.used_at is None and self.expires_at > datetime.now(timezone.utc)
