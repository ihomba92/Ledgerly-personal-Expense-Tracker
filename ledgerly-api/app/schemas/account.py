"""Profile settings, password change and account deletion."""
from typing import Annotated
from zoneinfo import available_timezones

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.auth import check_password_strength
from app.schemas.common import Text

CURRENCIES = {"KES", "UGX", "TZS", "USD", "EUR"}


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: Annotated[Text, Field(min_length=2, max_length=80)] | None = None
    ledger_name: Annotated[Text, Field(min_length=2, max_length=60)] | None = None
    currency: str | None = None
    timezone: str | None = None
    notify_low_balance: bool | None = None
    notify_budget: bool | None = None
    weekly_digest: bool | None = None

    @field_validator("currency")
    @classmethod
    def known_currency(cls, value):
        if value is not None and value not in CURRENCIES:
            raise ValueError("Choose a supported currency.")
        return value

    @field_validator("timezone")
    @classmethod
    def known_timezone(cls, value):
        if value is not None and value not in available_timezones():
            raise ValueError("Choose a valid time zone, e.g. Africa/Nairobi.")
        return value


class ChangePasswordIn(BaseModel):
    # Not needed for Google/Microsoft accounts that don't have a password yet.
    current_password: str | None = Field(default=None, min_length=1, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def strong(cls, value: str) -> str:
        return check_password_strength(value)


class DeleteAccountIn(BaseModel):
    # Accounts with a password confirm with it; Google/Microsoft-only accounts type their email instead.
    password: str | None = Field(default=None, min_length=1, max_length=72)
    confirm_email: str | None = Field(default=None, max_length=254)
