"""Building blocks shared by several schemas."""
import re
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, BeforeValidator, Field


def _clean_text(value):
    """Trim and collapse spaces; treat an empty string as 'not given'."""
    if isinstance(value, str):
        value = " ".join(value.split())
        return value or None
    return value


def _not_far_future(value: date) -> date:
    # One day of slack covers time-zone differences between the phone and the server.
    if value > datetime.now(timezone.utc).date() + timedelta(days=1):
        raise ValueError("The date can't be in the future.")
    return value


def _month(value: str) -> str:
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", value):
        raise ValueError("Use the format YYYY-MM, e.g. 2026-10.")
    return value


Text = Annotated[str, BeforeValidator(_clean_text)]
# Amounts in shillings with up to 2 decimals, between 0.01 and 10,000,000.
Amount = Annotated[Decimal, Field(gt=0, le=Decimal("10000000"), max_digits=10, decimal_places=2)]
PastOrToday = Annotated[date, AfterValidator(_not_far_future)]
Month = Annotated[str, AfterValidator(_month)]
Page = Annotated[int, Field(ge=1, le=10_000)]
PerPage = Annotated[int, Field(ge=1, le=100)]
