"""Database models. Every model must be imported here so migrations can see it."""
from app.models.category import Category  # noqa: F401
from app.models.email_verification import EmailVerificationToken  # noqa: F401
from app.models.expense import Expense  # noqa: F401
from app.models.oauth import LoginCode, OAuthIdentity  # noqa: F401
from app.models.password_reset import PasswordResetToken  # noqa: F401
from app.models.receipt import Receipt  # noqa: F401
from app.models.support_request import SupportRequest  # noqa: F401
from app.models.top_up import TopUp  # noqa: F401
from app.models.user import User  # noqa: F401
