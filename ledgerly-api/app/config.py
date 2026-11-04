"""App settings, read from environment variables (and .env during development)."""
import os


class Config:
    APP_NAME = "Ledgerly API"
    APP_ENV = os.getenv("APP_ENV", "development")
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-not-secret")
    FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

    # Login tokens (JWT). Signed with their own secret, separate from SECRET_KEY.
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-only-not-secret-jwt")
    JWT_TOKEN_LOCATION = ["headers"]  # sent as "Authorization: Bearer <token>"
    JWT_DEFAULT_DAYS = 1               # normal login
    JWT_REMEMBER_DAYS = 30             # "Keep me signed in for 30 days"

    # Email via Resend. Without an API key, emails are printed in the terminal instead.
    # Which service sends email: "resend" (default) or "brevo". Both use HTTPS, which Render's free plan allows.
    EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "resend").strip().lower()
    RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
    BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
    EMAIL_FROM = os.getenv("EMAIL_FROM", "Ledgerly <onboarding@resend.dev>")
    PASSWORD_RESET_MINUTES = 30
    EMAIL_VERIFICATION_MINUTES = 24 * 60

    # Support messages are forwarded here when set (e.g. support@yourdomain.com).
    SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "")

    # Receipt files. Requests larger than this are refused before they're read.
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", os.path.join(os.path.dirname(os.path.dirname(__file__)), "instance", "uploads"))
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024

    # Rate limits ("5 per minute" = at most 5 requests a minute from one address)
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")
    RATELIMIT_HEADERS_ENABLED = True
    LOGIN_RATE_LIMIT = "5 per minute"
    FORGOT_PASSWORD_RATE_LIMIT = "3 per 15 minutes"
    RESEND_VERIFICATION_RATE_LIMIT = "3 per 15 minutes"

    # Logging: LOG_LEVEL (DEBUG, INFO, WARNING), LOG_FORMAT (text or json), LOG_FILE (empty = console only)
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT = os.getenv("LOG_FORMAT", "text")
    LOG_FILE = os.getenv("LOG_FILE", os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs", "ledgerly.log"))

    # Sign in with Google / Microsoft. A provider's button only appears when its id and secret are set.
    API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")  # used to build the redirect (callback) URLs
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
    MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID", "")
    MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET", "")
    MICROSOFT_TENANT = os.getenv("MICROSOFT_TENANT", "common")  # common = personal and work/school accounts

    # The short-lived cookie that protects the Google/Microsoft redirect (holds state, nonce and PKCE verifier).
    SESSION_COOKIE_NAME = "ledgerly_oauth"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = os.getenv("APP_ENV", "development") == "production"

    # Set TRUST_PROXY=1 when the app runs behind a proxy or load balancer (most hosting).
    TRUST_PROXY = os.getenv("TRUST_PROXY", "0") == "1"

    # Database
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,  # quietly replace connections the database has closed
        "pool_recycle": 1800,   # refresh connections every 30 minutes
    }


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False

    @classmethod
    def validate(cls):
        if cls.SECRET_KEY in ("", "change-me", "dev-only-not-secret"):
            raise RuntimeError("Set a real SECRET_KEY before running in production.")
        if cls.JWT_SECRET_KEY in ("", "change-me", "dev-only-not-secret-jwt") or len(cls.JWT_SECRET_KEY) < 32:
            raise RuntimeError("Set a real JWT_SECRET_KEY (at least 32 characters) before running in production.")
        if cls.EMAIL_PROVIDER not in ("resend", "brevo"):
            raise RuntimeError("EMAIL_PROVIDER must be 'resend' or 'brevo'.")
        if cls.EMAIL_PROVIDER == "resend" and not cls.RESEND_API_KEY:
            raise RuntimeError("Set RESEND_API_KEY before running in production (or set EMAIL_PROVIDER=brevo).")
        if cls.EMAIL_PROVIDER == "brevo" and not cls.BREVO_API_KEY:
            raise RuntimeError("Set BREVO_API_KEY before running in production (EMAIL_PROVIDER is brevo).")
        if cls.RATELIMIT_STORAGE_URI == "memory://":
            raise RuntimeError("Use Redis for RATELIMIT_STORAGE_URI in production (memory resets on restart).")
        if not cls.SQLALCHEMY_DATABASE_URI:
            raise RuntimeError("Set DATABASE_URL before running in production.")


class TestingConfig(Config):
    TESTING = True
    LOG_FILE = ""  # tests log to the console only
    RESEND_API_KEY = ""  # tests never send real email
    BREVO_API_KEY = ""
    RATELIMIT_ENABLED = True
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), "instance", "test-uploads")
    # Tests use their own database so they never touch your real data.
    SQLALCHEMY_DATABASE_URI = os.getenv("TEST_DATABASE_URL", "")


CONFIGS = {"development": DevelopmentConfig, "production": ProductionConfig, "testing": TestingConfig}
