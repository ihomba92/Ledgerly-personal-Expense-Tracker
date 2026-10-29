"""One-time links that confirm a new account's email address (valid 24 hours)."""
from app.extensions import db
from app.models.one_time_token import OneTimeTokenMixin


class EmailVerificationToken(OneTimeTokenMixin, db.Model):
    __tablename__ = "email_verification_tokens"
