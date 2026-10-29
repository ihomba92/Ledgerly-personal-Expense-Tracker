"""'Today' and 'this month' in the user's own time zone (Nairobi by default)."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.services.ledger import month_bounds


def today_for(user) -> date:
    return datetime.now(ZoneInfo(user.timezone)).date()


def month_range(month: str | None, user) -> tuple[str, date, date]:
    """'2026-10' (or the user's current month) -> ('2026-10', first day, last day)."""
    if month is None:
        t = today_for(user)
        month = f"{t.year:04d}-{t.month:02d}"
    year, mon = map(int, month.split("-"))
    start, end = month_bounds(year, mon)
    return month, start, end
