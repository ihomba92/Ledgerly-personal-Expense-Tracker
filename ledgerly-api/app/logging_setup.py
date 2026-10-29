"""Logging for easy debugging.

Every line carries the request id (also sent back as the X-Request-ID header and included
in error responses) and the user id, so a problem someone reports can be traced in seconds.

  Console:  readable text
  File:     logs/ledgerly.log, rotated at 5 MB, 5 old files kept (LOG_FILE= to turn off)
  JSON:     LOG_FORMAT=json, one JSON object per line, for log services in production

Secrets never reach the logs: tokens, passwords, login codes and JWTs are blanked out.
"""
import json
import logging
import os
import re
import time
import uuid
from logging.handlers import RotatingFileHandler

from flask import g, has_request_context, request

# ---------- removing secrets ----------

REDACTIONS = [
    (re.compile(r"(token|code|password|secret|access_token|current_password|new_password)(\"?\s*[:=]\s*\"?)[^\s\"&,}]+", re.I),
     r"\1\2[redacted]"),
    (re.compile(r"Bearer\s+[\w\-.]+", re.I), "Bearer [redacted]"),
    (re.compile(r"eyJ[\w-]+\.[\w-]+\.[\w-]+"), "[jwt redacted]"),
]


def redact(text: str) -> str:
    for pattern, replacement in REDACTIONS:
        text = pattern.sub(replacement, text)
    return text


class ContextFilter(logging.Filter):
    """Adds request_id and user_id to every log record and removes secrets from the message."""

    def filter(self, record):
        if has_request_context():
            record.request_id = getattr(g, "request_id", "-")
            record.user_id = getattr(g, "user_id", None) or "-"
        else:
            record.request_id, record.user_id = "-", "-"
        record.msg = redact(record.getMessage())
        record.args = ()
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record):
        entry = {
            "time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": record.request_id,
            "user_id": record.user_id,
        }
        for key in ("method", "path", "status", "duration_ms"):
            if hasattr(record, key):
                entry[key] = getattr(record, key)
        if record.exc_info:
            entry["exception"] = redact(self.formatException(record.exc_info))
        return json.dumps(entry, ensure_ascii=False)


TEXT_FORMAT = "%(asctime)s %(levelname)-7s [req %(request_id)s · user %(user_id)s] %(name)s: %(message)s"


def setup_logging(app) -> None:
    level = getattr(logging, app.config["LOG_LEVEL"].upper(), logging.INFO)
    formatter = JsonFormatter() if app.config["LOG_FORMAT"] == "json" else logging.Formatter(TEXT_FORMAT, "%Y-%m-%d %H:%M:%S")

    handlers = [logging.StreamHandler()]
    if app.config["LOG_FILE"]:
        os.makedirs(os.path.dirname(app.config["LOG_FILE"]) or ".", exist_ok=True)
        handlers.append(RotatingFileHandler(app.config["LOG_FILE"], maxBytes=5 * 1024 * 1024, backupCount=5, encoding="utf-8"))

    root = logging.getLogger("ledgerly")
    root.handlers.clear()
    root.setLevel(level)
    root.propagate = False
    for handler in handlers:
        handler.setFormatter(formatter)
        handler.addFilter(ContextFilter())
        root.addHandler(handler)

    # Flask's own app.logger and SQLAlchemy errors go to the same place.
    app.logger.handlers = root.handlers
    app.logger.setLevel(level)
    app.logger.propagate = False

    # Werkzeug prints its own access line with the full URL; ours replaces it.
    logging.getLogger("werkzeug").setLevel(logging.WARNING)

    request_log = logging.getLogger("ledgerly.request")

    @app.before_request
    def start_request():
        incoming = request.headers.get("X-Request-ID", "")
        g.request_id = incoming if re.fullmatch(r"[\w-]{8,64}", incoming) else uuid.uuid4().hex[:12]
        g.started = time.perf_counter()

    @app.after_request
    def finish_request(response):
        response.headers["X-Request-ID"] = getattr(g, "request_id", "-")
        if request.method != "OPTIONS" and request.path != "/api/health":
            ms = round((time.perf_counter() - getattr(g, "started", time.perf_counter())) * 1000, 1)
            level = logging.ERROR if response.status_code >= 500 else logging.INFO
            request_log.log(level, "%s %s -> %s (%s ms)", request.method, request.path, response.status_code, ms,
                            extra={"method": request.method, "path": request.path, "status": response.status_code,
                                   "duration_ms": ms})
        return response
