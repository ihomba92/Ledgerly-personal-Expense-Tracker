"""What the category, income, expense and support endpoints accept."""
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.category import ALLOWED_ICONS
from app.models.enums import ExpenseStatus, FundingSource, PaymentMethod
from app.schemas.common import Amount, Month, Page, PastOrToday, PerPage, Text

Budget = Annotated[Decimal, Field(ge=0, le=Decimal("10000000"), max_digits=10, decimal_places=2)]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")  # unknown fields are an error, not silently ignored


# ---------- categories ----------

class CategoryIn(Strict):
    label: Annotated[Text, Field(min_length=2, max_length=30)]
    icon: str = "more_horiz"
    budget: Budget = Decimal("0")

    @field_validator("icon")
    @classmethod
    def known_icon(cls, value: str) -> str:
        if value not in ALLOWED_ICONS:
            raise ValueError("Choose one of the available icons.")
        return value


class CategoryUpdate(Strict):
    label: Annotated[Text, Field(min_length=2, max_length=30)] | None = None
    icon: str | None = None
    budget: Budget | None = None

    @field_validator("icon")
    @classmethod
    def known_icon(cls, value):
        if value is not None and value not in ALLOWED_ICONS:
            raise ValueError("Choose one of the available icons.")
        return value


class CategoryQuery(BaseModel):
    month: Month | None = None


# ---------- income / top-ups ----------

class TopUpIn(Strict):
    amount: Amount
    source: FundingSource
    received_on: PastOrToday
    note: Annotated[Text, Field(max_length=120)] | None = None


class TopUpUpdate(Strict):
    amount: Amount | None = None
    source: FundingSource | None = None
    received_on: PastOrToday | None = None
    note: Annotated[Text, Field(max_length=120)] | None = None


class TopUpQuery(BaseModel):
    source: FundingSource | None = None
    month: Month | None = None
    page: Page = 1
    per_page: PerPage = 20


# ---------- expenses ----------

class ExpenseIn(Strict):
    subject: Annotated[Text, Field(min_length=2, max_length=120)]
    merchant: Annotated[Text, Field(min_length=1, max_length=120)]
    amount: Amount
    category_id: UUID
    method: PaymentMethod = PaymentMethod.mpesa
    status: ExpenseStatus = ExpenseStatus.paid
    spent_on: PastOrToday
    note: Annotated[Text, Field(max_length=500)] | None = None


class ExpenseUpdate(Strict):
    subject: Annotated[Text, Field(min_length=2, max_length=120)] | None = None
    merchant: Annotated[Text, Field(min_length=1, max_length=120)] | None = None
    amount: Amount | None = None
    category_id: UUID | None = None
    method: PaymentMethod | None = None
    status: ExpenseStatus | None = None
    spent_on: PastOrToday | None = None
    note: Annotated[Text, Field(max_length=500)] | None = None


class ExpenseQuery(BaseModel):
    status: ExpenseStatus | None = None
    category_id: UUID | None = None
    method: PaymentMethod | None = None
    receipt: Literal["attached", "missing"] | None = None
    month: Month | None = None
    q: Annotated[str, Field(max_length=100)] | None = None
    sort: Literal["date-desc", "date-asc", "amount-desc", "amount-asc"] = "date-desc"
    page: Page = 1
    per_page: PerPage = 20


class ExpenseIds(Strict):
    ids: Annotated[list[UUID], Field(min_length=1, max_length=100)]


# ---------- support ----------

class SupportIn(Strict):
    topic: Annotated[Text, Field(min_length=2, max_length=40)]
    subject: Annotated[Text, Field(min_length=4, max_length=120)]
    message: Annotated[str, Field(min_length=20, max_length=2000)]

    @field_validator("message")
    @classmethod
    def trimmed(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 20:
            raise ValueError("Describe the issue in at least 20 characters.")
        return value


# ---------- reports ----------

class SummaryQuery(BaseModel):
    month: Month | None = None


class MonthlyQuery(BaseModel):
    months: Annotated[int, Field(ge=1, le=24)] = 6
