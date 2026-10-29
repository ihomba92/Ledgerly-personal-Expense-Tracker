"""Application factory: builds and configures the Flask app."""
import os

from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix

from app.config import CONFIGS
from app.errors import register_error_handlers, register_jwt_errors
from app.extensions import cors, db, jwt, limiter, migrate
from app.logging_setup import setup_logging


def create_app(env: str | None = None) -> Flask:
    """Create the app. `env` is development, production or testing (defaults to APP_ENV)."""
    env = env or os.getenv("APP_ENV", "development")
    config = CONFIGS[env]
    if hasattr(config, "validate"):
        config.validate()

    app = Flask(__name__)
    app.config.from_object(config)
    app.json.sort_keys = False  # keep JSON fields in the order we write them
    app.json.ensure_ascii = False  # send ’ and other characters as they are

    setup_logging(app)  # request ids, per-request lines, secrets removed

    # Allow the React app to call the API with its login token.
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": [app.config["FRONTEND_ORIGIN"]]}},
        supports_credentials=True,
        methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
        expose_headers=["X-Request-ID"],  # lets the React app read the id for error reports
    )

    # Database and migrations
    if not app.config["SQLALCHEMY_DATABASE_URI"]:
        raise RuntimeError("DATABASE_URL is not set. Add it to your .env file.")
    db.init_app(app)
    migrate.init_app(app, db, compare_type=True)  # compare_type: notice column type changes
    from app import models  # noqa: F401  (registers the models with SQLAlchemy)

    # Login tokens
    jwt.init_app(app)
    register_jwt_errors(jwt)

    # Rate limits (login attempts, password reset requests)
    limiter.init_app(app)

    from app.api import api
    app.register_blueprint(api)

    register_error_handlers(app)

    from app.cli import register_commands
    register_commands(app)

    @app.after_request
    def security_headers(response):
        """Browser protections for every API response."""
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        # Never pass the address of a page (which could hold a link token) on to another site.
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        # Personal financial data and login tokens must not be stored in browser or proxy caches.
        response.headers.setdefault("Cache-Control", "no-store")
        return response

    import logging
    logging.getLogger("ledgerly").info("Ledgerly API ready (%s, log level %s)", env, app.config["LOG_LEVEL"])

    # Behind a proxy/load balancer (most hosting), trust its X-Forwarded-* headers so
    # rate limits count real visitors instead of the proxy's single address.
    if app.config["TRUST_PROXY"]:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    return app
