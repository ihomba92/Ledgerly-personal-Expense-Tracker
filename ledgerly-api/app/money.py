"""Money is stored as whole cents (Ksh 450.50 -> 45050) so sums never pick up rounding errors.

The API accepts and returns amounts as decimal strings or numbers ("450.50").
"""
from decimal import ROUND_HALF_UP, Decimal


def to_cents(amount: Decimal) -> int:
    return int((amount * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


SYMBOLS = {"KES": "Ksh", "UGX": "USh", "TZS": "TSh", "USD": "$", "EUR": "€"}


def label(cents: int, currency: str = "KES") -> str:
    """For messages people read: 545050 -> "Ksh 5,450.50"."""
    return f"{SYMBOLS.get(currency, currency)} {Decimal(cents) / 100:,.2f}"


def money(cents: int | None) -> str:
    """45050 -> "450.50"."""
    return f"{Decimal(cents or 0) / 100:.2f}"
