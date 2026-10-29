"""What the auth endpoints accept and return. Rules match the React sign-up and login forms."""
import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def check_password_strength(value: str) -> str:
    """Same rules as the sign-up form: 8+ characters, a capital letter and a number."""
    if not re.search(r"[A-Z]", value):
        raise ValueError("Include at least one capital letter.")
    if not re.search(r"[0-9]", value):
        raise ValueError("Include at least one number.")
    if len(value.encode("utf-8")) > 72:  # bcrypt's limit
        raise ValueError("Use a shorter password (72 bytes at most).")
    return value


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator("full_name")
    @classmethod
    def tidy_name(cls, value: str) -> str:
        value = " ".join(value.split())  # trim and collapse spaces
        if len(value) < 2:
            raise ValueError("Enter your full name.")
        return value

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        return check_password_strength(value)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)
    remember_me: bool = False


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        return check_password_strength(value)


class VerifyEmailIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class ResendVerificationIn(BaseModel):
    email: EmailStr


class OAuthExchangeIn(BaseModel):
    code: str = Field(min_length=20, max_length=200)


class UserOut(BaseModel):
    """The user as the API returns it. The password hash is never included."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    email: str
    email_verified: bool
    has_password: bool
    providers: list[str]
    ledger_name: str
    currency: str
    timezone: str
    notify_low_balance: bool
    notify_budget: bool
    weekly_digest: bool
    created_at: datetime
