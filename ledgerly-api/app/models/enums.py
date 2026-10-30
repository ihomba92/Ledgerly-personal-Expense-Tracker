"""Fixed lists of values, stored as PostgreSQL enum types."""
import enum


class FundingSource(str, enum.Enum):
    salary = "salary"
    mpesa = "mpesa"
    bank = "bank"
    business = "business"
    cash = "cash"
    other = "other"


class TopUpKind(str, enum.Enum):
    initial = "initial"  # the first balance after sign-up
    topup = "topup"


class PaymentMethod(str, enum.Enum):
    mpesa = "mpesa"
    cash = "cash"
    card = "card"
    bank = "bank"


class ExpenseStatus(str, enum.Enum):
    draft = "draft"  # recorded, not taken from the balance
    paid = "paid"    # taken from the balance


class RequestStatus(str, enum.Enum):
    open = "open"
    answered = "answered"
    closed = "closed"


class OAuthProvider(str, enum.Enum):
    google = "google"
    microsoft = "microsoft"


class NotificationKind(str, enum.Enum):
    welcome = "welcome"
    budget_near = "budget_near"      # a category reached 85% of its budget
    budget_over = "budget_over"      # a category went over its budget
    low_balance = "low_balance"      # balance below 10% of everything added
    security = "security"            # password changed, new sign-in method
