"""Endpoints to check the API and the database are running."""
from flask import current_app, jsonify
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api import api
from app.extensions import db


@api.get("/health")
def health():
    """The API is up. Also reports whether the database answers."""
    try:
        db.session.execute(text("SELECT 1"))
        database = "ok"
    except SQLAlchemyError as exc:
        # One line is enough here, e.g. "password authentication failed for user ledgerly"
        current_app.logger.error("Database health check failed: %s", str(exc.orig or exc).strip().splitlines()[-1])
        database = "unavailable"

    body = {
        "status": "ok" if database == "ok" else "degraded",
        "app": current_app.config["APP_NAME"],
        "environment": current_app.config["APP_ENV"],
        "database": database,
    }
    return jsonify(body), 200 if database == "ok" else 503
