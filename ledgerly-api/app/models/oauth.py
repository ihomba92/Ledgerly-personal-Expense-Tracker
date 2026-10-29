"""Sign-in with Google and Microsoft.

OAuthIdentity  links one Google/Microsoft account (its permanent "subject" id) to a Ledgerly user.
LoginCode      a one-time code (valid 2 minutes, stored hashed) that hands the finished sign-in from
               the API to the React app without putting a login token in the address bar.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db
from app.models.enums import OAuthProvider
from app.models.one_time_token import OneTimeTokenMixin


class OAuthIdentity(db.Model):
    __tablename__ = "oauth_identities"
    __table_args__ = (UniqueConstraint("provider", "subject", name="uq_oauth_identities_provider_subject"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider: Mapped[OAuthProvider] = mapped_column(Enum(OAuthProvider, name="oauth_provider"))
    subject: Mapped[str] = mapped_column(String(255))  # the provider's permanent id for this person
    email: Mapped[str] = mapped_column(String(254))     # email the provider reported at linking time
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LoginCode(OneTimeTokenMixin, db.Model):
    __tablename__ = "login_codes"

    remember_me: Mapped[bool] = mapped_column(server_default=text("false"))
    is_new_user: Mapped[bool] = mapped_column(server_default=text("false"))
