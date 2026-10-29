"""One-time links for resetting a forgotten password (valid 30 minutes)."""
from app.extensions import db
from app.models.one_time_token import OneTimeTokenMixin, hash_token  # noqa: F401


class PasswordResetToken(OneTimeTokenMixin, db.Model):
    __tablename__ = "password_reset_tokens"
